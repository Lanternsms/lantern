import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateStudent } from '@/app/dashboard/students/actions'
import { CustomFieldInputs } from '@/components/custom-fields'
import { GuardianEditRepeater } from '@/components/guardian-edit-repeater'
import Link from 'next/link'
import { Camera } from 'lucide-react'

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('id, admission_no, first_name, middle_name, last_name, date_of_birth, gender, residential_address, status')
    .eq('id', id)
    .single()

  if (fetchError || !student) notFound()

  const { data: enrolment } = await supabase
    .from('enrolments')
    .select('class_id, arm_id, enrolment_date, academic_sessions!inner(name, is_current)')
    .eq('student_id', id)
    .eq('academic_sessions.is_current', true)
    .single()

  const { data: classes } = await supabase.from('classes').select('id, name').order('name')
  const { data: arms } = await supabase.from('arms').select('id, name, class_id').order('name')

  const { data: guardianLinks } = await supabase
    .from('student_guardians')
    .select('guardian_id, guardians(first_name, last_name, relationship, phone, email, address)')
    .eq('student_id', id)

  // The custom field DEFINITIONS for guardians (what fields exist)
  const { data: guardianCustomFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'guardian')
    .order('sort_order')

  // The actual VALUES entered for each linked guardian, fetched in one
  // batch query rather than one query per guardian.
  const guardianIds = (guardianLinks ?? []).map((l) => l.guardian_id)
  const { data: guardianFieldValues } =
    guardianIds.length > 0
      ? await supabase.from('custom_field_values').select('entity_id, definition_id, value').in('entity_id', guardianIds)
      : { data: [] }

  const initialGuardians = (guardianLinks ?? []).map((l) => {
    const customValues: Record<string, string> = {}
    for (const def of guardianCustomFields ?? []) {
      const match = guardianFieldValues?.find((v) => v.entity_id === l.guardian_id && v.definition_id === def.id)
      if (match) {
        // Booleans come back from JSONB as real true/false, not the
        // string 'true' — normalize so the repeater's string comparison
        // (initialValues[key] === 'true') actually matches on reload.
        customValues[def.field_key] = def.field_type === 'boolean' ? String(match.value) : (match.value as string)
      }
    }
    return {
      guardian_id: l.guardian_id,
      full_name: `${l.guardians?.first_name ?? ''} ${l.guardians?.last_name ?? ''}`.trim(),
      relationship: l.guardians?.relationship ?? '',
      phone: l.guardians?.phone ?? '',
      email: l.guardians?.email ?? '',
      address: l.guardians?.address ?? '',
      customValues,
    }
  })

  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'student')
    .order('sort_order')

  const { data: fieldValues } = await supabase.from('custom_field_values').select('definition_id, value').eq('entity_id', id)
  const valuesByKey: Record<string, string> = {}
  for (const def of customFields ?? []) {
    const match = fieldValues?.find((v) => v.definition_id === def.id)
    if (match) valuesByKey[def.field_key] = match.value as string
  }

  const updateStudentWithId = updateStudent.bind(null, id)

  return (
    <div className="px-8 py-8 max-w-3xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href={`/dashboard/students/${id}`} className="hover:text-primary">{student.first_name} {student.last_name}</Link> / Edit
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Edit Student</h1>
      <p className="text-sm text-text-secondary mb-6">Update this student&apos;s record.</p>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateStudentWithId} className="space-y-6">
        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Personal Information</h2>

          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2">Student Photo</label>
            <div className="border border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-center">
              <Camera size={22} className="text-text-muted" />
              <p className="text-sm text-text-secondary">Upload a clear profile photo</p>
              <p className="text-xs text-text-muted">Click or drag and drop · JPG, PNG up to 5MB</p>
              <button type="button" disabled title="Photo upload isn't wired up yet" className="mt-1 text-sm text-white bg-primary/50 rounded-lg px-4 py-2 cursor-not-allowed">
                Upload photo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">First Name <span className="text-danger-text">*</span></label>
              <input name="first_name" defaultValue={student.first_name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Middle Name</label>
              <input name="middle_name" defaultValue={student.middle_name ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Last Name <span className="text-danger-text">*</span></label>
              <input name="last_name" defaultValue={student.last_name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Date of Birth <span className="text-danger-text">*</span></label>
              <input name="date_of_birth" type="date" defaultValue={student.date_of_birth ?? ''} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Gender <span className="text-danger-text">*</span></label>
              <select name="gender" defaultValue={student.gender ?? ''} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Status</label>
              <select name="status" defaultValue={student.status} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="active">Active</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1.5">Residential Address</label>
              <input name="residential_address" defaultValue={student.residential_address ?? ''} placeholder="Street, area, city" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-primary">Guardian Information</h2>
          <p className="text-xs text-text-secondary mb-4">At least one guardian is required.</p>
          <GuardianEditRepeater initialGuardians={initialGuardians} customFieldDefs={guardianCustomFields ?? []} />
        </section>

        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Enrolment Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Academic Session</label>
              <input disabled value={enrolment?.academic_sessions?.name ?? '—'} className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-muted text-text-muted cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Class <span className="text-danger-text">*</span></label>
              <select name="class_id" defaultValue={enrolment?.class_id ?? ''} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select class</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Arm</label>
              <select name="arm_id" defaultValue={enrolment?.arm_id ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select arm</option>
                {arms?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Admission Number</label>
              <input disabled value={student.admission_no} className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-muted text-text-muted cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Enrolment Date</label>
              <input disabled value={enrolment?.enrolment_date ?? '—'} className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-muted text-text-muted cursor-not-allowed" />
            </div>
          </div>
        </section>

        {customFields && customFields.length > 0 && (
          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-sm font-semibold text-text-primary">Additional Information</h2>
            <p className="text-xs text-text-secondary mb-4">School-configured fields. These can be customised in your school settings.</p>
            <div className="grid grid-cols-2 gap-4">
              <CustomFieldInputs definitions={customFields} initialValues={valuesByKey} />
            </div>
          </section>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">Fields marked * are required</p>
          <div className="flex gap-3">
            <Link href={`/dashboard/students/${id}`} className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
              Cancel
            </Link>
            <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}