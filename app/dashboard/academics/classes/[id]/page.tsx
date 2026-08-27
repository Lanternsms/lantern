import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { createArm, deleteArm, deleteClass } from '@/app/dashboard/academics/classes/actions'
import { assignSubjectToClass, updateClassSubjectTeacher, removeSubjectFromClass } from '@/app/dashboard/academics/subjects/actions'
import { TeacherSelect } from '@/components/teacher-select'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: cls, error: fetchError } = await supabase
    .from('classes')
    .select('id, name, level, departments(name)')
    .eq('id', id)
    .single()

  if (fetchError || !cls) notFound()

  const { data: arms } = await supabase
    .from('arms')
    .select('id, name')
    .eq('class_id', id)
    .order('name')

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('is_current', true)
    .single()

  const { data: assignedSubjects } = session
    ? await supabase
      .from('class_subjects')
      .select('id, subject_id, teacher_id, subjects(name, code), profiles(first_name, last_name)')
      .eq('class_id', id)
      .eq('session_id', session.id)
    : { data: null }

  const assignedSubjectIds = assignedSubjects?.map((cs) => cs.subject_id) ?? []

  const { data: availableSubjects } = await supabase
    .from('subjects')
    .select('id, name')
    .order('name')

  // Only staff/teachers who already have portal login access (a linked
  // profile) can be assigned here — someone added purely as a staff
  // record with no login yet has no profile_id to reference.
  const { data: teacherProfiles } = await supabase
    .from('user_roles')
    .select('profiles(id, first_name, last_name)')
    .eq('role_id', (await supabase.from('roles').select('id').eq('name', 'teacher').is('school_id', null).single()).data?.id)

  const { count: studentCount } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', id)

  return (
    <div className="px-8 py-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics/classes" className="hover:text-primary">Classes</Link> / {cls.name}
      </p>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{cls.name}</h1>
          <p className="text-sm text-text-secondary mt-1">{cls.departments?.name ?? 'No department'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/academics/classes/${id}/edit`} className="flex items-center gap-1.5 text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
            <Pencil size={14} /> Edit
          </Link>
          {studentCount === 0 && (
            <form action={deleteClass}>
              <input type="hidden" name="class_id" value={id} />
              <button type="submit" className="flex items-center gap-1.5 text-sm text-danger-text border border-red-200 rounded-lg px-4 py-2 hover:bg-danger-bg transition-colors">
                <Trash2 size={14} /> Delete
              </button>
            </form>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {studentCount !== null && studentCount > 0 && (
        <p className="text-xs text-text-muted mb-4">
          This class has {studentCount} enrolled student(s), so it can&apos;t be deleted.
        </p>
      )}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Arms</h3>

        {arms && arms.length > 0 ? (
          <div className="space-y-2 mb-4">
            {arms.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 px-3 bg-surface-muted rounded-lg">
                <span className="text-sm text-text-primary">{a.name}</span>
                <form action={deleteArm}>
                  <input type="hidden" name="arm_id" value={a.id} />
                  <input type="hidden" name="class_id" value={id} />
                  <button type="submit" className="text-text-secondary hover:text-danger-text">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted mb-4">No arms added yet — this class can still have students without one.</p>
        )}

        <form action={createArm} className="flex gap-2">
          <input type="hidden" name="class_id" value={id} />
          <input
            name="name"
            required
            placeholder="e.g. A"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
            Add Arm
          </button>
        </form>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5 mt-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">Subjects</h3>

        {!session && (
          <p className="text-sm text-text-muted mb-4">Set a current academic session before assigning subjects.</p>
        )}

        {session && assignedSubjects && assignedSubjects.length > 0 && (
          <div className="space-y-2 mb-4">
            {assignedSubjects.map((cs) => (
              <div key={cs.id} className="flex items-center justify-between py-2 px-3 bg-surface-muted rounded-lg">
                <div>
                  <p className="text-sm text-text-primary font-medium">{cs.subjects?.name}</p>
                  <p className="text-xs text-text-secondary">{cs.subjects?.code}</p>
                </div>
                <div className="flex items-center gap-3">
                  <form action={updateClassSubjectTeacher} className="flex items-center gap-2">
                    <input type="hidden" name="class_subject_id" value={cs.id} />
                    <input type="hidden" name="class_id" value={id} />
                    <TeacherSelect
                      name="teacher_id"
                      defaultValue={cs.teacher_id ?? ''}
                      teachers={(teacherProfiles ?? []).map((tp) => tp.profiles).filter((p): p is NonNullable<typeof p> => p !== null)}
                      autoSubmit
                    />
                  </form>
                  <form action={removeSubjectFromClass}>
                    <input type="hidden" name="class_subject_id" value={cs.id} />
                    <input type="hidden" name="class_id" value={id} />
                    <button type="submit" className="text-text-secondary hover:text-danger-text">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {session && (
          <form action={assignSubjectToClass} className="flex gap-2">
            <input type="hidden" name="class_id" value={id} />
            <select
              name="subject_id"
              required
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a subject to add...</option>
              {availableSubjects
                ?.filter((s) => !assignedSubjectIds.includes(s.id))
                .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <TeacherSelect
              name="teacher_id"
              teachers={(teacherProfiles ?? []).map((tp) => tp.profiles).filter((p): p is NonNullable<typeof p> => p !== null)}
            />
            <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors whitespace-nowrap">
              Add Subject
            </button>
          </form>
        )}
      </section>
    </div>
  )
}