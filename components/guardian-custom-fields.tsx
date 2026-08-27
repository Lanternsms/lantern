'use client'

type FieldDefinition = {
  id: string
  field_key: string
  label: string
  field_type: string
  options: string[] | null
  is_required: boolean
}

export function GuardianCustomFields({
  definitions,
  initialValues = {},
  index,
}: {
  definitions: FieldDefinition[]
  initialValues?: Record<string, string>
  index: number
}) {
  if (definitions.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4 pt-2">
      {definitions.map((def) => (
        <div key={def.id}>
          <label className="block text-xs text-text-secondary mb-1">
            {def.label}{def.is_required && <span className="text-danger-text"> *</span>}
          </label>

          {def.field_type === 'select' ? (
            <select
              name={`custom_${def.field_key}`}
              defaultValue={initialValues[def.field_key] ?? ''}
              className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select...</option>
              {def.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : def.field_type === 'boolean' ? (
            // Unique name per ROW (not just per field) — radio buttons
            // sharing a name are one group across the WHOLE form, so
            // without the index suffix, guardian 1's "Yes" and guardian
            // 2's "No" would fight over the same group.
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="radio"
                  name={`custom_${def.field_key}__${index}`}
                  value="true"
                  defaultChecked={initialValues[def.field_key] === 'true'}
                  className="border-border"
                />
                Yes
              </label>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="radio"
                  name={`custom_${def.field_key}__${index}`}
                  value="false"
                  defaultChecked={initialValues[def.field_key] !== 'true'}
                  className="border-border"
                />
                No
              </label>
            </div>
          ) : (
            <input
              name={`custom_${def.field_key}`}
              type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text'}
              defaultValue={initialValues[def.field_key] ?? ''}
              className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      ))}
    </div>
  )
}