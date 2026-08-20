import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell }  from '@/components/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const { data: school } = await supabase
    .from('schools')
    .select('name')
    .single()

  return (
    <DashboardShell
      firstName={profile?.first_name ?? ''}
      lastName={profile?.last_name ?? ''}
      schoolName={school?.name ?? ''}
    >
      {children}
    </DashboardShell>
  )
}