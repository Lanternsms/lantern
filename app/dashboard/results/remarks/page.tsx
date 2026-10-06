import { createClient } from '@/lib/supabase/server'
import { SelectAutosubmit } from '@/components/select-autosubmit'
import { saveClassTeacherRemark, savePrincipalRemark } from './actions'

export default async function RemarksPage({
  searchParams,
}: {
  searchParams: Promise<{ classArm?: string }>
}) {
  const { classArm } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">Unable to load your profile.</p>
      </div>
    )
  }

  const { data: currentTerm } = await supabase
    .from('terms')
    .select('id, name, session_id, academic_sessions(name)')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  if (!currentTerm) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">No current term is set for your school.</p>
      </div>
    )
  }

  const { data: canManageResults } = await supabase.rpc('can_manage_results')

  // Classes/arms this person is allowed to assign as a class teacher for —
  // used to decide if the Class Teacher's Remark box is editable.
  const { data: myClassTeacherAssignments } = await supabase
    .from('teacher_class_assignments')
    .select('class_id, arm_id')
    .eq('teacher_id', user.id)
    .eq('session_id', currentTerm.session_id)
    .in('role', ['class_teacher', 'form_teacher'])

  const isMyClassTeacherAssignment = (classId: string, armId: string | null) =>
    (myClassTeacherAssignments ?? []).some(
      (a) => a.class_id === classId && (a.arm_id === null || a.arm_id === armId)
    )

  // Classes/arms this person may even VIEW. Principals/admins see every
  // class; everyone else sees only classes they teach (subject or class
  // teacher) — matching what result_remarks_select already allows them to
  // read, so the dropdown never offers a class they'd get zero rows for.
  let classOptions: { value: string; label: string }[] = []

  if (canManageResults) {
    const { data: classesWithArms } = await supabase
      .from('classes')
      .select('id, name, level, arms(id, name)')
      .eq('school_id', profile.school_id)
      .order('level')

    classOptions = (classesWithArms ?? []).flatMap((c) =>
      c.arms && c.arms.length > 0
        ? c.arms.map((a) => ({ value: `${c.id}|${a.id}`, label: `${c.name} ${a.name}` }))
        : [{ value: `${c.id}|`, label: c.name }]
    )
  } else {
    const [{ data: subjectRows }, { data: assignRows }] = await Promise.all([
      supabase
        .from('class_subjects')
        .select('class_id, arm_id, classes(name), arms(name)')
        .eq('teacher_id', user.id)
        .eq('session_id', currentTerm.session_id),
      supabase
        .from('teacher_class_assignments')
        .select('class_id, arm_id, classes(name), arms(name)')
        .eq('teacher_id', user.id)
        .eq('session_id', currentTerm.session_id),
    ])

    const seen = new Set<string>()
    for (const row of [...(subjectRows ?? []), ...(assignRows ?? [])]) {
      const key = `${row.class_id}|${row.arm_id ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      classOptions.push({
        value: key,
        label: row.arms ? `${row.classes?.name} ${row.arms.name}` : row.classes?.name ?? '',
      })
    }
  }

  if (classOptions.length === 0) {
    return (
      <div className="px-8 py-8 space-y-6">
        <h1 className="text-lg font-medium text-text-primary">Result Remarks</h1>
        <p className="text-sm text-text-secondary">
          You don't have any classes to view remarks for.
        </p>
      </div>
    )
  }

  const selectedKey = classArm && classOptions.some((o) => o.value === classArm)
    ? classArm
    : classOptions[0].value
  const [selClassId, selArmId] = selectedKey.split('|')
  const canEditClassTeacherRemark = isMyClassTeacherAssignment(selClassId, selArmId || null)

  let enrolQuery = supabase
    .from('enrolments')
    .select('student_id, students(id, first_name, last_name, admission_no)')
    .eq('class_id', selClassId)
    .eq('session_id', currentTerm.session_id)
  if (selArmId) enrolQuery = enrolQuery.eq('arm_id', selArmId)
  const { data: students } = await enrolQuery

  const studentIds = (students ?? []).map((e) => e.student_id)
  const { data: existingRemarks } = studentIds.length
    ? await supabase
        .from('result_remarks')
        .select('student_id, class_teacher_remark, principal_remark')
        .eq('term_id', currentTerm.id)
        .in('student_id', studentIds)
    : { data: [] }
  const remarkByStudent = new Map((existingRemarks ?? []).map((r) => [r.student_id, r]))

  return (
    <div className="px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-text-primary">Result Remarks</h1>
          <p className="text-sm text-text-secondary">
            {currentTerm.name}, {currentTerm.academic_sessions?.name}
          </p>
        </div>
        <form method="get">
          <SelectAutosubmit name="classArm" defaultValue={selectedKey} options={classOptions} />
        </form>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        {(students ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No students enrolled in this class/arm yet.</p>
        ) : (
          <div className="space-y-5">
            {(students ?? []).map((e) => {
              const student = e.students
              if (!student) return null
              const existing = remarkByStudent.get(student.id)

              return (
                <div key={student.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                  <p className="text-sm font-medium text-text-primary mb-2">
                    {student.first_name} {student.last_name}{' '}
                    <span className="text-xs text-text-secondary">{student.admission_no}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-secondary mb-1">Class Teacher's Remark</p>
                      {canEditClassTeacherRemark ? (
                        <form
                          action={saveClassTeacherRemark.bind(null, currentTerm.id, student.id)}
                          className="flex gap-2"
                        >
                          <textarea
                            name="remark"
                            rows={2}
                            defaultValue={existing?.class_teacher_remark ?? ''}
                            placeholder="e.g. A hardworking and attentive student this term."
                            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                          />
                          <button
                            type="submit"
                            className="self-start px-3 py-2 bg-primary text-white rounded-lg text-xs hover:bg-primary-hover"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-text-primary bg-background rounded-lg px-3 py-2 min-h-[2.5rem]">
                          {existing?.class_teacher_remark || (
                            <span className="text-text-secondary">No remark yet.</span>
                          )}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-text-secondary mb-1">Principal's Remark</p>
                      {canManageResults ? (
                        <form
                          action={savePrincipalRemark.bind(null, currentTerm.id, student.id)}
                          className="flex gap-2"
                        >
                          <textarea
                            name="remark"
                            rows={2}
                            defaultValue={existing?.principal_remark ?? ''}
                            placeholder="e.g. A pleasure to have in school this term."
                            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                          />
                          <button
                            type="submit"
                            className="self-start px-3 py-2 bg-primary text-white rounded-lg text-xs hover:bg-primary-hover"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-text-primary bg-background rounded-lg px-3 py-2 min-h-[2.5rem]">
                          {existing?.principal_remark || (
                            <span className="text-text-secondary">No remark yet.</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
