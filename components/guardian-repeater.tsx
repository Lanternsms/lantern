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

export function GuardianRepeater({ customFieldDefs = [] }: { customFieldDefs?: FieldDefinition[] }) {
  const [count, setCount] = useState(1)

  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={i > 0 ? 'pt-6 border-t border-border' : ''}>
          {i > 0 && (
            <span className="block text-xs font-medium text-text-secondary mb-3">
              Guardian {i + 1}
            </span>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Guardian Full Name {i === 0 && <span className="text-danger-text">*</span>}
              </label>
              <input
                name="guardian_full_name"
                required={i === 0}
                placeholder="e.g. Mrs. Ngozi Okafor"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Relationship</label>
              <select
                name="guardian_relationship"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
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
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
              <input
                name="guardian_email"
                type="email"
                placeholder="Optional"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1.5">Address</label>
              <input
                name="guardian_address"
                placeholder="Street, area, city"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <GuardianCustomFields definitions={customFieldDefs} index={i} />
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setCount(count + 1)}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover"
        >
          <Plus size={16} />
          Add another guardian
        </button>

        {count > 1 && (
          <button
            type="button"
            onClick={() => setCount(count - 1)}
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