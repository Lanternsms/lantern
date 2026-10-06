import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, user_roles(roles(name))')
    .order('first_name')

  return (
    <div className="px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-1">Everyone with portal access at your school.</p>
        </div>
        <Link href="/dashboard/users/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          + Invite User
        </Link>
      </div>

      {error && <p className="text-sm text-danger-text">Error: {error.message}</p>}

      {users && users.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text-primary font-medium">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-3 text-text-secondary capitalize">
                    {u.user_roles?.map((ur) => ur.roles?.name?.replace('_', ' ')).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}