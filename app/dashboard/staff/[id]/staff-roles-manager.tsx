/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useTransition } from 'react'
import { assignRole, removeRole } from './actions'
import { Lock, Shield, X, Loader2, Plus } from 'lucide-react'

export type RoleItem = {
  id: string
  name: string
  description?: string | null
  is_system: boolean
}

export type StaffRolesManagerProps = {
  userId: string
  currentRoles: RoleItem[]
  assignableRoles: RoleItem[]
  canManageRoles: boolean
  currentUserId: string
}

export default function StaffRolesManager({
  userId,
  currentRoles,
  assignableRoles,
  canManageRoles,
  currentUserId,
}: StaffRolesManagerProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activeActionRoleId, setActiveActionRoleId] = useState<string | null>(null)

  if (!canManageRoles) {
    return null
  }

  const assignedRoleIds = new Set(currentRoles.map((r) => r.id))
  const unassignedRoles = assignableRoles.filter((r) => !assignedRoleIds.has(r.id))

  function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoleId || isPending) return
    setError(null)
    const roleIdToAssign = selectedRoleId

    startTransition(async () => {
      setActiveActionRoleId(roleIdToAssign)
      try {
        const res = await assignRole(userId, roleIdToAssign)
        if (res?.error) {
          setError(res.error)
        } else {
          setSelectedRoleId('')
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to assign role.')
      } finally {
        setActiveActionRoleId(null)
      }
    })
  }

  function handleRemove(roleId: string, roleName: string) {
    if (isPending) return
    setError(null)

    if (userId === currentUserId && roleName.toLowerCase() === 'admin') {
      setError('You cannot remove your own admin role.')
      return
    }

    startTransition(async () => {
      setActiveActionRoleId(roleId)
      try {
        const res = await removeRole(userId, roleId)
        if (res?.error) {
          setError(res.error)
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to remove role.')
      } finally {
        setActiveActionRoleId(null)
      }
    })
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-text-secondary" />
          <h3 className="text-sm font-medium text-text-primary">Roles &amp; Permissions</h3>
        </div>
        <span className="text-xs text-text-muted">
          {currentRoles.length} {currentRoles.length === 1 ? 'role' : 'roles'} assigned
        </span>
      </div>

      {error && (
        <div className="flex items-start justify-between bg-danger-bg border border-red-200 rounded-lg p-3 text-xs text-danger-text">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-danger-text hover:text-red-800 ml-2 font-medium"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Current roles list */}
      <div>
        <p className="text-xs text-text-secondary mb-2 font-medium">Assigned Roles</p>
        {currentRoles.length === 0 ? (
          <p className="text-xs text-text-muted italic">No roles assigned to this staff member yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {currentRoles.map((role) => {
              const isRolePending = isPending && activeActionRoleId === role.id
              return (
                <span
                  key={role.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    role.is_system
                      ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                      : 'bg-surface-muted text-text-primary border-border'
                  }`}
                >
                  {role.is_system && (
                    <span title="System Role">
                      <Lock size={11} className="text-purple-600 dark:text-purple-400 shrink-0" />
                    </span>
                  )}
                  <span className="capitalize">{role.name.replace('_', ' ')}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(role.id, role.name)}
                    disabled={isPending}
                    title={`Remove ${role.name.replace('_', ' ')}`}
                    className="ml-0.5 rounded-full p-0.5 text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                  >
                    {isRolePending ? (
                      <Loader2 size={12} className="animate-spin text-text-secondary" />
                    ) : (
                      <X size={12} />
                    )}
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Assign new role */}
      {unassignedRoles.length > 0 ? (
        <form onSubmit={handleAssign} className="pt-2 border-t border-border flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={isPending}
              className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            >
              <option value="">Select a role to assign…</option>
              {unassignedRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name.replace('_', ' ')} {r.is_system ? '🔒 (System Role)' : ''}
                  {r.description ? ` — ${r.description}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!selectedRoleId || isPending}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isPending && activeActionRoleId === selectedRoleId ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Plus size={13} />
            )}
            Assign Role
          </button>
        </form>
      ) : (
        <p className="text-xs text-text-muted pt-2 border-t border-border">
          All available roles have been assigned to this staff member.
        </p>
      )}
    </section>
  )
}
