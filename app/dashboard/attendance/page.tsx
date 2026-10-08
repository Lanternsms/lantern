import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import ClassArmDatePicker from './class-arm-date-picker'
import MarkingGrid from './marking-grid'
import HistoryView from './history-view'

export const dynamic = 'force-dynamic'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; armId?: string; date?: string; view?: string }>
}) {
  const { classId, armId, date, view } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: canManageAll } = await supabase.rpc('has_permission', { perm_code: 'attendance.manage' })
  const { data: canManageCategories } = await supabase.rpc('has_permission', { perm_code: 'settings.manage' })
  const { data: scopeRows } = await supabase.rpc('teacher_class_scope')

  if (!canManageAll && (!scopeRows || scopeRows.length === 0)) {
    const { data: guardianRow } = await supabase
      .from('guardians')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (guardianRow) {
      redirect('/dashboard/my-children?tab=attendance')
    }
  }

  const { data: allClasses } = await supabase
    .from('classes')
    .select('id, name, level, arms(id, name)')
    .order('level')

  let availableClasses = allClasses ?? []
  if (!canManageAll) {
    const scopeByClass = new Map<string, Set<string> | null>()
    for (const row of scopeRows ?? []) {
      if (row.arm_id === null) {
        scopeByClass.set(row.class_id, null)
      } else if (scopeByClass.get(row.class_id) !== null) {
        const set = (scopeByClass.get(row.class_id) as Set<string> | undefined) ?? new Set<string>()
        set.add(row.arm_id)
        scopeByClass.set(row.class_id, set)
      }
    }
    availableClasses = (allClasses ?? [])
      .filter((c) => scopeByClass.has(c.id))
      .map((c: any) => {
        const allowedArms = scopeByClass.get(c.id)
        return { ...c, arms: allowedArms === null ? c.arms : c.arms.filter((a: any) => allowedArms!.has(a.id)) }
      })
  }

  const { data: statuses } = await supabase.from('attendance_statuses').select('*').order('code')

  const today = new Date().toISOString().slice(0, 10)
  const selectedDate = date ?? today
  const activeView = view === 'history' ? 'history' : 'mark'

  let students: any[] = []
  let existingMarks: any[] = []
  let teachableSubjects: { id: string; name: string }[] = []

  if (classId) {
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .single()

    if (session) {
      const { data: subjRows } = await supabase
        .from('class_subjects')
        .select('arm_id, subjects(id, name)')
        .eq('class_id', classId)
        .eq('teacher_id', user.id)
        .eq('session_id', session.id)

      const seen = new Set<string>()
      teachableSubjects = (subjRows ?? [])
        .filter((r: any) => !armId || r.arm_id === null || r.arm_id === armId)
        .map((r: any) => r.subjects)
        .filter((s: any) => s && !seen.has(s.id) && seen.add(s.id))

      // Use admin client: teachers don't have blanket SELECT on students,
      // so the RLS policy causes the join to silently return null for each row.
      const admin = createAdminClient()
      let enrolQuery = admin
        .from('enrolments')
        .select('arm_id, students(id, first_name, last_name, admission_no)')
        .eq('session_id', session.id)
        .eq('class_id', classId)
      if (armId) enrolQuery = enrolQuery.eq('arm_id', armId)
      const { data: enrolments } = await enrolQuery

      students = (enrolments ?? [])
        .filter((e: any) => e.students)
        .map((e: any) => ({ ...e.students, arm_id: e.arm_id }))
        .sort((a: any, b: any) => a.first_name.localeCompare(b.first_name))

      if (activeView === 'mark') {
        const { data: marks } = await supabase
          .from('attendance')
          .select('student_id, status_id, subject_id, marked_at')
          .eq('class_id', classId)
          .eq('date', selectedDate)
        existingMarks = marks ?? []
      }
    }
  }

  const baseParams = (v: string) => {
    const p = new URLSearchParams({ view: v })
    if (classId) p.set('classId', classId)
    if (armId) p.set('armId', armId)
    if (date) p.set('date', date)
    return p.toString()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Attendance</h1>
        {canManageCategories && (
          <Link href="/dashboard/attendance/settings" className="text-sm text-primary hover:underline">
            Manage Categories
          </Link>
        )}
      </div>

      <div className="flex gap-4 border-b border-border">
        <Link
          href={`/dashboard/attendance?${baseParams('mark')}`}
          className={`pb-2 text-sm font-medium ${activeView === 'mark' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}
        >
          Mark Attendance
        </Link>
        <Link
          href={`/dashboard/attendance?${baseParams('history')}`}
          className={`pb-2 text-sm font-medium ${activeView === 'history' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}
        >
          History & Export
        </Link>
      </div>

      <ClassArmDatePicker
        classes={availableClasses}
        selectedClassId={classId ?? ''}
        selectedArmId={armId ?? ''}
        selectedDate={selectedDate}
        view={activeView}
        showDate={activeView === 'mark'}
      />

      {!classId ? (
        <p className="text-sm text-text-secondary">Pick a class to get started.</p>
      ) : (statuses ?? []).length === 0 ? (
        <p className="text-sm text-text-secondary">
          No attendance categories configured yet.{' '}
          {canManageCategories && (
            <Link href="/dashboard/attendance/settings" className="text-primary hover:underline">
              Add some first.
            </Link>
          )}
        </p>
      ) : activeView === 'mark' ? (
        <MarkingGrid
          classId={classId}
          date={selectedDate}
          students={students}
          statuses={statuses ?? []}
          existingMarks={existingMarks}
          teachableSubjects={teachableSubjects}
        />
      ) : (
        <HistoryView classId={classId} armId={armId ?? null} />
      )}
    </div>
  )
}