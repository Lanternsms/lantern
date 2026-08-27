import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateStaff } from '@/app/dashboard/staff/actions'
import { CustomFieldInputs } from '@/components/custom-fields'
import Link from 'next/link'

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: staff, error: fetchError } = await supabase
    .from('staff')
    .select('id, staff_no, first_name, last_name, email, phone, department_id, qualification, employment_date, status')
    .eq('id', id)
    .single()

  if (fetchError || !staff) notFound()

  const { data: departments } = await supabase.from('departments').select('id, name').order('name')
  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'staff')
    .order('sort_order')

  const { data: fieldValues } = await supabase.from('custom_field_values').select('definition_id, value').eq('entity_id', id)
  const valuesByKey: Record<string, string> = {}
  for (const def of customFields ?? []) {
    const match = fieldValues?.find((v) => v.definition_id === def.id)
    if (match) valuesByKey[def.field_key] = match.value as string
  }

  const updateStaffWithId = updateStaff.bind(null, id)

  return (
    <div className="px-8 py-8 max-w-2xl">
      <Link href={`/dashboard/staff/${id}`} className="text-sm text-primary hover:text-primary-hover">
        ← Back to staff member
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Edit Staff</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateStaffWithId} className="bg-surface border border-border rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">First Name *</label>
            <input name="first_name" defaultValue={staff.first_name ?? ''} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Last Name *</label>
            <input name="last_name" defaultValue={staff.last_name ?? ''} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Staff Number</label>
          <input
            defaultValue={staff.staff_no}
            disabled
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-muted text-text-muted cursor-not-allowed"
          />
          <p className="text-xs text-text-muted mt-1">Staff number cannot be changed after creation.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Phone Number</label>
            <input name="phone" type="tel" defaultValue={staff.phone ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
            <input name="email" type="email" defaultValue={staff.email ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Department</label>
            <select name="department_id" defaultValue={staff.department_id ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select...</option>
              {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Employment Date</label>
            <input name="employment_date" type="date" defaultValue={staff.employment_date ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Qualification</label>
          <input name="qualification" defaultValue={staff.qualification ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Status</label>
          <select name="status" defaultValue={staff.status} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        {customFields && customFields.length > 0 && (
          <CustomFieldInputs definitions={customFields} initialValues={valuesByKey} />
        )}

        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  )
}