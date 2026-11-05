/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateStaff } from '@/app/dashboard/staff/actions'
import { CustomFieldInputs } from '@/components/custom-fields'
import StaffRolesField, { RoleItem } from '../../staff-roles-field'
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
    .select('id, staff_no, first_name, last_name, email, phone, department_id, qualification, employment_date, status, profile_id, school_id')
    .eq('id', id)
    .single()

  if (fetchError || !staff) notFound()

  const [{ data: departments }, { data: customFields }, { data: roles }, { data: userRoleRows }] =
    await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase
        .from('custom_field_definitions')
        .select('id, field_key, label, field_type, options, is_required')
        .eq('entity_type', 'staff')
        .order('sort_order'),
      (supabase as any)
        .from('roles')
        .select('id, name, description, is_system')
        .or(`school_id.eq.${staff.school_id},and(school_id.is.null,is_system.eq.true)`)
        .order('is_system', { ascending: false })
        .order('name'),
      staff.profile_id
        ? (supabase as any)
            .from('user_roles')
            .select('role_id, roles(id, name, description, is_system)')
            .eq('user_id', staff.profile_id)
            .eq('school_id', staff.school_id)
        : Promise.resolve({ data: [] }),
    ])

  const currentRoles: RoleItem[] = (userRoleRows ?? [])
    .map((ur: any) => ur.roles)
    .filter(Boolean)

  const { data: fieldValues } = await supabase.from('custom_field_values').select('definition_id, value').eq('entity_id', id)
  const valuesByKey: Record<string, string> = {}
  for (const def of customFields ?? []) {
    const match = fieldValues?.find((v) => v.definition_id === def.id)
    if (match) valuesByKey[def.field_key] = match.value as string
  }

  const updateStaffWithId = updateStaff.bind(null, id)

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 max-w-2xl">
      <Link href={`/dashboard/staff/${id}`} className="inline-flex w-fit items-center gap-1 text-sm text-text-secondary hover:text-text-primary">← Back to staff member
      </Link>
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] mt-4 mb-6">Edit Staff</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateStaffWithId} className="space-y-5">
        <div className="card p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Phone Number</label>
              <input name="phone" type="tel" defaultValue={staff.phone ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email Address</label>
              <input name="email" type="email" defaultValue={staff.email ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <CustomFieldInputs definitions={customFields as any} initialValues={valuesByKey} />
          )}
        </div>

        <StaffRolesField initialRoles={currentRoles} assignableRoles={roles ?? []} />

        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  )
}