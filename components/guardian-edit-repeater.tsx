'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GuardianCustomFields } from '@/components/guardian-custom-fields'

type FieldDefinition = {
  id: string
  field_key: string
  label: string
  field_type: string
  options: string[] | null
  is_required: boolean
}

type GuardianRow = {
  guardian_id: string
  full_name: string
  relationship: string
  phone: string
  email: string
  address: string
  customValues: Record<string, string>
}

const emptyRow: GuardianRow = { guardian_id: '', full_name: '', relationship: '', phone: '', email: '', address: '', customValues: {} }

export function GuardianEditRepeater({
  initialGuardians,
  customFieldDefs = [],
}: {
  initialGuardians: GuardianRow[]
  customFieldDefs?: FieldDefinition[]
}) {
  const [rows, setRows] = useState<GuardianRow[]>(initialGuardians.length > 0 ? initialGuardians : [emptyRow])
  const [removedIds, setRemovedIds] = useState<string[]>([])

  function addRow() {
    setRows([...rows, { ...emptyRow }])
  }

  function removeRow() {
    const last = rows[rows.length - 1]
    if (last.guardian_id) setRemovedIds([...removedIds, last.guardian_id])
    setRows(rows.slice(0, -1))
  }

  return (
    <div className="space-y-6">
      {removedIds.map((id) => (
        <input key={id} type="hidden" name="removed_guardian_ids" value={id} />
      ))}

      {rows.map((row, i) => (
        <div key={i} className={i > 0 ? 'pt-6 border-t border-border' : ''}>
          {i > 0 && <span className="block text-xs font-medium text-text-secondary mb-3">Guardian {i + 1}</span>}
          <input type="hidden" name="guardian_id" value={row.guardian_id} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Guardian Full Name {i === 0 && <span className="text-danger-text">*</span>}
              </label>
              <input
                name="guardian_full_name"
                defaultValue={row.full_name}
                required={i === 0}
                placeholder="e.g. Mrs. Ngozi Okafor"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Relationship</label>
              <select name="guardian_relationship" defaultValue={row.relationship} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select relationship</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Phone Number {i === 0 && <span className="text-danger-text">*</span>}
              </label>
              <input
                name="guardian_phone"
                type="tel"
                defaultValue={row.phone}
                required={i === 0}
                placeholder="+234 800 000 0000"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
              <input
                name="guardian_email"
                type="email"
                defaultValue={row.email}
                placeholder="Optional"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1.5">Address</label>
              <input
                name="guardian_address"
                defaultValue={row.address}
                placeholder="Street, area, city"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <GuardianCustomFields definitions={customFieldDefs} initialValues={row.customValues} index={i} />
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={addRow} className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover">
          <Plus size={16} /> Add another guardian
        </button>
        {rows.length > 1 && (
          <button type="button" onClick={removeRow} className="flex items-center gap-2 text-sm text-danger-text hover:text-red-700">
            <Trash2 size={16} /> Remove guardian
          </button>
        )}
      </div>
    </div>
  )
}