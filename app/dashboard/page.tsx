export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GuardianDashboard } from './_components/guardian-dashboard'
import { StudentDashboard } from './_components/student-dashboard'
import { getMyAccessContext } from '@/lib/permissions'
import { AdminDashboard } from './_components/admin-dashboard'
import { RoleAwareDashboard } from './_components/role-aware-dashboard'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; student?: string; term?: string; tab?: string; attScope?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardianRow } = await supabase
    .from('guardians')
    .select('id, school_id, first_name, last_name, phone, email')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (guardianRow) {
    const sp = await searchParams
    return <GuardianDashboard guardianRow={guardianRow} searchParams={sp} />
  }

  // Check if logged-in user is a student
  const { data: studentRow } = await supabase
    .from('students')
    .select(`
      id, school_id, first_name, last_name, admission_no, photo_url, status, date_of_birth, gender,
      enrolments (
        class_id, arm_id, enrolment_date,
        classes ( name ),
        arms ( name ),
        academic_sessions ( name, is_current )
      )
    `)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (studentRow) {
    return <StudentDashboard student={studentRow} />
  }

  const ctx = await getMyAccessContext(supabase)
  if (ctx.permissions.has('school.manage')) {
    return <AdminDashboard />
  }
  return <RoleAwareDashboard />
}