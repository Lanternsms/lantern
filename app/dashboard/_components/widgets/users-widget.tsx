import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function UsersWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id)

  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-text-primary">Users</h2>
        <Link href="/dashboard/users" className="text-xs font-medium text-primary hover:underline">Manage</Link>
      </div>
      <p className="text-2xl font-semibold text-text-primary">{(count ?? 0).toLocaleString()}</p>
    </div>
  )
}