import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function MyClassPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  if (!currentSession) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">No current session is set.</p>
      </div>
    )
  }

  const { data: myAssignments } = await supabase
    .from('teacher_class_assignments')
    .select('class_id, arm_id, classes(name), arms(name)')
    .eq('teacher_id', user.id)
    .eq('session_id', currentSession.id)
    .in('role', ['form_teacher', 'class_teacher'])

  if (!myAssignments || myAssignments.length === 0) {
    return (
      <div className="px-8 py-8">
        <h1 className="text-xl font-semibold text-text-primary mb-2">My Class</h1>
        <p className="text-sm text-text-secondary">You&apos;re not assigned as a form/class teacher this session.</p>
      </div>
    )
  }

  const admin = createAdminClient()

  const sections = await Promise.all(
    myAssignments.map(async (a) => {
      // Use admin client so the RLS policy on the `students` table does not
      // block the join — teachers don't have blanket SELECT on students.
      let q = admin
        .from('enrolments')
        .select('student_id, students(id, first_name, last_name, admission_no, status)')
        .eq('class_id', a.class_id)
        .eq('session_id', currentSession.id)
      q = a.arm_id ? q.eq('arm_id', a.arm_id) : q
      const { data: students } = await q
      return {
        label: a.arms ? `${a.classes?.name} ${a.arms.name}` : (a.classes?.name ?? ''),
        classId: a.class_id,
        armId: a.arm_id,
        students: students ?? [],
      }
    })
  )

  return (
    <div className="px-8 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">My Class</h1>
      <p className="text-sm text-text-secondary mb-6">
        Students in the class(es) you&apos;re the form teacher for.
      </p>

      {sections.map((section) => (
        <div key={section.label} className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">{section.label}</h2>
            <Link
              href={`/dashboard/students/new?classId=${section.classId}&armId=${section.armId ?? ''}`}
              className="text-sm text-primary hover:text-primary-hover"
            >
              + Add Student
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-2 text-xs uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left font-medium text-text-secondary px-4 py-2 text-xs uppercase tracking-wide">
                  Admission No.
                </th>
                <th className="text-left font-medium text-text-secondary px-4 py-2 text-xs uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {section.students.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-text-secondary text-sm">
                    No students enrolled yet.
                  </td>
                </tr>
              )}
              {section.students.map((e) => {
                const s = e.students
                if (!s) return null
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/students/${s.id}?from=my-class`}
                        className="text-primary hover:text-primary-hover font-medium"
                      >
                        {s.first_name} {s.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{s.admission_no}</td>
                    <td className="px-4 py-3 text-text-secondary capitalize">{s.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
