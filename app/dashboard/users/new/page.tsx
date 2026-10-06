import { createClient } from '@/lib/supabase/server'
import { inviteUser } from '@/app/dashboard/users/actions'
import Link from 'next/link'

export default async function InviteUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user!.id).single()

const { data: roles } = await supabase
  .from('roles')
  .select('id, name')
  .or(`school_id.is.null,school_id.eq.${profile?.school_id}`)
  .order('name')

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href="/dashboard/users" className="text-sm text-primary hover:text-primary-hover">← Back to users</Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Invite User</h1>

      {error && <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <form action={inviteUser} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">First Name *</label>
            <input name="first_name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Last Name *</label>
            <input name="last_name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Email *</label>
          <input name="email" type="email" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Role *</label>
          <select name="role_id" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select...</option>
            {roles?.map((r) => <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>)}
          </select>
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Send Invite
        </button>
      </form>
    </div>
  )
}