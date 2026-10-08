'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveAttendance(params: {
  classId: string
  date: string
  subjectId: string | null
  marks: { studentId: string; armId: string | null; statusId: string }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found' }

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
    .upsert(rows, { onConflict: 'student_id,date' })

  if (error) return { error: error.message }

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
  } else {
    const { error } = await supabase
      .from('attendance_statuses')
      .insert({ school_id: profile.school_id, code, label, counts_as_present: countsAsPresent })
    if (error) return { error: error.message }
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
  revalidatePath('/dashboard/attendance/settings')
  return { success: true }
}