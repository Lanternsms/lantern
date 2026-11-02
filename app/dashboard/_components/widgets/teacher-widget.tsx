/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getTodayInLagos } from '../../lms/lagos-time'
import { TeacherTodayView, type TeacherSlot } from '../teacher-today-view'

/** Loads a teacher's day (their timetable periods for today), form class and approval queue. */
export async function TeacherWidget({ isFormTeacher = false, isApprover = false }: { isFormTeacher?: boolean; isApprover?: boolean } = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const { dayOfWeek } = getTodayInLagos()
  const nowHm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

  const { data: session } = await supabase.from('academic_sessions').select('id').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle()

  let slots: TeacherSlot[] = []
  if (session) {
    const [{ data: periods }, { data: entries }] = await Promise.all([
      (supabase as any).from('timetable_periods').select('id, start_time, end_time, is_break').order('sort_order'),
      (supabase as any).from('timetable_entries').select('period_id, subjects(name), classes(name), arms(name)')
        .eq('session_id', session.id).eq('teacher_id', user.id).eq('day_of_week', dayOfWeek),
    ])
    const byPeriod = new Map((entries ?? []).map((e: any) => [e.period_id, e]))
    let nextGiven = false
    slots = (periods ?? []).filter((p: any) => !p.is_break && byPeriod.has(p.id)).map((p: any) => {
      const e: any = byPeriod.get(p.id)
      const start = String(p.start_time).slice(0, 5), end = String(p.end_time).slice(0, 5)
      let state: TeacherSlot['state'] = nowHm >= end ? 'past' : nowHm >= start ? 'now' : 'later'
      if (state === 'later' && !nextGiven) { state = 'next'; nextGiven = true }
      return { id: p.id, time: start, end, subject: e.subjects?.name ?? 'Class', group: `${e.classes?.name ?? ''}${e.arms?.name ?? ''}`, state }
    })
  }

  let formClass: string | null = null
  if (isFormTeacher) {
    const { data: a } = await (supabase as any).from('form_teachers').select('classes(name), arms(name)').eq('teacher_id', user.id).maybeSingle()
    if (a) formClass = `${a.classes?.name ?? ''}${a.arms?.name ?? ''}` || null
  }

  let approvals: number | null = null
  if (isApprover) {
    const { count } = await supabase.from('result_batches').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('status', 'in_review')
    approvals = count ?? 0
  }

  return <TeacherTodayView slots={slots} formClass={formClass} approvals={approvals} />
}
