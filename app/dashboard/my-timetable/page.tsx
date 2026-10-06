import { createClient } from '@/lib/supabase/server'
import TimetableGridView, { TimetableRow } from './timetable-grid-view'

export const dynamic = 'force-dynamic'

export default async function MyTimetablePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id, name')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .single()

  const { data: periods } = await supabase
    .from('timetable_periods')
    .select('id, name, start_time, end_time, is_break')
    .order('sort_order')

  if (!session) {
    return <div className="p-6"><p className="text-sm text-text-secondary">No current academic session set.</p></div>
  }

  // Is this user a teacher?
  const { data: staffRow } = await supabase
    .from('staff')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (staffRow) {
    const { data: entries } = await supabase
      .from('timetable_entries')
      .select('day_of_week, period_id, subjects(name), classes(name), arms(name)')
      .eq('session_id', session.id)
      .eq('teacher_id', user.id)

    const rows: TimetableRow[] = (entries ?? []).map((e: any) => ({
      day_of_week: e.day_of_week,
      period_id: e.period_id,
      subject_name: e.subjects?.name ?? '',
      class_name: e.classes?.name ?? '',
      arm_name: e.arms?.name ?? '',
    }))

    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold text-text-primary">My Timetable</h1>
        <TimetableGridView periods={periods ?? []} rows={rows} mode="teacher" />
      </div>
    )
  }

  // Otherwise, is this user a student?
  const { data: studentRow } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (studentRow) {
    let { data: enrolment } = await supabase
      .from('enrolments')
      .select('class_id, arm_id, session_id')
      .eq('student_id', studentRow.id)
      .eq('session_id', session.id)
      .maybeSingle()

    if (!enrolment) {
      const { data: latestEnrolment } = await supabase
        .from('enrolments')
        .select('class_id, arm_id, session_id')
        .eq('student_id', studentRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      enrolment = latestEnrolment
    }

    if (!enrolment || !enrolment.class_id) {
      return <div className="p-6"><p className="text-sm text-text-secondary">You're not enrolled in a class for this session yet.</p></div>
    }

    let entriesQuery = supabase
      .from('timetable_entries')
      .select('day_of_week, period_id, subjects(name), teacher:profiles(first_name, last_name)')
      .eq('session_id', enrolment.session_id || session.id)
      .eq('class_id', enrolment.class_id)

    if (enrolment.arm_id) {
      entriesQuery = entriesQuery.eq('arm_id', enrolment.arm_id)
    } else {
      entriesQuery = entriesQuery.is('arm_id', null)
    }

    const { data: entries } = await entriesQuery

    const rows: TimetableRow[] = (entries ?? []).map((e: any) => ({
      day_of_week: e.day_of_week,
      period_id: e.period_id,
      subject_name: e.subjects?.name ?? '',
      teacher_name: e.teacher ? `${e.teacher.first_name} ${e.teacher.last_name}` : null,
    }))

    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold text-text-primary">My Timetable</h1>
        <TimetableGridView periods={periods ?? []} rows={rows} mode="student" />
      </div>
    )
  }

  return <div className="p-6"><p className="text-sm text-text-secondary">No timetable available for your account type.</p></div>
}