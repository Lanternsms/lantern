import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Lock } from 'lucide-react'

export default async function RolesPage() {
  const supabase = await createClient()

  const { data: roles, error } = await supabase
  .from('roles')
  .select('id, name, description, is_system, role_permissions(permission_id)')
  .order('is_system', { ascending: false })
  .order('name')

  if (error) {
  return (
    <div className="px-8 py-8">
      <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
        Error loading roles: {error.message}
      </p>
    </div>
  )
}

  const systemRoles = roles?.filter((r) => r.is_system) ?? []
  const customRoles = roles?.filter((r) => !r.is_system) ?? []

  return (
    <div className="px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Roles &amp; Permissions</h1>
          <p className="text-sm text-text-secondary mt-1">
            System roles are shared across every school and can&apos;t be edited. Create your own custom roles below.
          </p>
        </div>
        <Link href="/dashboard/roles/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          + Add Custom Role
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-text-secondary mb-3">System Roles</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {systemRoles.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/roles/${r.id}`} className="flex items-center gap-2 text-text-primary font-medium hover:text-primary capitalize">
                      <Lock size={13} className="text-text-muted" />
                      {r.name.replace('_', ' ')}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{r.description}</td>
                  <td className="px-4 py-3 text-text-muted text-right">{r.role_permissions?.length ?? 0} permissions</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-secondary mb-3">Custom Roles</h2>
        {customRoles.length > 0 ? (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {customRoles.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/roles/${r.id}`} className="text-text-primary font-medium hover:text-primary">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.description ?? '—'}</td>
                    <td className="px-4 py-3 text-text-muted text-right">{r.role_permissions?.length ?? 0} permissions</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No custom roles yet.</p>
        )}
      </section>
    </div>
  )
}