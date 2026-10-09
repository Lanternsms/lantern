import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { getMyAccessContext, canSee, type NavGate } from '@/lib/permissions'
import { ThemeStyle } from './_components/theme-style'

type NavItem = { label: string; href: string } & NavGate

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',         href: '/dashboard'},
  { label: 'Students',          href: '/dashboard/students',      permission: 'students.view_all' },
  { label: 'Guardians',         href: '/dashboard/guardians',     permission: 'students.view_all' },
  { label: 'Staff',             href: '/dashboard/staff',         permission: 'staff.view_all' },
  { label: 'Academics',         href: '/dashboard/academics',     permission: 'academic_structure.manage' },
  { label: 'Roles & Permissions', href: '/dashboard/roles',       permission: 'roles.manage' },
  { label: 'Gradebook',         href: '/dashboard/gradebook',     scope: 'teacher' },
  { label: 'Approvals',         href: '/dashboard/approvals',     scope: 'approver' },
  { label: 'Timetable',         href: '/dashboard/academics/timetable', permission: 'timetable.manage' },
  { label: 'My Timetable',      href: '/dashboard/my-timetable', scope: 'teacher' },
  { label: 'My Timetable',      href: '/dashboard/my-timetable', scope: 'student' },
  { label: 'Class Results',     href: '/dashboard/class-results', scope: 'teacher' },
  { label: 'Result Remarks',    href: '/dashboard/results/remarks', scope: 'teacher' },
  { label: 'My Submissions',    href: '/dashboard/my-submissions', scope: 'teacher' },
  { label: 'My Class',          href: '/dashboard/my-class',       scope: 'formTeacher' },
  { label: 'Results',           href: '/dashboard/results',       permission: 'results.view_all' },
  { label: 'My Results',        href: '/dashboard/my-results',    scope: 'student' },
  { label: 'Users',             href: '/dashboard/users',         permission: ['users.invite', 'users.edit', 'users.view_all'] },
  { label: 'Attendance', href: '/dashboard/attendance', permission: ['attendance.manage', 'attendance.view_all'] },
  { label: 'Mark Attendance', href: '/dashboard/attendance', scope: 'teacher' },
  { label: 'Attendance Categories', href: '/dashboard/attendance/settings', permission: 'settings.manage' },
  { label: 'Fee Structures', href: '/dashboard/fees/structures', permission: 'fees.manage' },
  { label: 'Record Payment', href: '/dashboard/fees/record', permission: 'fees.manage' },
  { label: 'My Payments', href: '/dashboard/payments', scope: 'student' },
  { label: 'Payments', href: '/dashboard/payments', scope: 'guardian' },
  // Items with no gate are visible to all authenticated users
  { label: 'Announcements',     href: '/dashboard/announcements' },
  { label: 'Documents',         href: '/dashboard/documents' },
  { label: 'Communication',     href: '/dashboard/communication' },
  // last item on the navbar with gated permission
  { label: 'Settings', href: '/dashboard/settings', permission: 'school.manage' }
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, school, ctx] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single(),
    supabase.from('schools').select('name, logo_url').single(),
    getMyAccessContext(supabase),
  ])

  const visibleItems = ALL_NAV_ITEMS.filter((item) => canSee(ctx, item))

  return (
    <DashboardShell
      firstName={profile.data?.first_name ?? ''}
      lastName={profile.data?.last_name ?? ''}
      schoolName={school.data?.name ?? ''}
      logoUrl={school.data?.logo_url ?? null}
      navItems={visibleItems}
    >
      <ThemeStyle />
      {children}
    </DashboardShell>
  )
}