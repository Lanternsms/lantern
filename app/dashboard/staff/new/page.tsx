import { createClient } from '@/lib/supabase/server'
import { createStaff } from '@/app/dashboard/staff/actions'
import { CustomFieldInputs } from '@/components/custom-fields'
import Link from 'next/link'

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: departments } = await supabase.from('departments').select('id, name').order('name')
  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'staff')
    .order('sort_order')

  return (
    <div className="px-8 py-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/staff" className="hover:text-primary">Staff</Link> / Add Staff
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-6">Add Staff</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createStaff} className="bg-surface border border-border rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">First Name *</label>
            <input name="first_name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Last Name *</label>
            <input name="last_name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Staff Number *</label>
          <input name="staff_no" required placeholder="e.g. GSS/STF/014" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Phone Number</label>
            <input name="phone" type="tel" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
            <input name="email" type="email" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Department</label>
            <select name="department_id" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select...</option>
              {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Employment Date</label>
            <input name="employment_date" type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Qualification</label>
          <input name="qualification" placeholder="e.g. B.Sc Mathematics" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {customFields && customFields.length > 0 && (
          <CustomFieldInputs definitions={customFields} />
        )}

        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Add Staff
        </button>
      </form>
    </div>
  )
}