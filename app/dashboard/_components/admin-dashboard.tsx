import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getTodayInLagos } from '../lms/lagos-time'
import { SetupChecklist } from './setup-checklist'

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
const nairaM = (n: number) => (n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}m` : naira(n))

function daysAgo(iso: string | null, todayStr: string) {
  if (!iso) return ''
  const d = Math.round((Date.parse(todayStr) - Date.parse(iso.slice(0, 10))) / 86_400_000)
  return d <= 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`
}

type Cell = { arm: string; cls: string; label: string; pct: number | null; present: number; size: number }

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
        <section className="rounded-lg border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold">No current session yet</h1>
          <p className="mt-1 max-w-[60ch] text-text-secondary">
            Today’s registers, fees and results appear here once a session and term are set as current.
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
  const maxArms = Math.max(1, ...board.map((r) => r.cells.length))
  const allCells = board.flatMap((r) => r.cells)
  const open = allCells.filter((c) => c.pct === null)
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
  const weekMax = Math.max(1, ...weekBars)
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

  return (
    <div className="flex flex-col gap-5 px-5 pb-10 pt-7 sm:px-8 sm:pt-8">
      <SetupChecklist />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] sm:text-[32px]">{dateLabel}</h1>
          <p className="text-[15px] text-text-secondary">
            {currentTerm?.name ?? 'No current term'} · {currentSession.name}
            {open.length > 0 && savedCells.length > 0 && (
              <>
                {' · '}
                <strong className="font-semibold text-text-primary">
                  {open.length} register{open.length === 1 ? '' : 's'} still open
                </strong>
                {' — '}
                {open.slice(0, 4).map((c) => c.label).join(', ')}
                {open.length > 4 ? ` and ${open.length - 4} more` : ''}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/announcements/new" className="flex h-9 items-center rounded-md border border-control bg-surface px-3.5 text-sm font-medium hover:bg-raised">
            Send announcement
          </Link>
          <Link href="/dashboard/attendance" className="flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-semibold text-white hover:bg-primary-hover">
            Open registers
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Today in numbers" className="grid grid-cols-2 rounded-lg border border-border bg-surface md:grid-cols-4">
            {[
              { label: 'Present today', value: markedToday ? presentToday.toLocaleString('en-NG') : '—', unit: markedToday ? ` / ${markedToday.toLocaleString('en-NG')}` : '', note: markedToday ? `${((presentToday / markedToday) * 100).toFixed(1)}% of students in saved registers` : 'No register saved yet today' },
              { label: 'Registers saved', value: String(savedCells.length), unit: ` / ${allCells.length}`, note: open.length ? `${open.length} still open` : 'All saved', warn: open.length > 0 && savedCells.length > 0 },
              { label: 'Fees collected', value: nairaM(collected), unit: '', note: billed ? `${Math.round((collected / billed) * 100)}% of ${nairaM(billed)} billed this term` : 'No fee structures this term' },
              { label: 'Waiting for approval', value: String(inReview.length), unit: '', note: inReview.length === 1 ? 'result batch' : 'result batches' },
            ].map((k, i) => (
              <div key={k.label} className={`flex flex-col gap-1.5 px-5 py-4 ${i % 2 ? 'border-l border-border' : ''} ${i > 1 ? 'border-t border-border md:border-t-0' : ''} ${i === 2 ? 'md:border-l' : ''}`}>
                <span className="text-sm text-text-secondary">{k.label}</span>
                <span className="text-2xl font-semibold tabular-nums">{k.value}<span className="text-sm font-normal text-text-secondary">{k.unit}</span></span>
                <span className={`text-xs ${k.warn ? 'text-warning-text' : 'text-text-secondary'}`}>{k.note}</span>
              </div>
            ))}
          </section>

          <section aria-labelledby="registers" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="registers" className="text-lg font-semibold">Registers this morning</h2>
                <p className="text-sm text-text-secondary">Each class arm, share of students present</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-school-track" />Saved</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-school" />Below 90% present</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] border border-dashed border-text-muted" />Not saved</span>
              </div>
            </div>
            {board.length === 0 ? (
              <p className="py-6 text-text-secondary">
                No students are enrolled in a class arm this session yet. <Link href="/dashboard/students" className="font-medium text-primary underline-offset-4 hover:underline">Add students</Link>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid min-w-[480px] items-center gap-1.5" style={{ gridTemplateColumns: `64px repeat(${maxArms}, minmax(0, 1fr))` }}>
                  {board.map((row) => [
                    <span key={row.level} className="text-sm font-semibold">{row.level}</span>,
                    ...Array.from({ length: maxArms }, (_, i) => {
                      const c = row.cells[i]
                      if (!c) return <span key={`${row.level}-${i}`} />
                      const low = c.pct !== null && c.pct < 90
                      return (
                        <Link
                          key={c.arm}
                          href={`/dashboard/attendance?classId=${c.cls}&armId=${c.arm}&date=${today}`}
                          aria-label={c.pct === null ? `${c.label} register not saved` : `${c.label}: ${c.present} of ${c.size} present`}
                          className={`flex h-11 items-center justify-center rounded-md text-sm font-medium tabular-nums transition-[filter] hover:brightness-95 ${
                            c.pct === null
                              ? 'border border-dashed border-text-muted bg-surface text-text-secondary'
                              : low
                                ? 'bg-school text-white'
                                : 'bg-school-track text-school-ink'
                          }`}
                        >
                          {c.pct === null ? 'Open' : `${c.pct}%`}
                        </Link>
                      )
                    }),
                  ])}
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="fees-week" className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="fees-week" className="text-lg font-semibold">Fees received by week</h2>
              <span className="text-sm text-text-secondary">This term · {nairaM(collected)} so far</span>
            </div>
            {collected === 0 ? (
              <p className="py-6 text-text-secondary">No payments recorded this term yet.</p>
            ) : (
              <>
                <div className="flex h-[150px] items-end gap-3 border-b border-border">
                  {weekBars.map((v, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                      <span className="text-xs tabular-nums text-[#374151]">{v ? (v / 1_000_000).toFixed(2) : '0'}</span>
                      <span className={`block w-full max-w-14 rounded-t ${i === weekBars.length - 1 ? 'bg-school' : 'bg-control'}`} style={{ height: `${Math.max(2, Math.round((v / weekMax) * 110))}px` }} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 text-center text-xs text-text-secondary">
                  {weekBars.map((_, i) => <span key={i} className="flex-1">Wk {weeks.length - weekBars.length + i + 1}</span>)}
                </div>
                <p className="text-xs text-text-secondary">Amounts in ₦ millions. The current week is in your school colour.</p>
              </>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col">
          <h2 className="mb-2 text-base font-semibold">Waiting for your approval</h2>
          <div className="rounded-lg border border-border bg-surface px-4 pb-3">
            {inReview.length === 0 ? (
              <p className="py-4 text-sm text-text-secondary">Nothing to approve right now.</p>
            ) : (
              inReview.slice(0, 5).map((b) => {
                const age = daysAgo(b.submitted_at, today)
                return (
                  <Link key={b.id} href={`/dashboard/approvals/${b.id}`} className="flex min-h-[52px] items-center gap-3 border-b border-rule">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{b.subjects?.name ?? 'Subject'} · {b.classes?.name}{b.arms?.name}</span>
                    </span>
                    <span className={`whitespace-nowrap text-xs ${age.startsWith('Today') || age === '1 day' ? 'text-text-secondary' : 'text-warning-text'}`}>{age}</span>
                  </Link>
                )
              })
            )}
            <Link href="/dashboard/approvals" className="mt-3 flex h-[30px] items-center justify-center rounded-md border border-control text-sm font-medium hover:bg-raised">
              {inReview.length > 5 ? `View all ${inReview.length}` : 'Open approvals'}
            </Link>
          </div>

          <h2 className="mb-2 mt-4 text-base font-semibold">Payments today</h2>
          <div className="rounded-lg border border-border bg-surface px-4 pb-3">
            {todaysPayments.length === 0 ? (
              <p className="py-4 text-sm text-text-secondary">No payments recorded today.</p>
            ) : (
              <>
                {todaysPayments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex min-h-12 items-center gap-3 border-b border-rule">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{p.students ? `${p.students.first_name} ${p.students.last_name}` : 'Student'}</span>
                      <span className="text-xs capitalize text-text-secondary">{p.payment_method?.replace(/_/g, ' ') ?? '—'}</span>
                    </span>
                    <span className="font-medium tabular-nums">{naira(Number(p.amount_paid))}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 text-text-secondary">
                  <span>Total today</span>
                  <span className="font-semibold tabular-nums text-text-primary">{naira(todaysPayments.reduce((s, p) => s + Number(p.amount_paid), 0))}</span>
                </div>
              </>
            )}
            <Link href="/dashboard/fees/record" className="mt-3 flex h-[30px] items-center justify-center rounded-md border border-control text-sm font-medium hover:bg-raised">
              Record a payment
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
