/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { Shield, Lock, X, Plus } from '@/components/icons'

export type RoleItem = {
  id: string
  name: string
  description?: string | null
  is_system?: boolean
}

export type StaffRolesFieldProps = {
  initialRoles?: RoleItem[]
  assignableRoles: RoleItem[]
  name?: string
}

export default function StaffRolesField({
  initialRoles = [],
  assignableRoles = [],
  name = 'role_ids',
}: StaffRolesFieldProps) {
  const [assignedRoles, setAssignedRoles] = useState<RoleItem[]>(initialRoles)
  const [selectedRoleId, setSelectedRoleId] = useState('')

  const assignedRoleIds = new Set(assignedRoles.map((r) => r.id))
  const unassignedRoles = assignableRoles.filter((r) => !assignedRoleIds.has(r.id))

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedRoleId) return
    const roleToAdd = assignableRoles.find((r) => r.id === selectedRoleId)
    if (roleToAdd && !assignedRoleIds.has(roleToAdd.id)) {
      setAssignedRoles([...assignedRoles, roleToAdd])
      setSelectedRoleId('')
    }
  }

  function handleRemove(roleId: string) {
    setAssignedRoles(assignedRoles.filter((r) => r.id !== roleId))
  }

  return (
    <section className="card p-5 space-y-4">
      {/* Hidden input to signal that the roles field was present */}
      <input type="hidden" name={`${name}_present`} value="true" />
      {/* Hidden inputs for each assigned role */}
      {assignedRoles.map((role) => (
        <input key={role.id} type="hidden" name={name} value={role.id} />
      ))}
      {/* Primary role fallback for single-role actions */}
      <input type="hidden" name="role_id" value={assignedRoles[0]?.id ?? ''} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-text-secondary" />
          <h3 className="text-sm font-medium text-text-primary">Roles &amp; Permissions</h3>
        </div>
        <span className="text-xs text-text-muted">
          {assignedRoles.length} {assignedRoles.length === 1 ? 'role' : 'roles'} assigned
        </span>
      </div>

      {/* Current roles list */}
      <div>
        <p className="text-xs text-text-secondary mb-2 font-medium">Assigned Roles</p>
        {assignedRoles.length === 0 ? (
          <p className="text-xs text-text-muted italic">No roles assigned to this staff member yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignedRoles.map((role) => (
              <span
                key={role.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  role.is_system
                    ? 'bg-school-soft text-school-ink border-school-track dark:bg-school-ink dark:text-school dark:border-primary'
                    : 'bg-surface-muted text-text-primary border-border'
                }`}
              >
                {role.is_system && (
                  <span title="System Role">
                    <Lock size={11} className="text-school-ink dark:text-school shrink-0" />
                  </span>
                )}
                <span className="capitalize">{role.name.replace('_', ' ')}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(role.id)}
                  title={`Remove ${role.name.replace('_', ' ')}`}
                  className="ml-0.5 rounded-full p-0.5 text-text-muted hover:text-danger-text hover:bg-danger-bg transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Assign new role */}
      {unassignedRoles.length > 0 ? (
        <div className="pt-2 border-t border-border flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="card w-full px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
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
            type="button"
            onClick={handleAdd}
            disabled={!selectedRoleId}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Plus size={13} />
            Assign Role
          </button>
        </div>
      ) : (
        <p className="text-xs text-text-muted pt-2 border-t border-border">
          All available roles have been assigned to this staff member.
        </p>
      )}
    </section>
  )
}
