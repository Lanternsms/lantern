import Link from 'next/link'
import {
  ArrowRight01Icon, CalendarCheckIn01Icon, Invoice01Icon, Megaphone01Icon,
} from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'

export type BoardCell = { arm: string; cls: string; label: string; pct: number | null; present: number; size: number }
export type AdminTodayData = {
  dateLabel: string
  totalStudents: number
  classRoll: { id: string; name: string; count: number }[]
  today: string
  termLabel: string
  board: { level: string; cells: BoardCell[] }[]
  presentToday: number
  markedToday: number
  billed: number
  collected: number
  weekBars: { label: string; amount: number }[]
  inReview: { id: string; title: string; age: string; overdue: boolean }[]
  payments: { id: string; name: string; method: string; amount: number }[]
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
const nairaM = (n: number) => (n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}m` : naira(n))

/**
 * The principal's morning. One question first: is school running normally today?
 * The deep panel answers it (who is present, which registers are still open, the button that
 * fixes it); everything else is the next question down.
 */
export function AdminTodayView(d: AdminTodayData) {
  const rollMax = Math.max(1, ...d.classRoll.map((c) => c.count))
  const cells = d.board.flatMap((r) => r.cells)
  const open = cells.filter((c) => c.pct === null)
  const saved = cells.length - open.length
  const maxArms = Math.max(1, ...d.board.map((r) => r.cells.length))
  const pct = d.markedToday ? (d.presentToday / d.markedToday) * 100 : null
  const feePct = d.billed ? Math.round((d.collected / d.billed) * 100) : 0
  const weekMax = Math.max(1, ...d.weekBars.map((w) => w.amount))
  const paidToday = d.payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-semibold leading-[1.05] sm:text-[40px]">{d.dateLabel}</h1>
          <p className="text-[15px] text-text-secondary">{d.termLabel}</p>
        </div>
        <Link href="/dashboard/announcements/new" className="flex h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-medium shadow-card ring-1 ring-black/[0.06] hover:bg-raised">
          <Icon icon={Megaphone01Icon} size={17} />
          Send announcement
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* The deep panel: today, at the size it deserves. */}
        <section aria-labelledby="today-h" className="relative flex flex-col overflow-hidden rounded-[24px] bg-school-deep p-6 text-white shadow-raise sm:p-7 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h2 id="today-h" className="text-[15px] font-medium text-school-deep-muted">Present today</h2>
              <p className="font-display text-[64px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[80px]">
                {pct === null ? '—' : `${pct.toFixed(1)}%`}
              </p>
              <p className="text-[15px] text-school-deep-muted">
                {d.markedToday
                  ? `${d.presentToday.toLocaleString('en-NG')} of ${d.markedToday.toLocaleString('en-NG')} students in ${saved} saved registers`
                  : 'No register saved yet today'}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              {open.length > 0 ? (
                <p className="max-w-[260px] text-[15px] leading-snug sm:text-right">
                  <strong className="font-semibold">{open.length} register{open.length === 1 ? '' : 's'} still open</strong>
                  <span className="text-school-deep-muted"> — {open.slice(0, 3).map((c) => c.label).join(', ')}{open.length > 3 ? ` and ${open.length - 3} more` : ''}</span>
                </p>
              ) : (
                <p className="text-[15px] font-semibold">Every register is saved.</p>
              )}
              <Link href="/dashboard/attendance" className="flex h-11 items-center gap-2 rounded-xl bg-white px-4.5 text-sm font-semibold text-school-deep transition-transform hover:-translate-y-px">
                <Icon icon={CalendarCheckIn01Icon} size={18} className="text-school" />
                Open registers
              </Link>
            </div>
          </div>

          {d.board.length > 0 && (
            <div className="mt-auto pt-7">
              <div className="grid items-center gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `minmax(36px, 56px) repeat(${maxArms}, minmax(0, 1fr))` }}>
                {d.board.map((row) => [
                  <span key={row.level} className="text-[11px] font-medium text-school-deep-muted sm:text-[13px]">{row.level}</span>,
                  ...Array.from({ length: maxArms }, (_, i) => {
                    const c = row.cells[i]
                    if (!c) return <span key={`${row.level}-${i}`} />
                    const low = c.pct !== null && c.pct < 90
                    return (
                      <Link
                        key={c.arm}
                        href={`/dashboard/attendance?classId=${c.cls}&armId=${c.arm}&date=${d.today}`}
                        aria-label={c.pct === null ? `${c.label} register not saved` : `${c.label}: ${c.present} of ${c.size} present`}
                        title={c.label}
                        className={`flex h-9 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-transform hover:-translate-y-px sm:h-10 sm:rounded-lg sm:text-[13px] ${
                          c.pct === null
                            ? 'border border-dashed border-white/35 text-white/70'
                            : low
                              ? 'bg-white text-school-deep'
                              : 'bg-white/[0.09] text-white/90'
                        }`}
                      >
                        {c.pct === null ? 'Open' : `${c.pct}%`}
                      </Link>
                    )
                  }),
                ])}
              </div>
              <p className="mt-3 text-xs text-school-deep-muted">White cells are below 90% present. Tap any class arm to open its register.</p>
            </div>
          )}
        </section>

        <div className="grid gap-5 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <section aria-labelledby="fees-h" className="card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 id="fees-h" className="text-[15px] font-semibold">Fees this term</h2>
              <Link href="/dashboard/fees/record" className="text-sm font-medium text-primary hover:underline">Record</Link>
            </div>
            <p className="font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{nairaM(d.collected)}</p>
            <div className="h-2 overflow-hidden rounded-full bg-school-soft">
              <div className="h-full rounded-full bg-school" style={{ width: `${Math.min(100, feePct)}%` }} />
            </div>
            <p className="text-sm text-text-secondary">{d.billed ? `${feePct}% of ${nairaM(d.billed)} billed` : 'No fee structures for this term yet'}</p>
            {d.billed > d.collected && (
              <div className="mt-auto flex items-center justify-between rounded-xl bg-warning-bg px-3.5 py-2.5 text-sm text-warning-text">
                <span>Still outstanding</span>
                <span className="font-semibold tabular-nums">{nairaM(d.billed - d.collected)}</span>
              </div>
            )}
          </section>

          <section aria-labelledby="appr-h" className="card flex flex-col p-5">
            <div className="flex items-center justify-between">
              <h2 id="appr-h" className="text-[15px] font-semibold">Waiting for you</h2>
              <span className="rounded-full bg-school-soft px-2.5 py-0.5 text-sm font-semibold tabular-nums text-school-ink">{d.inReview.length}</span>
            </div>
            {d.inReview.length === 0 ? (
              <p className="mt-3 text-sm text-text-secondary">No result batches to approve.</p>
            ) : (
              <ul className="mb-3 mt-2">
                {d.inReview.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <Link href={`/dashboard/approvals/${b.id}`} className="flex min-h-11 items-center gap-3 border-b border-rule py-1 text-sm last:border-0 hover:text-primary">
                      <span className="flex-1 truncate font-medium">{b.title}</span>
                      <span className={`whitespace-nowrap text-xs ${b.overdue ? 'font-medium text-warning-text' : 'text-text-secondary'}`}>{b.age}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/approvals" className="mt-auto flex h-9 items-center justify-center gap-1.5 rounded-lg bg-raised text-sm font-medium hover:bg-school-soft hover:text-school-ink">
              Open approvals <Icon icon={ArrowRight01Icon} size={16} />
            </Link>
          </section>
        </div>

        <section aria-labelledby="weeks-h" className="card flex flex-col gap-4 p-5 sm:p-6 xl:col-span-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="weeks-h" className="text-[17px] font-semibold">Fees received by week</h2>
            <span className="text-sm text-text-secondary">₦ millions · current week in your colour</span>
          </div>
          {d.collected === 0 ? (
            <p className="py-8 text-text-secondary">No payments recorded this term yet.</p>
          ) : (
            <div className="flex h-[180px] items-end gap-2.5 sm:gap-3.5">
              {d.weekBars.map((w, i) => {
                const last = i === d.weekBars.length - 1
                return (
                  <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className={`text-xs tabular-nums ${last ? 'font-semibold text-school-ink' : 'text-text-secondary'}`}>{(w.amount / 1_000_000).toFixed(2)}</span>
                    <span className={`block w-full max-w-14 rounded-t-[10px] rounded-b-[4px] ${last ? 'bg-school' : 'bg-school-track/70'}`} style={{ height: `${Math.max(4, Math.round((w.amount / weekMax) * 130))}px` }} />
                    <span className="text-xs text-text-secondary">{w.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="pay-h" className="card flex flex-col p-5 xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 id="pay-h" className="text-[15px] font-semibold">Payments today</h2>
            <span className="text-sm font-semibold tabular-nums">{naira(paidToday)}</span>
          </div>
          {d.payments.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">No payments recorded today.</p>
          ) : (
            <ul className="mt-2">
              {d.payments.slice(0, 5).map((p) => (
                <li key={p.id} className="flex min-h-12 items-center gap-3 border-b border-rule last:border-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center text-text-secondary"><Icon icon={Invoice01Icon} size={18} /></span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-text-secondary">{p.method}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{naira(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="students-h" className="card flex flex-col gap-3 p-5 sm:p-6 xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 id="students-h" className="text-[15px] font-semibold">Students</h2>
            <Link href="/dashboard/students" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          <p className="font-display text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{d.totalStudents.toLocaleString('en-NG')}</p>
          <p className="text-sm text-text-secondary">
            Enrolled this session across {d.classRoll.filter((c) => c.count > 0).length} {d.classRoll.filter((c) => c.count > 0).length === 1 ? 'class' : 'classes'}
          </p>
        </section>

        <section aria-labelledby="classes-h" className="card flex flex-col gap-4 p-5 sm:p-6 xl:col-span-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="classes-h" className="text-[17px] font-semibold">Students per class</h2>
            <span className="text-sm text-text-secondary">This session</span>
          </div>
          {d.classRoll.length === 0 ? (
            <p className="py-8 text-text-secondary">No classes set up yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex h-[200px] min-w-max items-end gap-2.5 sm:min-w-0 sm:gap-3.5" role="list">
                {d.classRoll.map((c) => (
                  <div key={c.id} role="listitem" aria-label={`${c.name}: ${c.count} students`} className="flex h-full min-w-11 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-semibold tabular-nums text-school-ink">{c.count}</span>
                    <span className="block w-full max-w-14 rounded-t-[10px] rounded-b-[4px] bg-school" style={{ height: `${Math.max(4, Math.round((c.count / rollMax) * 140))}px` }} />
                    <span className="max-w-16 truncate text-xs text-text-secondary">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

    </div>
  )
}
