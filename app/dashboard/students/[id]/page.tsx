import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TabView } from '@/components/tab-view'
import { makePrimaryContact } from '@/app/dashboard/guardians/actions'

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; guardianId?: string }>
}) {
  const { id } = await params
  const { from, guardianId } = await searchParams
  const supabase = await createClient()

  const { data: student, error } = await supabase
    .from('students')
    .select('id, admission_no, first_name, last_name, date_of_birth, gender, status')
    .eq('id', id)
    .single()

  // A missing row here means either the student doesn't exist, or RLS
  // correctly filtered it out (e.g. a teacher trying to view a student
  // outside their class scope) — both cases should look identical to the
  // user, which is exactly what notFound() gives us
  if (error || !student) notFound()

  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('id, class_id, arm_id, academic_sessions(name, start_date), classes(name), arms(name)')
    .eq('student_id', id)

  const sortedEnrolments = (enrolments ?? []).sort(
    (a, b) =>
      new Date(b.academic_sessions?.start_date ?? 0).getTime() -
      new Date(a.academic_sessions?.start_date ?? 0).getTime()
  )
  const currentEnrolment = sortedEnrolments[0]

  const { data: guardianLinks } = await supabase
    .from('student_guardians')
    .select('is_primary_contact, guardians(id, first_name, last_name, phone, email, relationship)')
    .eq('student_id', id)

  const { data: fieldDefs } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label')
    .eq('entity_type', 'student')
    .order('sort_order')

  const { data: fieldValues } = await supabase
    .from('custom_field_values')
    .select('definition_id, value')
    .eq('entity_id', id)

  const valueByDefId = new Map((fieldValues ?? []).map((v) => [v.definition_id, v.value]))

  const initials = `${student.first_name[0]}${student.last_name[0]}`
  const isActive = student.status === 'active'

  const overviewContent = (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Personal Information</h3>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Full Name</p>
            <p className="text-text-primary">{student.first_name} {student.last_name}</p>
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Date of Birth</p>
            <p className="text-text-primary">{student.date_of_birth ?? 'Not provided'}</p>
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Gender</p>
            <p className="text-text-primary capitalize">{student.gender ?? 'Not provided'}</p>
          </div>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">Guardian Information</h3>
          <Link href={`/dashboard/guardians/new?student_id=${id}`} className="text-xs text-primary hover:text-primary-hover">
            + Add guardian
          </Link>
        </div>
        {guardianLinks && guardianLinks.length > 0 ? (
          <div className="space-y-3">
            {guardianLinks.map((link, i) => (
              <div key={i} className="text-sm flex items-center justify-between">
                <div>
                  <p className="text-text-primary">
                    {link.guardians?.first_name} {link.guardians?.last_name}
                    {link.is_primary_contact && (
                      <span className="ml-2 text-xs bg-success-bg text-success-text rounded-full px-2 py-0.5">Primary</span>
                    )}
                  </p>
                  <p className="text-text-secondary text-xs">
                    {link.guardians?.relationship} · {link.guardians?.phone ?? 'No phone'}
                  </p>
                </div>
                {!link.is_primary_contact && (
                  <form action={makePrimaryContact}>
                    <input type="hidden" name="student_id" value={id} />
                    <input type="hidden" name="guardian_id" value={link.guardians?.id} />
                    <button type="submit" className="text-xs text-primary hover:text-primary-hover">
                      Make primary
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No guardian information recorded.</p>
        )}
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Enrolment History</h3>
        {sortedEnrolments.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary text-xs uppercase tracking-wide">
                <th className="pb-2 font-medium">Academic Session</th>
                <th className="pb-2 font-medium">Class</th>
                <th className="pb-2 font-medium">Arm</th>
              </tr>
            </thead>
            <tbody>
              {sortedEnrolments.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-2 text-text-primary">{e.academic_sessions?.name}</td>
                  <td className="py-2 text-text-secondary">{e.classes?.name}</td>
                  <td className="py-2 text-text-secondary">{e.arms?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-secondary">No enrolment history.</p>
        )}
      </section>

      {fieldDefs && fieldDefs.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">Custom Fields</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            {fieldDefs.map((def) => (
              <div key={def.id}>
                <p className="text-text-secondary text-xs mb-0.5">{def.label}</p>
                <p className="text-text-primary">
                  {(valueByDefId.get(def.id) as string) ?? 'Not provided'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )

  const placeholder = (label: string) => (
    <p className="text-sm text-text-secondary">
      {label} isn&apos;t built yet — this tab will show real data once that feature is ready.
    </p>
  )

  return (
    <div className="px-8 py-8">
      <Link
        href={from === 'guardian' && guardianId ? `/dashboard/guardians/${guardianId}` : '/dashboard/students'}
        className="text-sm text-primary hover:text-primary-hover"
      >
        {from === 'guardian' && guardianId ? '← Back to guardian' : '← Back to students'}
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-medium">
            {initials}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-text-primary">
                {student.first_name} {student.last_name}
              </h1>
              <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${isActive ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
                {isActive ? 'Active' : student.status}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {student.admission_no} · {currentEnrolment?.classes?.name}
              {currentEnrolment?.arms?.name ? ` · Arm ${currentEnrolment.arms.name}` : ''}
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/students/${id}/edit`}
          className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
        >
          Edit Student
        </Link>
      </div>

      <TabView
        tabs={[
          { id: 'overview', label: 'Overview', content: overviewContent },
          { id: 'results', label: 'Results', content: placeholder('Results') },
          { id: 'attendance', label: 'Attendance', content: placeholder('Attendance') },
          { id: 'fees', label: 'Fees', content: placeholder('Fees') },
        ]}
      />
    </div>
  )
}