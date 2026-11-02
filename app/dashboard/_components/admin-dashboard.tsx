import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getTodayInLagos } from '../lms/lagos-time'
import { SetupChecklist } from './setup-checklist'
import { AdminTodayView, type BoardCell } from './admin-today-view'


function daysAgo(iso: string | null, todayStr: string) {
  if (!iso) return ''
  const d = Math.round((Date.parse(todayStr) - Date.parse(iso.slice(0, 10))) / 86_400_000)
  return d <= 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`
}

type Cell = BoardCell

/**
 * The principal's first screen answers one question: is school running normally today?
 * Biggest block: every class arm's register this morning. The line under the title names
 * the one thing to act on (registers still open), next to the action that fixes it.
 */
export async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, first_name')
    .eq('id', user.id)
    .single()
  if (!profile) return null
  const schoolId = profile.school_id

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id, name, start_date')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()

  if (!currentSession) {
    return (
      <div className="flex flex-col gap-6 px-5 py-8 sm:px-8">
        <SetupChecklist />
        <section className="card p-6">
          <h1 className="text-lg font-semibold">No current session yet</h1>
          <p className="mt-1 max-w-[60ch] text-text-secondary">
            Today’s attendance, fees and results appear here once a session and term are set as current.
          </p>
          <Link href="/dashboard/academics/sessions" className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-semibold text-white hover:bg-primary-hover">
            Set up the session
          </Link>
        </section>
      </div>
    )
  }

  const { dateStr: today } = getTodayInLagos()

  const [{ data: currentTerm }, { data: classes }, { data: arms }, { data: enrolments }, { data: statuses }] = await Promise.all([
    supabase.from('terms').select('id, name, start_date').eq('school_id', schoolId).eq('session_id', currentSession.id).eq('is_current', true).maybeSingle(),
    supabase.from('classes').select('id, name, level').eq('school_id', schoolId).order('level'),
    supabase.from('arms').select('id, name, class_id').eq('school_id', schoolId).order('name'),
    supabase.from('enrolments').select('arm_id, class_id').eq('school_id', schoolId).eq('session_id', currentSession.id),
    supabase.from('attendance_statuses').select('id, counts_as_present').eq('school_id', schoolId),
  ])

  // ---- Registers this morning: one cell per arm, from today's daily register ----
  const { data: todayRows } = await supabase
    .from('attendance')
    .select('arm_id, status_id')
    .eq('school_id', schoolId)
    .eq('date', today)
    .is('subject_id', null)

  const presentStatus = new Set((statuses ?? []).filter((s) => s.counts_as_present).map((s) => s.id))
  const rollByArm = new Map<string, number>()
  for (const e of enrolments ?? []) if (e.arm_id) rollByArm.set(e.arm_id, (rollByArm.get(e.arm_id) ?? 0) + 1)
  const markedByArm = new Map<string, { marked: number; present: number }>()
  for (const r of todayRows ?? []) {
    if (!r.arm_id) continue
    const m = markedByArm.get(r.arm_id) ?? { marked: 0, present: 0 }
    m.marked += 1
    if (presentStatus.has(r.status_id)) m.present += 1
    markedByArm.set(r.arm_id, m)
  }

  const board = (classes ?? []).map((c) => ({
    level: c.name,
    cells: (arms ?? [])
      .filter((a) => a.class_id === c.id && (rollByArm.get(a.id) ?? 0) > 0)
      .map<Cell>((a) => {
        const m = markedByArm.get(a.id)
        const size = rollByArm.get(a.id) ?? 0
        return { arm: a.id, cls: c.id, label: `${c.name}${a.name}`, size, present: m?.present ?? 0, pct: m ? Math.round((m.present / m.marked) * 100) : null }
      }),
  })).filter((row) => row.cells.length > 0)
  const allCells = board.flatMap((r) => r.cells)
  const savedCells = allCells.filter((c) => c.pct !== null)
  const presentToday = savedCells.reduce((s, c) => s + c.present, 0)
  const markedToday = (todayRows ?? []).filter((r) => r.arm_id).length

  // ---- Fees this term ----
  const { data: feeStructures } = currentTerm
    ? await supabase.from('fee_structures').select('id, class_id, amount').eq('school_id', schoolId).eq('session_id', currentSession.id).eq('term_id', currentTerm.id)
    : { data: [] as { id: string; class_id: string | null; amount: number }[] }
  const rollByClass = new Map<string, number>()
  for (const e of enrolments ?? []) rollByClass.set(e.class_id, (rollByClass.get(e.class_id) ?? 0) + 1)
  const billed = (feeStructures ?? []).reduce(
    (s, fs) => s + Number(fs.amount) * (fs.class_id ? rollByClass.get(fs.class_id) ?? 0 : enrolments?.length ?? 0),
    0,
  )
  const feeIds = (feeStructures ?? []).map((f) => f.id)
  const { data: payments } = feeIds.length
    ? await supabase.from('payments').select('id, amount_paid, paid_at, payment_method, students(first_name, last_name)').eq('school_id', schoolId).in('fee_structure_id', feeIds).order('paid_at', { ascending: false })
    : { data: [] as never[] }
  const collected = (payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0)

  const termStart = Date.parse(currentTerm?.start_date ?? currentSession.start_date)
  const weeks: number[] = []
  for (const p of payments ?? []) {
    if (!p.paid_at) continue
    const w = Math.floor((Date.parse(p.paid_at) - termStart) / (7 * 86_400_000))
    if (w < 0) continue
    weeks[w] = (weeks[w] ?? 0) + Number(p.amount_paid)
  }
  const weekBars = Array.from({ length: Math.max(weeks.length, 1) }, (_, i) => weeks[i] ?? 0).slice(-10)
  const todaysPayments = (payments ?? []).filter((p) => p.paid_at?.slice(0, 10) === today)

  // ---- Result batches in review ----
  const { data: batches } = currentTerm
    ? await supabase
        .from('result_batches')
        .select('id, status, submitted_at, subjects(name), classes(name), arms(name)')
        .eq('school_id', schoolId)
        .eq('term_id', currentTerm.id)
        .not('status', 'in', '(draft,returned,published)')
        .order('submitted_at', { ascending: true })
    : { data: [] as never[] }
  const inReview = batches ?? []

  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const firstWeek = weeks.length - weekBars.length

  return (
    <>
      <div className="px-5 pt-6 sm:px-8 empty:hidden"><SetupChecklist /></div>
      <AdminTodayView
        dateLabel={dateLabel}
        greeting={(() => {
          const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }).format(new Date()))
          return `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}${profile.first_name ? `, ${profile.first_name}` : ''}`
        })()}
        totalStudents={enrolments?.length ?? 0}
        classRoll={(classes ?? []).map((c) => ({ id: c.id, name: c.name, count: rollByClass.get(c.id) ?? 0 }))}
        today={today}
        termLabel={`${currentTerm?.name ?? 'No current term'} · ${currentSession.name}`}
        board={board}
        presentToday={presentToday}
        markedToday={markedToday}
        billed={billed}
        collected={collected}
        weekBars={weekBars.map((amount, i) => ({ label: `Wk ${firstWeek + i + 1}`, amount }))}
        inReview={inReview.map((b) => {
          const age = daysAgo(b.submitted_at, today)
          return { id: b.id, title: `${b.subjects?.name ?? 'Subject'} · ${b.classes?.name ?? ''}${b.arms?.name ?? ''}`, age, overdue: !(age === 'Today' || age === '1 day') }
        })}
        payments={todaysPayments.map((p) => ({
          id: p.id,
          name: p.students ? `${p.students.first_name} ${p.students.last_name}` : 'Student',
          method: (({ pos: 'POS', cash: 'Cash', bank_transfer: 'Bank transfer', transfer: 'Bank transfer', cheque: 'Cheque', card: 'Card' } as Record<string, string>)[p.payment_method ?? ''] ?? (p.payment_method ? p.payment_method.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—')),
          amount: Number(p.amount_paid),
        }))}
      />
    </>
  )
}
