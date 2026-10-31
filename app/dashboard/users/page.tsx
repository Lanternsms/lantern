import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, user_roles(roles(name))')
    .order('first_name')

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Users</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Everyone with portal access at your school.</p>
        </div>
        <Link href="/dashboard/users/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
          + Invite User
        </Link>
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">Couldn’t load this: {error.message}</p>}

      {users && users.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Name</th>
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5 text-text-primary font-medium">{u.first_name} {u.last_name}</td>
                  <td className="px-5 py-3.5 text-text-secondary capitalize">
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