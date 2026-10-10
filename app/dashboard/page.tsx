export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GuardianDashboard } from './_components/guardian-dashboard'
import { SetupChecklist } from './_components/setup-checklist'
import { getMyAccessContext } from '@/lib/permissions'
import { AdminDashboard } from './_components/admin-dashboard'
import { RoleAwareDashboard } from './_components/role-aware-dashboard'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; term?: string; tab?: string; attScope?: string }>
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

  const ctx = await getMyAccessContext(supabase)
  if (ctx.permissions.has('school.manage')) {
    return <AdminDashboard />
  }
  return <RoleAwareDashboard />
}