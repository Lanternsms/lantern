export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GuardianDashboard } from './_components/guardian-dashboard'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="px-8 py-8">
      <h1 className="text-xl font-semibold text-text-primary">
        Welcome, {profile?.first_name}
      </h1>
    </div>
  )
}