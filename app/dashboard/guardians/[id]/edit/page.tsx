import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateGuardian } from '@/app/dashboard/guardians/actions'
import { CustomFieldInputs } from '@/components/custom-fields'
import Link from 'next/link'
import { User, Users } from 'lucide-react'

export default async function EditGuardianPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: guardian, error: fetchError } = await supabase
    .from('guardians')
    .select('id, first_name, last_name, relationship, phone, email, address')
    .eq('id', id)
    .single()

  if (fetchError || !guardian) notFound()

  const { data: links } = await supabase
    .from('student_guardians')
    .select('is_primary_contact, students(id, first_name, last_name, admission_no)')
    .eq('guardian_id', id)

  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'guardian')
    .order('sort_order')

  const { data: fieldValues } = await supabase
    .from('custom_field_values')
    .select('definition_id, value')
    .eq('entity_id', id)

  const valuesByKey: Record<string, string> = {}
  for (const def of customFields ?? []) {
    const match = fieldValues?.find((v) => v.definition_id === def.id)
    if (match) valuesByKey[def.field_key] = match.value as string
  }

  const initials = `${guardian.first_name[0]}${guardian.last_name[0]}`
  const updateGuardianWithId = updateGuardian.bind(null, id)

  return (
    <div className="px-8 py-8 max-w-2xl">
      <Link href={`/dashboard/guardians/${id}`} className="text-sm text-primary hover:text-primary-hover">
        ← Back to guardian
      </Link>

      <div className="flex items-center gap-3 mt-4 mb-6">
        <span className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
          {initials}
        </span>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Edit Guardian</h1>
          <p className="text-xs text-text-secondary mt-0.5">{guardian.first_name} {guardian.last_name}</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateGuardianWithId} className="space-y-4">
        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-primary">Contact Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">First Name *</label>
              <input name="first_name" defaultValue={guardian.first_name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Last Name *</label>
              <input name="last_name" defaultValue={guardian.last_name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Relationship</label>
              <select name="relationship" defaultValue={guardian.relationship ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select...</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Phone Number</label>
              <input name="phone" type="tel" defaultValue={guardian.phone ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
              <input name="email" type="email" defaultValue={guardian.email ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1.5">Address</label>
              <input name="address" defaultValue={guardian.address ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </section>

        {customFields && customFields.length > 0 && (
          <section className="bg-surface border border-border rounded-xl p-5">
            <CustomFieldInputs definitions={customFields} initialValues={valuesByKey} />
          </section>
        )}

        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-primary">Linked Students</h3>
          </div>
          {links && links.length > 0 ? (
            <div className="space-y-1">
              {links.map((link, i) => (
                <p key={i} className="text-sm text-text-secondary py-1">
                  {link.students?.first_name} {link.students?.last_name} · {link.students?.admission_no}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Not linked to any students yet.</p>
          )}
          <p className="text-xs text-text-muted mt-3">
            To change which students this guardian is linked to, edit the student directly.
          </p>
        </section>

        <div className="flex justify-end gap-3">
          <Link href={`/dashboard/guardians/${id}`} className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
            Cancel
          </Link>
          <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}