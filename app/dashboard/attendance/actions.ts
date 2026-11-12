'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'
import { emit } from '@/lib/notifications/service'

export async function saveAttendance(params: {
  classId: string
  date: string
  subjectId: string
  marks: { studentId: string; armId: string | null; statusId: string }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!params.subjectId) {
    return { error: 'Subject is required' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found' }

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()
  if (!session) return { error: 'No active academic session' }

  // Teacher subject assignment check:
  // Must verify that the teacher is assigned this subject for this class in current session
  const { data: assignments } = await supabase
    .from('class_subjects')
    .select('id, arm_id')
    .eq('teacher_id', user.id)
    .eq('class_id', params.classId)
    .eq('subject_id', params.subjectId)
    .eq('session_id', session.id)

  if (!assignments || assignments.length === 0) {
    return { error: 'Insufficient permission' }
  }

  // If the assignment is for specific arms, check that all marks are for allowed arms
  const hasWholeClass = assignments.some((a) => a.arm_id === null)
  if (!hasWholeClass) {
    const allowedArmIds = new Set(assignments.map((a) => a.arm_id))
    const isMarkAllowed = params.marks.every((m) => !m.armId || allowedArmIds.has(m.armId))
    if (!isMarkAllowed) {
      return { error: 'Insufficient permission' }
    }
  }

  const markedAt = new Date().toISOString()

  const rows = params.marks.map((m) => ({
    school_id: profile.school_id,
    student_id: m.studentId,
    class_id: params.classId,
    arm_id: m.armId,
    date: params.date,
    status_id: m.statusId,
    subject_id: params.subjectId,
    marked_by: user.id,
    marked_at: markedAt,
  }))

  const { error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'student_id,date,subject_id' })

  if (error) return { error: error.message }

  await logSchoolAction('attendance_marked', {
    metadata: {
      classId: params.classId,
      date: params.date,
      subjectId: params.subjectId,
      studentCount: params.marks.length,
    },
  })

  // Notifications: coalesce absent alerts to guardians
  const { data: statuses } = await supabase
    .from('attendance_statuses')
    .select('id, code, label, counts_as_present')
    .eq('school_id', profile.school_id)
  const statusMap = new Map((statuses ?? []).map((s) => [s.id, s]))

  const { data: subjectData } = await supabase
    .from('subjects')
    .select('name')
    .eq('id', params.subjectId)
    .maybeSingle()
  const subjectName = subjectData?.name ?? 'Subject'

  const absentMarks = params.marks.filter((m) => {
    const st = statusMap.get(m.statusId)
    if (!st) return false
    const code = (st.code || '').toLowerCase()
    const label = (st.label || '').toLowerCase()
    return code === 'absent' || (!st.counts_as_present && label.includes('absent'))
  })

  await Promise.all(
    absentMarks.map(async (m) => {
      await emit('attendance_marked', {
        schoolId: profile.school_id,
        studentId: m.studentId,
        recordedBy: user.id,
        date: params.date,
        subjectName,
      })
    })
  )

  revalidatePath('/dashboard/attendance')
  return { success: true }
}

export async function saveAttendanceStatus(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string | null
  const code = (formData.get('code') as string).trim().toLowerCase().replace(/\s+/g, '_')
  const label = (formData.get('label') as string).trim()
  const countsAsPresent = formData.get('counts_as_present') === 'on'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found' }

  if (id) {
    const { error } = await supabase
      .from('attendance_statuses')
      .update({ code, label, counts_as_present: countsAsPresent })
      .eq('id', id)
    if (error) return { error: error.message }
    await logSchoolAction('attendance_status_updated', { metadata: { id, code, label } })
  } else {
    const { error } = await supabase
      .from('attendance_statuses')
      .insert({ school_id: profile.school_id, code, label, counts_as_present: countsAsPresent })
    if (error) return { error: error.message }
    await logSchoolAction('attendance_status_created', { metadata: { code, label } })
  }

  revalidatePath('/dashboard/attendance/settings')
  return { success: true }
}

export async function deleteAttendanceStatus(id: string) {
  const supabase = await createClient()
  // If this status has ever been used, the FK on attendance.status_id blocks
  // the delete rather than silently orphaning history — surfaced as error.message.
  const { error } = await supabase.from('attendance_statuses').delete().eq('id', id)
  if (error) return { error: error.message }
  await logSchoolAction('attendance_status_deleted', { metadata: { id } })
  revalidatePath('/dashboard/attendance/settings')
  return { success: true }
}