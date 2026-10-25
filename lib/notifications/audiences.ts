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
      const classId = payload.classId as string
      const lessonId = payload.lessonId as string
      const questionId = payload.questionId as string
      const authorId = payload.authorId as string | undefined
      if (!schoolId || !classId) return []

      const admin = createAdminClient()
      const { data, error } = await (admin as any)
        .from('lms_facilitators')
        .select('user_id')
        .eq('school_id', schoolId)
        .eq('class_id', classId)

      if (error || !data) {
        return []
      }

      const facilitatorIds = (data as any[]).map((row) => row.user_id)
      return facilitatorIds.map((facId) => ({
        schoolId,
        recipientId: facId,
        type: 'lms_question_asked',
        category: 'qa',
        title: 'New question asked',
        body: `A new question was asked in lesson ${lessonId}.`,
        url: notificationUrl('lms_question_asked', { lessonId, questionId }, 'staff'),
        actorId: authorId,
      }))
    },
  ],
}

export function getAudiences(eventKey: string): Resolver[] | undefined {
  return audienceMap[eventKey]
}
