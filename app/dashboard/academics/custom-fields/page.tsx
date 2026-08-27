import { createClient } from '@/lib/supabase/server'
import { updateCustomField, deleteCustomField } from '@/app/dashboard/academics/custom-fields/actions'
import { CustomFieldForm } from '@/components/custom-field-form'
import { TabView } from '@/components/tab-view'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes/No',
  select: 'Dropdown',
}

export default async function CustomFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: allFields } = await supabase
    .from('custom_field_definitions')
    .select('id, entity_type, label, field_type, is_required, options')
    .order('sort_order')

  function entityTab(entityType: string, entityLabel: string) {
    const fields = allFields?.filter((f) => f.entity_type === entityType) ?? []

    return (
      <div>
        {fields.length > 0 ? (
          <div className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Label</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Required</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3" colSpan={4}>
                      <div className="flex items-center gap-3">
                        <form action={updateCustomField} className="flex items-center gap-3 flex-1">
                          <input type="hidden" name="field_id" value={f.id} />
                          <input
                            name="label"
                            defaultValue={f.label}
                            className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <span className="text-xs text-text-secondary whitespace-nowrap px-2">
                            {FIELD_TYPE_LABELS[f.field_type]}
                          </span>
                          <label className="flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap">
                            <input type="checkbox" name="is_required" defaultChecked={f.is_required} className="rounded border-border" />
                            Required
                          </label>
                          <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium whitespace-nowrap">
                            Save
                          </button>
                        </form>
                        <form action={deleteCustomField}>
                          <input type="hidden" name="field_id" value={f.id} />
                          <button type="submit" className="text-text-secondary hover:text-danger-text">
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary mb-6">No custom fields defined yet for {entityLabel}.</p>
        )}

        <section className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">Add Field</h3>
          <CustomFieldForm entityType={entityType} />
        </section>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Custom Fields
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Custom Fields</h1>
      <p className="text-sm text-text-secondary mb-6">
        Add extra fields to student, staff, or guardian records — no code changes required.
      </p>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <TabView
        tabs={[
          { id: 'student', label: 'Students', content: entityTab('student', 'students') },
          { id: 'staff', label: 'Staff', content: entityTab('staff', 'staff') },
          { id: 'guardian', label: 'Guardians', content: entityTab('guardian', 'guardians') },
        ]}
      />
    </div>
  )
}