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
  { label: 'Today', href: '/dashboard' },
  { label: 'Students', href: '/dashboard/students', permission: 'students.view_all' },
  { label: 'Guardians', href: '/dashboard/guardians', permission: 'students.view_all' },
  { label: 'Staff', href: '/dashboard/staff', permission: 'staff.view_all' },
  { label: 'Academics', href: '/dashboard/academics', permission: 'academic_structure.manage' },
  { label: 'Roles and permissions', href: '/dashboard/roles', permission: 'roles.manage' },
  { label: 'Gradebook', href: '/dashboard/gradebook', scope: 'teacher' },
  { label: 'Approvals', href: '/dashboard/approvals', scope: 'approver' },
  { label: 'Timetable', href: '/dashboard/academics/timetable', permission: 'timetable.manage' },
  { label: 'My timetable', href: '/dashboard/my-timetable', scope: 'teacher' },
  { label: 'My timetable', href: '/dashboard/my-timetable', scope: 'student' },
  { label: 'Lessons', href: '/dashboard/class-lessons', scope: 'student' },
  { label: 'Class results', href: '/dashboard/class-results', scope: 'teacher' },
  { label: 'Result remarks', href: '/dashboard/results/remarks', scope: 'teacher' },
  { label: 'My submissions', href: '/dashboard/my-submissions', scope: 'teacher' },
  { label: 'My class', href: '/dashboard/my-class', scope: 'formTeacher' },
  { label: 'Results', href: '/dashboard/results', permission: 'results.view_all' },
  { label: 'My results', href: '/dashboard/my-results', scope: 'student' },
  { label: 'Users', href: '/dashboard/users', permission: ['users.invite', 'users.edit', 'users.view_all'] },
  { label: 'Registers', href: '/dashboard/attendance', permission: ['attendance.manage', 'attendance.view_all'] },
  { label: 'Registers', href: '/dashboard/attendance', scope: 'teacher' },
  { label: 'Attendance statuses', href: '/dashboard/attendance/settings', permission: 'settings.manage' },
  { label: 'Fee structures', href: '/dashboard/fees/structures', permission: 'fees.manage' },
  { label: 'Fees', href: '/dashboard/fees/record', permission: 'fees.manage' },
  { label: 'Fees', href: '/dashboard/payments', scope: 'student' },
  { label: 'Fees', href: '/dashboard/payments', scope: 'guardian' },
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
    lmsNavItems.push({ label: 'Lessons', href: '/dashboard/lms' })
  }
  if (lmsAccess.isFacilitator || lmsAccess.isManager) {
    lmsNavItems.push({ label: "Today's lessons", href: '/dashboard/lms/today' })
  }
  if (hasRecordedLesson) {
    lmsNavItems.push({ label: 'My lessons', href: '/dashboard/lms/my-lessons' })
  }
  if (canSeeQuestions) {
    lmsNavItems.push({
      label: 'Questions',
      href: '/dashboard/lms/questions',
      badge: questionsBadge,
    })
  }
  if (lmsAccess.isManager) {
    lmsNavItems.push({ label: 'Video storage', href: '/dashboard/lms/storage' })
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