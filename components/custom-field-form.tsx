'use client'

import { useState } from 'react'
import { createCustomField } from '@/app/dashboard/academics/custom-fields/actions'

export function CustomFieldForm({ entityType }: { entityType: string }) {
  const [fieldType, setFieldType] = useState('text')

  return (
    <form action={createCustomField} className="space-y-4">
      <input type="hidden" name="entity_type" value={entityType} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Field Label *</label>
          <input
            name="label"
            required
            placeholder="e.g. Blood Group"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Field Type *</label>
          <select
            name="field_type"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Yes/No</option>
            <option value="select">Dropdown</option>
          </select>
        </div>
      </div>

      {fieldType === 'select' && (
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Dropdown Options</label>
          <textarea
            name="options"
            rows={4}
            placeholder={'One option per line, e.g.\nA+\nA-\nB+\nB-'}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="is_required" className="rounded border-border" />
        Required field
      </label>

      <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
        Add Field
      </button>
    </form>
  )
}