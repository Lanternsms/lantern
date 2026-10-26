/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import type { NotificationInput } from './types'
import { createAdminClient } from '@/lib/supabase/admin'
import { notificationUrl } from './urls'

type Resolver = (payload: Record<string, unknown>) => Promise<NotificationInput[]>

async function getGuardianProfileIds(studentId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data: relations, error: relError } = await admin
    .from('student_guardians')
    .select('guardian_id')
    .eq('student_id', studentId)

  if (relError || !relations || relations.length === 0) {
    return []
  }

  const guardianIds = relations.map((r) => r.guardian_id)
  const { data: guardians, error: gError } = await admin
    .from('guardians')
    .select('profile_id')
    .in('id', guardianIds)
    .not('profile_id', 'is', null)

  if (gError || !guardians) {
    return []
  }

  return guardians.map((g) => g.profile_id).filter(Boolean) as string[]
}

const audienceMap: Record<string, Resolver[]> = {
  attendance_marked: [
    async (payload) => {
      const studentId = payload.studentId as string | undefined
      const schoolId = payload.schoolId as string
      const studentName = (payload.studentName as string) || 'Your student'
      const recordedBy = payload.recordedBy as string | undefined
      if (!studentId || !schoolId) return []

      const guardianProfileIds = await getGuardianProfileIds(studentId)
      return guardianProfileIds.map((guardianId) => ({
        schoolId,
        recipientId: guardianId,
        type: 'attendance_marked',
        category: 'attendance',
        title: 'Attendance recorded',
        body: `Attendance for ${studentName} has been recorded.`,
        url: notificationUrl('attendance_marked', { studentId }, 'guardian'),
        studentId,
        actorId: recordedBy,
      }))
    },
  ],
  lms_period_attendance_saved: [
    async (payload) => {
      const studentId = payload.studentId as string | undefined
      const schoolId = payload.schoolId as string
      const studentName = (payload.studentName as string) || 'Your student'
      const recordedBy = payload.recordedBy as string | undefined
      if (!studentId || !schoolId) return []

      const guardianProfileIds = await getGuardianProfileIds(studentId)
      return guardianProfileIds.map((guardianId) => ({
        schoolId,
        recipientId: guardianId,
        type: 'lms_period_attendance_saved',
        category: 'attendance',
        title: 'Period attendance saved',
        body: `Period attendance for ${studentName} has been saved.`,
        url: notificationUrl('lms_period_attendance_saved', { studentId }, 'guardian'),
        studentId,
        actorId: recordedBy,
      }))
    },
  ],
  payment_recorded: [
    async (payload) => {
      const studentId = payload.studentId as string | undefined
      const schoolId = payload.schoolId as string
      const description = (payload.description as string) || 'Fee payment'
      if (!studentId || !schoolId) return []

      const guardianProfileIds = await getGuardianProfileIds(studentId)
      return guardianProfileIds.map((guardianId) => ({
        schoolId,
        recipientId: guardianId,
        type: 'payment_recorded',
        category: 'fees',
        title: 'Payment received',
        body: `A payment was recorded: ${description}`,
        url: notificationUrl('payment_recorded', { studentId }, 'guardian'),
        studentId,
      }))
    },
  ],
  lms_question_asked: [
    async (payload) => {
      const schoolId = payload.schoolId as string
      const lessonId = payload.lessonId as string
      const questionId = payload.questionId as string
      const authorId = payload.authorId as string | undefined
      if (!schoolId || !lessonId) return []

      const admin = createAdminClient()

      // Load lesson to find the recorder
      const { data: lesson } = await (admin as any)
        .from('lms_lessons')
        .select('id, recorded_by, class_id, subject_id')
        .eq('id', lessonId)
        .eq('school_id', schoolId)
        .maybeSingle()

      if (!lesson) return []

      // Collect staff recipients: recorded_by + any user with lms.manage role permission
      const recipientIds = new Set<string>()

      if (lesson.recorded_by && lesson.recorded_by !== authorId) {
        recipientIds.add(lesson.recorded_by)
      }

      // Find profiles that have the lms.manage permission via role_permissions
      const { data: rolePerms } = await (admin as any)
        .from('role_permissions')
        .select('roles:role_id ( role_members ( profile_id ) )')
        .eq('school_id', schoolId)
        .eq('permission_code', 'lms.manage')

      for (const rp of rolePerms ?? []) {
        for (const member of rp.roles?.role_members ?? []) {
          if (member.profile_id && member.profile_id !== authorId) {
            recipientIds.add(member.profile_id)
          }
        }
      }

      return Array.from(recipientIds).map((recipientId) => ({
        schoolId,
        recipientId,
        type: 'lms_question_asked',
        category: 'qa',
        title: 'New question asked',
        body: `A new question was asked about a lesson.`,
        url: notificationUrl('lms_question_asked', { lessonId, questionId }, 'staff'),
        actorId: authorId,
      }))
    },
  ],
  lms_notes_attached: [
    async (payload) => {
      const schoolId = payload.schoolId as string
      const lessonId = payload.lessonId as string
      if (!schoolId || !lessonId) return []

      const admin = createAdminClient()

      // Fetch lesson details
      const { data: lesson } = await (admin as any)
        .from('lms_lessons')
        .select(`
          id,
          title,
          status,
          class_id,
          subjects:subject_id ( name )
        `)
        .eq('id', lessonId)
        .eq('school_id', schoolId)
        .maybeSingle()

      if (!lesson || lesson.status !== 'published' || !lesson.class_id) {
        return []
      }

      // Fetch current academic session
      const { data: currentSession } = await (admin as any)
        .from('academic_sessions')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle()

      if (!currentSession) return []

      // Fetch enrolled students
      const { data: enrolments } = await (admin as any)
        .from('enrolments')
        .select('student_id, student:students(id, profile_id, user_id)')
        .eq('school_id', schoolId)
        .eq('session_id', currentSession.id)
        .eq('class_id', lesson.class_id)

      if (!enrolments || enrolments.length === 0) return []

      const subjectName = (lesson.subjects as any)?.name ?? 'Lesson'
      const title = 'Lesson notes added'
      const body = `${subjectName}: ${lesson.title}`
      const dedupeKey = `notes:${lessonId}`

      const notifications: NotificationInput[] = []

      for (const enr of enrolments) {
        const student = enr.student
        if (!student) continue

        // 1. Student notification
        const studentProfileId = student.profile_id || student.user_id
        if (studentProfileId) {
          notifications.push({
            schoolId,
            recipientId: studentProfileId,
            type: 'lms_notes_attached',
            category: 'learning',
            title,
            body,
            url: notificationUrl('lms_notes_attached', { lessonId, studentId: student.id }, 'student'),
            studentId: student.id,
            dedupeKey,
            onDuplicate: 'ignore',
          })
        }

        // 2. Guardian notifications
        const guardianProfileIds = await getGuardianProfileIds(student.id)
        for (const guardianId of guardianProfileIds) {
          notifications.push({
            schoolId,
            recipientId: guardianId,
            type: 'lms_notes_attached',
            category: 'learning',
            title,
            body,
            url: notificationUrl('lms_notes_attached', { lessonId, studentId: student.id }, 'guardian'),
            studentId: student.id,
            dedupeKey,
            onDuplicate: 'ignore',
          })
        }
      }

      return notifications
    },
  ],
}

export function getAudiences(eventKey: string): Resolver[] | undefined {
  return audienceMap[eventKey]
}
