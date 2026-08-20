import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user!.id)
    .single()

  return (
    <div className="px-8 py-8">
      <h1 className="text-xl font-semibold text-text-primary">
        Welcome, {profile?.first_name}
      </h1>
    </div>
  )
}