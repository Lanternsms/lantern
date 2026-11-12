import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ClassArmDatePicker from './class-arm-date-picker'
import MarkingGrid from './marking-grid'
import HistoryView from './history-view'

export const dynamic = 'force-dynamic'

// Today's date in the school's time zone, as YYYY-MM-DD
const lagosToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
const isIsoDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

type TeacherOption = {
  key: string
  classId: string
  className: string
  armId: string | null
  armName: string | null
  subjectId: string
  subjectName: string
  label: string
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; armId?: string; subjectId?: string; date?: string; view?: string }>
}) {
  const { classId, armId, subjectId, date, view } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const [{ data: canViewAllRaw }, { data: canManageCategories }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'attendance.view_all' }),
    supabase.rpc('has_permission', { perm_code: 'settings.manage' }),
  ])
  const canViewAll = !!canViewAllRaw

  const selectedClassId = classId ?? ''
  const selectedArmId = armId ?? ''
  const selectedSubjectId = subjectId ?? ''

  // A class id that does not exist in this school is a true 404.
  if (selectedClassId) {
    const { data: cls } = await supabase
      .from('classes')
      .select('id')
      .eq('id', selectedClassId)
      .eq('school_id', profile.school_id)
      .maybeSingle()
    if (!cls) notFound()
  }

  // An arm is validated only when one is present in the URL (this school has none).
  if (selectedArmId && selectedClassId) {
    const { data: arm } = await supabase
      .from('arms')
      .select('id')
      .eq('id', selectedArmId)
      .eq('class_id', selectedClassId)
      .maybeSingle()
    if (!arm) notFound()
  }

  // Current session
  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id, name')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()

  // The class and subject pairs this user teaches this session
  const { data: teacherRows } = session
    ? await supabase
        .from('class_subjects')
        .select('class_id, arm_id, subject_id, classes(id, name, level), arms(id, name), subjects(id, name)')
        .eq('teacher_id', user.id)
        .eq('session_id', session.id)
    : { data: [] }

  const teacherOptions: TeacherOption[] = (teacherRows ?? [])
    .map((tc: any) => ({
      key: `${tc.class_id}:${tc.arm_id ?? ''}:${tc.subject_id}`,
      classId: tc.class_id as string,
      className: (tc.classes?.name ?? 'Class') as string,
      armId: (tc.arm_id ?? null) as string | null,
      armName: (tc.arms?.name ?? null) as string | null,
      subjectId: tc.subject_id as string,
      subjectName: (tc.subjects?.name ?? 'Subject') as string,
      label: `${tc.classes?.name ?? 'Class'}${tc.arms?.name ? ` ${tc.arms.name}` : ''} · ${tc.subjects?.name ?? 'Subject'}`,
      level: tc.classes?.level ?? 0,
    }))
    .sort((a: any, b: any) => a.level - b.level || a.label.localeCompare(b.label))

  const isTeacher = teacherOptions.length > 0
  const teacherClassIds = new Set(teacherOptions.map((o) => o.classId))

  // No assignments and no view-all permission: guardians go to their dashboard; others get a message.
  if (!isTeacher && !canViewAll) {
    const { data: guardianRow } = await supabase
      .from('guardians')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (guardianRow) redirect('/dashboard?tab=attendance')
    return (
      <div className="space-y-6 p-6">
        <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Attendance</h1>
        <div className="card p-8 text-center text-text-secondary">
          You are not assigned to teach any class or subject this session.
        </div>
      </div>
    )
  }

  const selectedDate = isIsoDate(date) ? (date as string) : lagosToday()

  // Teachers land on Mark by default. Users who only have view-all (admins) see records.
  const activeView: 'mark' | 'history' = isTeacher && view !== 'history' ? 'mark' : 'history'

  const selectedPair =
    selectedClassId && selectedSubjectId
      ? teacherOptions.find(
          (o) =>
            o.classId === selectedClassId &&
            o.subjectId === selectedSubjectId &&
            (o.armId === null || !selectedArmId || o.armId === selectedArmId),
        ) ?? null
      : null

  // Pairs offered for the chosen class (or all of the teacher's pairs when no class is chosen)
  const candidates = teacherOptions.filter((o) => !selectedClassId || o.classId === selectedClassId)

  const pairHref = (o: TeacherOption) => {
    const p = new URLSearchParams({ view: 'mark', classId: o.classId, subjectId: o.subjectId, date: selectedDate })
    if (o.armId) p.set('armId', o.armId)
    return `/dashboard/attendance?${p.toString()}`
  }

  // Exactly one possible pair: open it straight away.
  if (activeView === 'mark' && !selectedPair && candidates.length === 1) {
    redirect(pairHref(candidates[0]))
  }

  const { data: allClasses } = await supabase
    .from('classes')
    .select('id, name, level, arms(id, name)')
    .order('level')
  const pickerClasses = canViewAll
    ? allClasses ?? []
    : (allClasses ?? []).filter((c) => teacherClassIds.has(c.id))

  const baseParams = (v: string) => {
    const p = new URLSearchParams({ view: v })
    if (selectedClassId) p.set('classId', selectedClassId)
    if (selectedArmId) p.set('armId', selectedArmId)
    if (selectedSubjectId) p.set('subjectId', selectedSubjectId)
    if (isIsoDate(date)) p.set('date', date as string)
    return p.toString()
  }

  const header = (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Attendance</h1>
        {canManageCategories && (
          <Link href="/dashboard/attendance/settings" className="text-sm text-primary hover:underline">
            Manage Categories
          </Link>
        )}
      </div>

      <div className="flex gap-4 border-b border-border">
        {isTeacher && (
          <Link
            href={`/dashboard/attendance?${baseParams('mark')}`}
            className={`pb-2 text-sm font-medium ${activeView === 'mark' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}
          >
            Mark Attendance
          </Link>
        )}
        <Link
          href={`/dashboard/attendance?${baseParams('history')}`}
          className={`pb-2 text-sm font-medium ${activeView === 'history' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}
        >
          {isTeacher ? 'History & Export' : 'Attendance records'}
        </Link>
      </div>
    </>
  )

  // ---------------- MARK ----------------
  if (activeView === 'mark') {
    // No valid pair chosen yet: show the teacher's pairs as large tappable rows.
    if (!selectedPair) {
      const showNotAssigned = !!selectedSubjectId && !!selectedClassId
      const pairs = candidates.length > 0 ? candidates : teacherOptions
      return (
        <div className="space-y-6 p-6">
          {header}
          {showNotAssigned && (
            <p role="alert" className="rounded-lg bg-warning-bg px-3 py-2.5 text-sm text-warning-text">
              You are not assigned to teach this class and subject this session.
            </p>
          )}
          <div className="space-y-3">
            <h2 className="text-[15px] font-semibold text-text-primary">Choose a class and subject</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {pairs.map((o) => (
                <li key={o.key}>
                  <Link
                    href={pairHref(o)}
                    className="card flex min-h-[64px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-raised active:bg-school-soft"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-text-primary">
                        {o.className}{o.armName ? ` ${o.armName}` : ''}
                      </span>
                      <span className="text-sm text-text-secondary">{o.subjectName}</span>
                    </span>
                    <span className="text-sm font-medium text-primary">Take attendance</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    // A valid pair is chosen: load the roster and any marks already saved for this subject and day.
    const { data: statuses } = await supabase.from('attendance_statuses').select('*').order('code')

    // The pair was authorised from class_subjects above, so read the roster with the admin client
    // (teachers do not have blanket SELECT on students).
    const admin = createAdminClient()
    let enrolQuery = admin
      .from('enrolments')
      .select('arm_id, students(id, first_name, last_name, admission_no)')
      .eq('session_id', session!.id)
      .eq('class_id', selectedPair.classId)
    const armFilter = selectedPair.armId ?? (selectedArmId || null)
    if (armFilter) enrolQuery = enrolQuery.eq('arm_id', armFilter)
    const { data: enrolments } = await enrolQuery

    const students = (enrolments ?? [])
      .filter((e: any) => e.students)
      .map((e: any) => ({ ...e.students, arm_id: e.arm_id }))
      .sort((a: any, b: any) => a.first_name.localeCompare(b.first_name))

    let marksQuery = supabase
      .from('attendance')
      .select('student_id, status_id, subject_id, marked_at')
      .eq('class_id', selectedPair.classId)
      .eq('date', selectedDate)
      .eq('subject_id', selectedPair.subjectId)
    if (armFilter) marksQuery = marksQuery.eq('arm_id', armFilter)
    const { data: marks } = await marksQuery

    return (
      <div className="space-y-6 p-6">
        {header}

        <ClassArmDatePicker
          classes={pickerClasses}
          selectedClassId={selectedPair.classId}
          selectedArmId={selectedPair.armId ?? ''}
          selectedSubjectId={selectedPair.subjectId}
          selectedDate={selectedDate}
          view="mark"
          showDate
          teacherOptions={teacherOptions}
        />

        {(statuses ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">
            No attendance categories configured yet.{' '}
            {canManageCategories && (
              <Link href="/dashboard/attendance/settings" className="text-primary hover:underline">
                Add some first.
              </Link>
            )}
          </p>
        ) : (
          <MarkingGrid
            key={`${selectedPair.key}:${selectedDate}`}
            classId={selectedPair.classId}
            date={selectedDate}
            subjectId={selectedPair.subjectId}
            subjectName={selectedPair.subjectName}
            students={students}
            statuses={statuses ?? []}
            existingMarks={marks ?? []}
          />
        )}
      </div>
    )
  }

  // ---------------- HISTORY (read-only) ----------------
  const classIsAllowed = canViewAll || (selectedClassId ? teacherClassIds.has(selectedClassId) : true)

  const classSubjects: { id: string; name: string }[] = []
  if (selectedClassId && session && classIsAllowed) {
    const { data: csRows } = await supabase
      .from('class_subjects')
      .select('subject_id, subjects(id, name)')
      .eq('class_id', selectedClassId)
      .eq('session_id', session.id)
    const seen = new Set<string>()
    for (const r of (csRows ?? []) as any[]) {
      if (r.subjects && !seen.has(r.subjects.id)) {
        seen.add(r.subjects.id)
        classSubjects.push({ id: r.subjects.id, name: r.subjects.name })
      }
    }
    classSubjects.sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <div className="space-y-6 p-6">
      {header}

      <ClassArmDatePicker
        classes={pickerClasses}
        selectedClassId={selectedClassId}
        selectedArmId={selectedArmId}
        selectedSubjectId={selectedSubjectId}
        selectedDate={selectedDate}
        view="history"
        showDate={false}
      />

      {!selectedClassId ? (
        <p className="text-sm text-text-secondary">Pick a class to see its attendance records.</p>
      ) : !classIsAllowed ? (
        <p role="alert" className="rounded-lg bg-warning-bg px-3 py-2.5 text-sm text-warning-text">
          You are not assigned to teach this class this session.
        </p>
      ) : (
        <HistoryView classId={selectedClassId} armId={selectedArmId || null} subjects={classSubjects} />
      )}
    </div>
  )
}