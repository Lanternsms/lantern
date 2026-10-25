import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category } from '@/lib/notifications/types'
import type { RecipientKind } from './types'

export interface PolicyRule {
  push: boolean
  email: boolean
  emailLocked?: boolean // Cannot be disabled (e.g. account.*)
  emailOnlyIfNoPush?: boolean // Fallback only (e.g. qa.*)
  staffOnly?: boolean // e.g. results awaiting approval / batch decision
}

/**
 * Single, easily-editable policy config table.
 * Defaults by event type, with fallback to category defaults.
 */
export const EVENT_POLICY_DEFAULTS: Record<string, PolicyRule> = {
  // Results
  results_published: { push: true, email: true },
  batch_submitted_for_approval: { push: true, email: true, staffOnly: true },
  batch_approved: { push: true, email: true, staffOnly: true },
  batch_rejected: { push: true, email: true, staffOnly: true },
  batch_returned: { push: true, email: true, staffOnly: true },

  // Attendance
  attendance_marked: { push: true, email: true },
  lms_period_attendance_saved: { push: true, email: true },

  // Fees
  payment_recorded: { push: true, email: true },
  fees_payment_received: { push: true, email: true },
  fee_structure_changed: { push: true, email: true },
  fees_structure_changed: { push: true, email: true },

  // Account (role changes, welcome) -> email ALWAYS (cannot be disabled) + push
  role_assigned: { push: true, email: true, emailLocked: true },
  role_removed: { push: true, email: true, emailLocked: true },
  role_permission_granted: { push: true, email: true, emailLocked: true },
  role_permission_revoked: { push: true, email: true, emailLocked: true },
  account_welcome: { push: true, email: true, emailLocked: true },

  // Announcements & System
  announcement_posted: { push: true, email: true },
  system_alert: { push: true, email: true },
  lms_orphan_storage_cleanup_failed: { push: true, email: true },

  // Q&A -> push; email ONLY if recipient has no push subscription (fallback)
  lms_question_asked: { push: true, email: true, emailOnlyIfNoPush: true },
  lms_question_replied: { push: true, email: true, emailOnlyIfNoPush: true },
  lms_thread_status_changed: { push: true, email: true, emailOnlyIfNoPush: true },

  // Learning (LMS) -> push; email off by default
  lms_lesson_status_changed: { push: true, email: false },
  lms_activity_status_changed: { push: true, email: false },
  lms_activity_updated: { push: true, email: false },
  lms_activity_brief_attached: { push: true, email: false },
  lms_submission_marked: { push: true, email: false },
}

/**
 * Fallback defaults by category if an explicit event type is not in the table.
 */
export const CATEGORY_POLICY_DEFAULTS: Record<Category, PolicyRule> = {
  results: { push: true, email: true },
  attendance: { push: true, email: true },
  fees: { push: true, email: true },
  account: { push: true, email: true, emailLocked: true },
  announcements: { push: true, email: true },
  system: { push: true, email: true },
  qa: { push: true, email: true, emailOnlyIfNoPush: true },
  learning: { push: true, email: false },
}

export function getPolicyRule(type: string, category: Category): PolicyRule {
  const normalizedType = type.replace(/\./g, '_')
  if (EVENT_POLICY_DEFAULTS[normalizedType]) {
    return EVENT_POLICY_DEFAULTS[normalizedType]
  }
  return CATEGORY_POLICY_DEFAULTS[category] || { push: true, email: false }
}

/**
 * Recipient KIND is derived from data, not role names:
 * - guardian (in guardians table for this school)
 * - student (in students table for this school with profile_id)
 * - staff (everyone else)
 * A person can be several; returns a Set of kinds.
 */
export async function resolveRecipientKinds(
  admin: SupabaseClient,
  schoolId: string,
  userIds: string[]
): Promise<Map<string, Set<RecipientKind>>> {
  const result = new Map<string, Set<RecipientKind>>()
  if (userIds.length === 0) return result

  userIds.forEach((id) => result.set(id, new Set<RecipientKind>()))

  const [{ data: guardians }, { data: students }] = await Promise.all([
    admin
      .from('guardians')
      .select('profile_id')
      .eq('school_id', schoolId)
      .in('profile_id', userIds)
      .not('profile_id', 'is', null),
    admin
      .from('students')
      .select('profile_id')
      .eq('school_id', schoolId)
      .in('profile_id', userIds)
      .not('profile_id', 'is', null),
  ])

  const guardianSet = new Set((guardians ?? []).map((g) => g.profile_id as string))
  const studentSet = new Set((students ?? []).map((s) => s.profile_id as string))

  userIds.forEach((id) => {
    const kinds = result.get(id)!
    let isStaff = true

    if (guardianSet.has(id)) {
      kinds.add('guardian')
      isStaff = false
    }
    if (studentSet.has(id)) {
      kinds.add('student')
      isStaff = false
    }
    // If not guardian and not student, or if linked to staff records
    if (isStaff || kinds.size === 0) {
      kinds.add('staff')
    }
  })

  return result
}
