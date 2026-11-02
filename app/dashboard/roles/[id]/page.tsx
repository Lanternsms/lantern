import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateRole, deleteRole, grantPermission, revokePermission } from '@/app/dashboard/roles/actions'
import { groupPermissions } from '@/lib/permission-groups'
import Link from 'next/link'
import { Lock, Trash2, Check } from '@/components/icons'

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: role, error: fetchError } = await supabase
    .from('roles')
    .select('id, name, description, is_system')
    .eq('id', id)
    .single()

  if (fetchError || !role) notFound()

  const { data: allPermissions } = await supabase.from('permissions').select('id, code, description').order('code')
  const { data: rolePermissions } = await supabase.from('role_permissions').select('permission_id').eq('role_id', id)

  const grantedIds = new Set((rolePermissions ?? []).map((rp) => rp.permission_id))
  const grouped = groupPermissions(allPermissions ?? [])

  const { count: assignedUserCount } = await supabase
    .from('user_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role_id', id)

  const updateRoleWithId = updateRole.bind(null, id)

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 max-w-3xl">
      <Link href="/dashboard/roles" className="inline-flex w-fit items-center gap-1 text-sm text-text-secondary hover:text-text-primary">← Back to roles
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] capitalize">{role.name.replace('_', ' ')}</h1>
          {role.is_system && (
            <span className="flex items-center gap-1 text-xs font-medium bg-raised text-[#374151] rounded-full px-2.5 py-0.5">
              <Lock size={11} /> System Role
            </span>
          )}
        </div>
        {!role.is_system && assignedUserCount === 0 && (
          <form action={deleteRole}>
            <input type="hidden" name="role_id" value={id} />
            <button type="submit" className="flex items-center gap-1.5 text-sm text-danger-text border border-danger-bg rounded-lg px-4 py-2 hover:bg-danger-bg transition-colors">
              <Trash2 size={14} /> Delete Role
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {assignedUserCount !== null && assignedUserCount > 0 && !role.is_system && (
        <p className="text-xs text-text-muted mb-4">
          Assigned to {assignedUserCount} user(s), so it can&apos;t be deleted right now.
        </p>
      )}

      {!role.is_system ? (
        <form action={updateRoleWithId} className="card p-5 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Role Name *</label>
              <input name="name" defaultValue={role.name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Description</label>
              <input name="description" defaultValue={role.description ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
            Save Details
          </button>
        </form>
      ) : (
        <p className="text-sm text-text-secondary mb-6">{role.description}</p>
      )}

      <h2 className="text-sm font-semibold text-text-primary mb-3">Permissions</h2>

      <div className="space-y-4">
        {grouped.map((group) => (
          <section key={group.label} className="card p-5">
            <h3 className="text-sm font-medium text-text-primary mb-3">{group.label}</h3>
            <div className="space-y-2">
              {group.permissions.map((p) => {
                const isGranted = grantedIds.has(p.id)
                return (
                  <div key={p.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm text-text-primary">{p.code}</p>
                      <p className="text-xs text-text-secondary">{p.description}</p>
                    </div>
                    {role.is_system ? (
                      isGranted && (
                        <span className="flex items-center gap-1 text-xs text-success-text">
                          <Check size={14} /> Granted
                        </span>
                      )
                    ) : isGranted ? (
                      <form action={revokePermission}>
                        <input type="hidden" name="role_id" value={id} />
                        <input type="hidden" name="permission_id" value={p.id} />
                        <button type="submit" className="text-xs text-danger-text hover:text-danger-text font-medium">
                          Revoke
                        </button>
                      </form>
                    ) : (
                      <form action={grantPermission}>
                        <input type="hidden" name="role_id" value={id} />
                        <input type="hidden" name="permission_id" value={p.id} />
                        <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium">
                          Grant
                        </button>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}