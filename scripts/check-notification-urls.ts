/**
 * Verification Script: check-notification-urls
 * Asserts that for every event type and recipient kind, notificationUrl():
 * 1. Returns a valid relative path starting with /
 * 2. Matches an existing route file in app/ (static or dynamic segment)
 * 3. Is permitted for that recipient kind (guardians/students never get staff routes)
 * 4. Links child-specific notices to guardian dashboard with child & tab
 * Fails with process.exit(1) on any broken link.
 */

import * as fs from 'fs'
import * as path from 'path'
import { notificationUrl, isAllowedUrlForRecipient, type RecipientKind, type NotificationUrlContext } from '../lib/notifications/urls'

// Scan app/ directory to discover all valid routes
function getAppRoutes(dir: string, baseRoute = ''): string[] {
  const routes: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      routes.push(...getAppRoutes(fullPath, `${baseRoute}/${entry.name}`))
    } else if (entry.name === 'page.tsx' || entry.name === 'route.ts') {
      routes.push(baseRoute === '' ? '/' : baseRoute)
    }
  }

  return routes
}

// Convert a route pattern like /dashboard/lms/[lessonId] to a RegExp
function routeToRegex(route: string): RegExp {
  const pattern = route
    .replace(/\[\.\.\.([^\]]+)\]/g, '(.+)') // catch-all [...param]
    .replace(/\[([^\]]+)\]/g, '([^/]+)')   // dynamic [param]
  return new RegExp(`^${pattern}$`)
}

const ALL_EVENT_TYPES = [
  'attendance_marked',
  'lms_period_attendance_saved',
  'results_published',
  'batch_submitted_for_approval',
  'batch_approved',
  'batch_rejected',
  'batch_returned',
  'payment_recorded',
  'fees_payment_received',
  'fee_structure_changed',
  'fees_structure_changed',
  'lms_lesson_status_changed',
  'lms_activity_status_changed',
  'lms_activity_updated',
  'lms_activity_brief_attached',
  'lms_submission_marked',
  'lms_question_asked',
  'lms_question_replied',
  'lms_thread_status_changed',
  'announcement_posted',
  'role_assigned',
  'role_removed',
  'role_permission_granted',
  'role_permission_revoked',
  'account_welcome',
  'lms_orphan_storage_cleanup_failed',
  'system_alert',
  'test_ping',
]

const RECIPIENT_KINDS: RecipientKind[] = ['guardian', 'student', 'staff']

const SAMPLE_CONTEXT: NotificationUrlContext = {
  studentId: 'student-uuid-sample',
  lessonId: 'lesson-uuid-sample',
  threadId: 'thread-uuid-sample',
  questionId: 'question-uuid-sample',
  activityId: 'activity-uuid-sample',
  batchId: 'batch-uuid-sample',
  classSubjectId: 'class-subject-uuid-sample',
  announcementId: 'announcement-uuid-sample',
}

function runChecks() {
  console.log('🔍 Scanning app/ routes...')
  const appDir = path.resolve(process.cwd(), 'app')
  const appRoutes = getAppRoutes(appDir)
  const routeRegexes = appRoutes.map((r) => ({ route: r, regex: routeToRegex(r) }))
  console.log(`Found ${appRoutes.length} registered routes in app/.\n`)

  let passed = 0
  let failed = 0
  const errors: string[] = []

  for (const eventType of ALL_EVENT_TYPES) {
    for (const kind of RECIPIENT_KINDS) {
      const url = notificationUrl(eventType, SAMPLE_CONTEXT, kind)

      // 1. Path format check
      if (!url.startsWith('/') || url.startsWith('//')) {
        errors.push(`[${eventType}][${kind}] Invalid URL format: "${url}" (must start with / and not //)`)
        failed++
        continue
      }

      // 2. Allow-list check
      if (!isAllowedUrlForRecipient(url, kind)) {
        errors.push(`[${eventType}][${kind}] Role violation: URL "${url}" is not allowed for recipient kind "${kind}"`)
        failed++
        continue
      }

      // 3. Route existence check in app/
      const pathname = url.split('?')[0].replace(/\/$/, '') || '/'
      const matchesRoute = routeRegexes.some(({ regex }) => regex.test(pathname))

      if (!matchesRoute) {
        errors.push(`[${eventType}][${kind}] Route does not exist in app/: "${pathname}" (from full URL "${url}")`)
        failed++
        continue
      }

      // 4. Role-specific validation rules
      if (kind === 'guardian') {
        const staffPrefixes = [
          '/dashboard/attendance',
          '/dashboard/approvals',
          '/dashboard/gradebook',
          '/dashboard/staff',
          '/dashboard/roles',
          '/dashboard/academics',
          '/dashboard/settings',
        ]
        const isStaff = staffPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
        if (isStaff) {
          errors.push(`[${eventType}][guardian] CRITICAL: Guardian URL leaked staff route "${pathname}"`)
          failed++
          continue
        }

        const childRelatedEvents = [
          'attendance_marked',
          'lms_period_attendance_saved',
          'results_published',
          'payment_recorded',
          'fees_payment_received',
          'fee_structure_changed',
          'fees_structure_changed',
          'lms_lesson_status_changed',
          'lms_activity_status_changed',
          'lms_activity_updated',
          'lms_submission_marked',
        ]

        if (childRelatedEvents.includes(eventType)) {
          if (!url.includes('student=') && !url.includes('child=')) {
            errors.push(`[${eventType}][guardian] Guardian child notice missing student query param: "${url}"`)
            failed++
            continue
          }
          if (!url.includes('tab=')) {
            errors.push(`[${eventType}][guardian] Guardian child notice missing tab query param: "${url}"`)
            failed++
            continue
          }
        }
      }

      if (kind === 'student') {
        const staffPrefixes = [
          '/dashboard/attendance',
          '/dashboard/approvals',
          '/dashboard/gradebook',
          '/dashboard/staff',
          '/dashboard/roles',
          '/dashboard/academics',
          '/dashboard/settings',
        ]
        const isStaff = staffPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
        if (isStaff) {
          errors.push(`[${eventType}][student] CRITICAL: Student URL leaked staff route "${pathname}"`)
          failed++
          continue
        }
      }

      passed++
    }
  }

  console.log(`✅ ${passed} notification link permutations verified successfully.`)

  if (failed > 0) {
    console.error(`\n❌ ${failed} checks FAILED:`)
    errors.forEach((err) => console.error(` - ${err}`))
    process.exit(1)
  }

  console.log('🎉 All notification URLs match existing routes and adhere to role constraints.')
}

runChecks()
