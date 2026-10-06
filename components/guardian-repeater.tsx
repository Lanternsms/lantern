'use client'

import { useState } from 'react'
import { Plus, Trash2, Link2, UserPlus } from 'lucide-react'
import { GuardianCustomFields } from '@/components/guardian-custom-fields'

type FieldDefinition = {
  id: string
  field_key: string
  label: string
  field_type: string
  options: string[] | null
  is_required: boolean
}

type ExistingGuardian = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  relationship: string | null
}

type GuardianEntry = { mode: 'new' | 'existing' }

export function GuardianRepeater({
  customFieldDefs = [],
  existingGuardians = [],
}: {
  customFieldDefs?: FieldDefinition[]
  existingGuardians?: ExistingGuardian[]
}) {
  const [entries, setEntries] = useState<GuardianEntry[]>([{ mode: 'new' }])

  function addEntry() {
    setEntries((prev) => [...prev, { mode: existingGuardians.length > 0 ? 'existing' : 'new' }])
  }

  function removeEntry() {
    setEntries((prev) => prev.slice(0, -1))
  }

  function setMode(i: number, mode: 'new' | 'existing') {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, mode } : e)))
  }

  const inputCls =
    'w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="space-y-6">
      {entries.map((entry, i) => (
        <div key={i} className={i > 0 ? 'pt-6 border-t border-border' : ''}>
          {/* Header row: label + mode toggle */}
          <div className="flex items-center justify-between mb-3">
            {i > 0 ? (
              <span className="text-xs font-medium text-text-secondary">Guardian {i + 1}</span>
            ) : (
              <span />
            )}

            {existingGuardians.length > 0 && (
              <button
                type="button"
                onClick={() => setMode(i, entry.mode === 'existing' ? 'new' : 'existing')}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
              >
                {entry.mode === 'existing' ? (
                  <><UserPlus size={13} /> Add new guardian</>
                ) : (
                  <><Link2 size={13} /> Link existing guardian</>
                )}
              </button>
            )}
          </div>

          {entry.mode === 'existing' ? (
            /* ── Link-existing mode ─────────────────────────────────────── */
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-text-secondary mb-1.5">
                  Select Guardian {i === 0 && <span className="text-danger-text">*</span>}
                </label>
                <select
                  name="guardian_existing_id"
                  className={inputCls}
                  defaultValue=""
                >
                  <option value="" disabled>Choose an existing guardian…</option>
                  {existingGuardians.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.first_name} {g.last_name}
                      {g.phone ? ` · ${g.phone}` : ''}
                    </option>
                  ))}
                </select>
                {/* Relationship override when linking */}
                <div className="mt-3">
                  <label className="block text-sm text-text-secondary mb-1.5">
                    Relationship to this student
                  </label>
                  <select name="guardian_relationship" className={inputCls}>
                    <option value="">Select relationship</option>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="guardian">Guardian</option>
                  </select>
                </div>
                {/*
                  Emit empty placeholders so the parallel arrays in the
                  action stay aligned (one slot per guardian entry).
                */}
                <input type="hidden" name="guardian_full_name" value="" />
                <input type="hidden" name="guardian_phone" value="" />
                <input type="hidden" name="guardian_email" value="" />
                <input type="hidden" name="guardian_address" value="" />
              </div>
            </div>
          ) : (
            /* ── Add-new mode ───────────────────────────────────────────── */
            <>
              {/* Hidden sentinel so the action knows this slot has no existing id */}
              <input type="hidden" name="guardian_existing_id" value="" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">
                    Guardian Full Name {i === 0 && <span className="text-danger-text">*</span>}
                  </label>
                  <input
                    name="guardian_full_name"
                    required={i === 0}
                    placeholder="e.g. Mrs. Ngozi Okafor"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Relationship</label>
                  <select name="guardian_relationship" className={inputCls}>
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
                    required={i === 0}
                    placeholder="+234 800 000 0000"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
                  <input
                    name="guardian_email"
                    type="email"
                    placeholder="Optional"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-text-secondary mb-1.5">Address</label>
                  <input
                    name="guardian_address"
                    placeholder="Street, area, city"
                    className={inputCls}
                  />
                </div>
              </div>
              <GuardianCustomFields definitions={customFieldDefs} index={i} />
            </>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover"
        >
          <Plus size={16} />
          Add another guardian
        </button>

        {entries.length > 1 && (
          <button
            type="button"
            onClick={removeEntry}
            className="flex items-center gap-2 text-sm text-danger-text hover:text-red-700"
          >
            <Trash2 size={16} />
            Remove guardian
          </button>
        )}
      </div>
    </div>
  )
}