/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { getMyAccessContext, canSee, type NavGate } from '@/lib/permissions'
import { ThemeStyle } from './_components/theme-style'
import { getOpenQuestionCount } from './lms/questions/actions'
import { getLmsAccess } from '@/lib/lms/access'
import { NotificationBellServer } from './_components/notification-bell-server'
import { PushSync } from '@/components/push-sync'
import { FirstLoginBanner } from '@/components/first-login-banner'

type NavItem = { label: string; href: string } & NavGate

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Students', href: '/dashboard/students', permission: 'students.view_all' },
  { label: 'Guardians', href: '/dashboard/guardians', permission: 'students.view_all' },
  { label: 'Staff', href: '/dashboard/staff', permission: 'staff.view_all' },
  { label: 'Academics', href: '/dashboard/academics', permission: 'academic_structure.manage' },
  { label: 'Roles & Permissions', href: '/dashboard/roles', permission: 'roles.manage' },
  { label: 'Gradebook', href: '/dashboard/gradebook', scope: 'teacher' },
  { label: 'Approvals', href: '/dashboard/approvals', scope: 'approver' },
  { label: 'Timetable', href: '/dashboard/academics/timetable', permission: 'timetable.manage' },
  { label: 'My Timetable', href: '/dashboard/my-timetable', scope: 'teacher' },
  { label: 'My Timetable', href: '/dashboard/my-timetable', scope: 'student' },
  { label: 'Class Lessons', href: '/dashboard/class-lessons', scope: 'student' },
  { label: 'Class Results', href: '/dashboard/class-results', scope: 'teacher' },
  { label: 'Result Remarks', href: '/dashboard/results/remarks', scope: 'teacher' },
  { label: 'My Submissions', href: '/dashboard/my-submissions', scope: 'teacher' },
  { label: 'My Class', href: '/dashboard/my-class', scope: 'formTeacher' },
  { label: 'Results', href: '/dashboard/results', permission: 'results.view_all' },
  { label: 'My Results', href: '/dashboard/my-results', scope: 'student' },
  { label: 'Users', href: '/dashboard/users', permission: ['users.invite', 'users.edit', 'users.view_all'] },
  { label: 'Attendance', href: '/dashboard/attendance', permission: ['attendance.manage', 'attendance.view_all'] },
  { label: 'Mark Attendance', href: '/dashboard/attendance', scope: 'teacher' },
  { label: 'Attendance Categories', href: '/dashboard/attendance/settings', permission: 'settings.manage' },
  { label: 'Fee Structures', href: '/dashboard/fees/structures', permission: 'fees.manage' },
  { label: 'Record Payment', href: '/dashboard/fees/record', permission: 'fees.manage' },
  { label: 'My Payments', href: '/dashboard/payments', scope: 'student' },
  { label: 'Payments', href: '/dashboard/payments', scope: 'guardian' },
  // Items with no gate are visible to all authenticated users
  { label: 'Announcements', href: '/dashboard/announcements' },
  { label: 'Documents', href: '/dashboard/documents' },
  // last item on the navbar with gated permission
  { label: 'Settings', href: '/dashboard/settings', permission: 'school.manage' }
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user) {
    // If getUser() came back with an error, a session existed but its
    // refresh token is invalid/expired — distinct from never having
    // logged in at all, which returns null with no error.
    redirect(authError ? '/session-expired' : '/login')
  }

  const [profile, school, ctx, lmsAccess] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single(),
    supabase.from('schools').select('name, logo_url').single(),
    getMyAccessContext(supabase),
    getLmsAccess(supabase, user),
  ])

  const hasRecordedLesson = lmsAccess.recordedLessonCount > 0
  const canSeeQuestions = lmsAccess.isManager || lmsAccess.isFacilitator || hasRecordedLesson

  let questionsBadge: number | undefined
  if (canSeeQuestions) {
    try {
      const { count } = await getOpenQuestionCount()
      if (typeof count === 'number' && count > 0) {
        questionsBadge = count
      }
    } catch {
      // Fail gracefully on badge error
    }
  }

  const visibleItems: { label: string; href: string; badge?: number | string | null }[] = ALL_NAV_ITEMS
    .filter((item) => canSee(ctx, item))

  // Construct LMS navigation items according to role access rules
  const lmsNavItems: { label: string; href: string; badge?: number | string | null }[] = []

  if (lmsAccess.isManager) {
    lmsNavItems.push({ label: 'LMS', href: '/dashboard/lms' })
  }
  if (lmsAccess.isFacilitator || lmsAccess.isManager) {
    lmsNavItems.push({ label: "Today's Lessons", href: '/dashboard/lms/today' })
  }
  if (hasRecordedLesson) {
    lmsNavItems.push({ label: 'My Lessons', href: '/dashboard/lms/my-lessons' })
  }
  if (canSeeQuestions) {
    lmsNavItems.push({
      label: 'Questions',
      href: '/dashboard/lms/questions',
      badge: questionsBadge,
    })
  }
  if (lmsAccess.isManager) {
    lmsNavItems.push({ label: 'Storage', href: '/dashboard/lms/storage' })
  }

  // Insert LMS items right before Settings (or append if Settings not present)
  const settingsIdx = visibleItems.findIndex((item) => item.href === '/dashboard/settings')
  if (settingsIdx !== -1) {
    visibleItems.splice(settingsIdx, 0, ...lmsNavItems)
  } else {
    visibleItems.push(...lmsNavItems)
  }

  return (
    <DashboardShell
      firstName={profile.data?.first_name ?? ''}
      lastName={profile.data?.last_name ?? ''}
      schoolName={school.data?.name ?? ''}
      logoUrl={school.data?.logo_url ?? null}
      navItems={visibleItems}
      notificationBell={<NotificationBellServer />}
    >
      <PushSync />
      <ThemeStyle />
      <div className="px-6 pt-4">
        <FirstLoginBanner userId={user.id} />
      </div>
      {children}
    </DashboardShell>
  )
}