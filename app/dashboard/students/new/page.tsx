import { createClient } from '@/lib/supabase/server'
import { createStudent } from '@/app/dashboard/students/actions'
import { CustomFieldInputs } from '@/components/custom-fields'
import { GuardianRepeater } from '@/components/guardian-repeater'
import Link from 'next/link'
import { Camera } from 'lucide-react'

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; classId?: string; armId?: string }>
}) {
  const { error, classId: lockedClassId, armId: lockedArmId } = await searchParams
  const cameFromMyClass = Boolean(lockedClassId)
  const backHref = cameFromMyClass ? '/dashboard/my-class' : '/dashboard/students'
  const backLabel = cameFromMyClass ? 'My Class' : 'Students'
  const supabase = await createClient()

  const { data: classes } = await supabase.from('classes').select('id, name').order('name')
  const { data: arms } = await supabase.from('arms').select('id, name, class_id').order('name')
  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id, name')
    .eq('is_current', true)
    .single()
  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'student')
    .order('sort_order')

  // The one query that was missing — without this, GuardianRepeater
  // always renders zero custom fields, since it defaults to an empty
  // array when no definitions are passed in.
  const { data: guardianCustomFields } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label, field_type, options, is_required')
    .eq('entity_type', 'guardian')
    .order('sort_order')

  const { data: existingGuardians } = await supabase
    .from('guardians')
    .select('id, first_name, last_name, phone, relationship')
    .order('first_name')

  return (
    <div className="px-8 py-8 max-w-3xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href={backHref} className="hover:text-primary">{backLabel}</Link> / Add Student
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Add Student</h1>
      <p className="text-sm text-text-secondary mb-6">Create a new student record and add them to your school.</p>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form action={createStudent} className="space-y-6">
        {session && <input type="hidden" name="session_id" value={session.id} />}
        <input type="hidden" name="from" value={cameFromMyClass ? 'my-class' : ''} />

        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Personal Information</h2>

          <div className="mb-5">
            <label className="block text-sm text-text-secondary mb-2">Student Photo</label>
            <div className="border border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-center">
              <Camera size={22} className="text-text-muted" />
              <p className="text-sm text-text-secondary">Upload a clear profile photo</p>
              <p className="text-xs text-text-muted">Click or drag and drop · JPG, PNG up to 5MB</p>
              <button
                type="button"
                disabled
                title="Photo upload isn't wired up yet"
                className="mt-1 text-sm text-white bg-primary/50 rounded-lg px-4 py-2 cursor-not-allowed"
              >
                Upload photo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">First Name <span className="text-danger-text">*</span></label>
              <input name="first_name" required placeholder="e.g. Chidinma" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Middle Name</label>
              <input name="middle_name" placeholder="Optional" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Last Name <span className="text-danger-text">*</span></label>
              <input name="last_name" required placeholder="e.g. Okonkwo" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Date of Birth <span className="text-danger-text">*</span></label>
              <input name="date_of_birth" type="date" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Gender <span className="text-danger-text">*</span></label>
              <select name="gender" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1.5">Residential Address</label>
              <input name="residential_address" placeholder="Street, area, city" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-primary">Guardian Information</h2>
          <p className="text-xs text-text-secondary mb-4">At least one guardian is required.</p>
          <GuardianRepeater
            customFieldDefs={guardianCustomFields ?? []}
            existingGuardians={existingGuardians ?? []}
          />
        </section>

        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Enrolment Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Academic Session <span className="text-danger-text">*</span></label>
              <input
                disabled
                value={session?.name ?? 'No current session'}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-muted text-text-muted cursor-not-allowed"
              />
            </div>
            {lockedClassId ? (
              <>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Class</label>
                  <div className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-muted text-text-muted">
                    {classes?.find((c) => c.id === lockedClassId)?.name}
                  </div>
                  <input type="hidden" name="class_id" value={lockedClassId} />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Arm</label>
                  <div className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-muted text-text-muted">
                    {arms?.find((a) => a.id === lockedArmId)?.name ?? '—'}
                  </div>
                  <input type="hidden" name="arm_id" value={lockedArmId ?? ''} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Class <span className="text-danger-text">*</span></label>
                  <select name="class_id" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select class</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">Arm</label>
                  <select name="arm_id" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select arm</option>
                    {arms?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Admission Number <span className="text-danger-text">*</span></label>
              <input name="admission_no" required placeholder="e.g. GSS/2025/0142" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Enrolment Date</label>
              <input name="enrolment_date" type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </section>

        {customFields && customFields.length > 0 && (
          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-sm font-semibold text-text-primary">Additional Information</h2>
            <p className="text-xs text-text-secondary mb-4">School-configured fields. These can be customised in your school settings.</p>
            <div className="grid grid-cols-2 gap-4">
              <CustomFieldInputs definitions={customFields} />
            </div>
          </section>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">Fields marked * are required</p>
          <div className="flex gap-3">
            <Link href={backHref} className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
              Cancel
            </Link>
            <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
              Save Student
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}