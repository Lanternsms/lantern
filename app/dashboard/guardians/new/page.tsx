import { createGuardian } from '@/app/dashboard/guardians/actions'
import { createClient } from '@/lib/supabase/server'
import { CustomFieldInputs } from '@/components/custom-fields'
import Link from 'next/link'

export default async function NewGuardianPage({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string; error?: string }>
}) {
  const { student_id, error } = await searchParams

  if (!student_id) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">This form must be opened from a student&apos;s profile.</p>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'guardian')
    .order('sort_order')

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href={`/dashboard/students/${student_id}`} className="text-sm text-primary hover:text-primary-hover">
        ← Back to student
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Add Guardian</h1>

      <p className="text-sm text-text-secondary mb-4">
        Already have this guardian on file for another child?{' '}
        <Link href={`/dashboard/guardians?student_id=${student_id}`} className="text-primary hover:text-primary-hover">
          Search existing guardians
        </Link>{' '}
        instead — entering the same name here will automatically reuse their existing record.
      </p>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createGuardian} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <input type="hidden" name="student_id" value={student_id} />

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Guardian Full Name *</label>
          <input name="full_name" required placeholder="e.g. Mrs. Ngozi Okafor" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Relationship</label>
          <select name="relationship" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select...</option>
            <option value="father">Father</option>
            <option value="mother">Mother</option>
            <option value="guardian">Guardian</option>
          </select>
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

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Address</label>
          <input name="address" placeholder="Street, area, city" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {customFields && customFields.length > 0 && (
          <CustomFieldInputs definitions={customFields} />
        )}

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" name="is_primary_contact" className="rounded border-border" />
          Set as primary contact
        </label>

        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Add Guardian
        </button>
      </form>
    </div>
  )
}