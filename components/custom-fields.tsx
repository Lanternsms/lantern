'use client'

type FieldDefinition = {
  id: string
  field_key: string
  label: string
  field_type: string
  options: string[] | null
  is_required: boolean
}

export function CustomFieldInputs({
  definitions,
  initialValues = {},
}: {
  definitions: FieldDefinition[]
  initialValues?: Record<string, string | boolean>
}) {
  if (definitions.length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-secondary">Additional Information</h3>
      {definitions.map((def) => (
        <div key={def.id}>
          <label className="block text-sm text-text-secondary mb-1.5">
            {def.label}{def.is_required && <span className="text-danger-text"> *</span>}
          </label>

          {def.field_type === 'select' ? (
            <select
              name={`custom_${def.field_key}`}
              defaultValue={(initialValues[def.field_key] as string) ?? ''}
              required={def.is_required}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select...</option>
              {def.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : def.field_type === 'boolean' ? (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                <input
                  type="radio"
                  name={`custom_${def.field_key}`}
                  value="true"
                  defaultChecked={initialValues[def.field_key] === true || initialValues[def.field_key] === 'true'}
                  className="border-border"
                />
                Yes
              </label>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                <input
                  type="radio"
                  name={`custom_${def.field_key}`}
                  value="false"
                  defaultChecked={
                    initialValues[def.field_key] === false ||
                    initialValues[def.field_key] === 'false' ||
                    initialValues[def.field_key] === undefined
                  }
                  className="border-border"
                />
                No
              </label>
            </div>
          ) : (
            <input
              name={`custom_${def.field_key}`}
              type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text'}
              defaultValue={(initialValues[def.field_key] as string) ?? ''}
              required={def.is_required}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      ))}
    </div>
  )
}