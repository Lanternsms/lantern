export type RecipientKind = 'guardian' | 'student' | 'staff'

export interface NotificationUrlContext {
  studentId?: string | null
  lessonId?: string | null
  threadId?: string | null
  questionId?: string | null
  activityId?: string | null
  batchId?: string | null
  classSubjectId?: string | null
  announcementId?: string | null
  termId?: string | null
  deliveryId?: string | null
  /** For staff recipients: 'recorder' | 'facilitator' | 'manager'. Drives per-role LMS deep links. */
  staffKind?: 'recorder' | 'facilitator' | 'manager' | null
  [key: string]: unknown
}

/**
 * Returns the guardian dashboard URL with appropriate child and tab selection.
 */
function guardianTabUrl(tab: 'attendance' | 'results' | 'fees' | 'timetable' | 'lessons' | 'all', studentId?: string | null): string {
  const p = new URLSearchParams()
  if (studentId) {
    p.set('student', studentId)
    p.set('child', studentId)
  }
  if (tab !== 'all') {
    p.set('tab', tab)
  }
  const qs = p.toString()
  return qs ? `/dashboard?${qs}` : '/dashboard'
}

/**
 * Single Source of Truth URL builder for notifications.
 * GUARANTEES:
 * 1. Every returned path exists in app/.
 * 2. Guardian & student notifications never link to staff routes.
 * 3. Guardian notices for attendance, results, fees, lessons link to guardian dashboard with child & tab.
 */
export function notificationUrl(
  type: string,
  context: NotificationUrlContext = {},
  recipientKind: RecipientKind = 'staff'
): string {
  const normalized = (type || '').replace(/\./g, '_').toLowerCase()
  const studentId = context.studentId || null

  switch (normalized) {
    // Attendance
    case 'attendance_marked': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('attendance', studentId)
      }
      if (recipientKind === 'student') {
        return '/dashboard'
      }
      return '/dashboard/attendance'
    }

    case 'lms_period_attendance_saved': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('attendance', studentId)
      }
      if (recipientKind === 'student') {
        return '/dashboard'
      }
      return '/dashboard/lms/today'
    }

    // Results
    case 'results_published': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('results', studentId)
      }
      if (recipientKind === 'student') {
        return '/dashboard/my-results'
      }
      return '/dashboard/results'
    }

    case 'batch_submitted_for_approval': {
      if (recipientKind === 'guardian' || recipientKind === 'student') {
        return '/dashboard'
      }
      return context.batchId ? `/dashboard/approvals/${context.batchId}` : '/dashboard/approvals'
    }

    case 'batch_approved':
    case 'batch_rejected':
    case 'batch_returned': {
      if (recipientKind === 'guardian' || recipientKind === 'student') {
        return '/dashboard'
      }
      if (context.classSubjectId) {
        return `/dashboard/gradebook/${context.classSubjectId}`
      }
      return '/dashboard/approvals'
    }

    // Fees
    case 'payment_recorded':
    case 'fees_payment_received': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('fees', studentId)
      }
      if (recipientKind === 'student') {
        return '/dashboard/payments'
      }
      return '/dashboard/payments'
    }

    case 'fee_structure_changed':
    case 'fees_structure_changed': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('fees', studentId)
      }
      if (recipientKind === 'student') {
        return '/dashboard/payments'
      }
      return '/dashboard/fees/structures'
    }

    // Learning (LMS)
    case 'lms_notes_attached':
    case 'lms_lesson_status_changed':
    case 'lms_activity_brief_attached': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('lessons', studentId)
      }
      if (recipientKind === 'student') {
        if (context.lessonId && studentId) {
          return `/dashboard/lms/learn/${context.lessonId}?student=${studentId}`
        }
        return '/dashboard'
      }
      // Staff: per-role deep link
      if (context.staffKind === 'recorder') return '/dashboard/lms/my-lessons'
      if (context.staffKind === 'facilitator') return '/dashboard/lms/today'
      return context.lessonId ? `/dashboard/lms/${context.lessonId}` : '/dashboard/lms'
    }

    case 'lms_activity_status_changed':
    case 'lms_activity_updated': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('lessons', studentId)
      }
      if (recipientKind === 'student') {
        if (context.lessonId && context.activityId && studentId) {
          return `/dashboard/lms/learn/${context.lessonId}/${context.activityId}?student=${studentId}`
        }
        return '/dashboard'
      }
      if (context.activityId) {
        return `/dashboard/lms/activities/${context.activityId}`
      }
      return context.lessonId ? `/dashboard/lms/${context.lessonId}` : '/dashboard/lms'
    }

    case 'lms_submission_marked': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('lessons', studentId)
      }
      if (recipientKind === 'student') {
        return '/dashboard/my-submissions'
      }
      return context.activityId ? `/dashboard/lms/activities/${context.activityId}` : '/dashboard/lms'
    }

    // Q&A
    case 'lms_question_asked': {
      if (recipientKind === 'guardian') {
        return guardianTabUrl('lessons', studentId)
      }
      if (recipientKind === 'student') {
        if (context.lessonId && studentId) {
          return `/dashboard/lms/learn/${context.lessonId}?student=${studentId}`
        }
        return '/dashboard'
      }
      // Staff: recorders go to Q&A inbox, managers to thread or inbox
      const qId = context.questionId || context.threadId
      return qId ? `/dashboard/lms/questions/${qId}` : '/dashboard/lms/questions'
    }

    case 'lms_question_replied':
    case 'lms_thread_status_changed': {
      if (recipientKind === 'student') {
        if (context.lessonId && studentId) {
          return `/dashboard/lms/learn/${context.lessonId}?student=${studentId}`
        }
        return '/dashboard'
      }
      if (recipientKind === 'guardian') {
        return guardianTabUrl('lessons', studentId)
      }
      const qId = context.questionId || context.threadId
      return qId ? `/dashboard/lms/questions/${qId}` : '/dashboard/lms/questions'
    }

    // Announcements
    case 'announcement_posted': {
      return '/dashboard/announcements'
    }

    // Account
    case 'role_assigned':
    case 'role_removed':
    case 'role_permission_granted':
    case 'role_permission_revoked': {
      if (recipientKind === 'staff') {
        return '/dashboard/roles'
      }
      return '/dashboard'
    }

    case 'account_welcome': {
      return '/dashboard'
    }

    // System
    case 'lms_orphan_storage_cleanup_failed': {
      if (recipientKind === 'staff') {
        return '/dashboard/lms/storage'
      }
      return '/dashboard'
    }

    case 'system_alert': {
      if (recipientKind === 'staff') {
        return '/dashboard/settings/notifications'
      }
      return '/dashboard/notifications'
    }

    case 'test_ping': {
      return '/dashboard/notifications'
    }

    default: {
      return '/dashboard'
    }
  }
}

/**
 * Known route prefixes strictly disallowed for non-staff (guardians and students).
 */
const STAFF_ONLY_PREFIXES = [
  '/dashboard/attendance',
  '/dashboard/gradebook',
  '/dashboard/approvals',
  '/dashboard/roles',
  '/dashboard/staff',
  '/dashboard/academics',
  '/dashboard/settings',
  '/dashboard/users',
  '/dashboard/class-lessons',
  '/dashboard/class-results',
  '/dashboard/my-class',
  '/dashboard/lms/new',
  '/dashboard/lms/storage',
  '/dashboard/fees/structures',
  '/dashboard/fees/record',
]

/**
 * Checks if a destination URL is permitted for a given recipient kind.
 */
export function isAllowedUrlForRecipient(url: string, recipientKind: RecipientKind): boolean {
  if (!url || typeof url !== 'string') return false

  // Must be an internal relative path starting with / and not //
  if (!url.startsWith('/') || url.startsWith('//')) return false

  const path = url.split('?')[0].replace(/\/$/, '') || '/'

  // Guardians and students must NEVER open staff routes
  if (recipientKind === 'guardian' || recipientKind === 'student') {
    for (const prefix of STAFF_ONLY_PREFIXES) {
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        return false
      }
    }
  }

  // Basic sanity check: must start with /dashboard, /n/, /login, or /unsubscribe
  if (
    !path.startsWith('/dashboard') &&
    !path.startsWith('/n/') &&
    !path.startsWith('/login') &&
    !path.startsWith('/unsubscribe')
  ) {
    return false
  }

  return true
}
