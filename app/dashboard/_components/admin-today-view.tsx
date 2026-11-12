import Link from 'next/link'
import {
  ArrowRight01Icon, Invoice01Icon, Megaphone01Icon, Money03Icon, UserCheck01Icon,
} from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'
import { AttendanceTrendChart, type DailyPoint } from './attendance-trend-chart'

export type AdminTodayData = {
  dateLabel: string
  greeting?: string
  totalStudents: number
  classRoll: { id: string; name: string; count: number }[]
  today: string
  termLabel: string
  attendance: {
    termName: string
    sessionName: string
    termAvg: number | null
    today: { date: string; pct: number | null } | null
    daily: DailyPoint[]
    classes: {
      id: string
      name: string
      pct: number | null
      recent: { date: string; pct: number | null }[]
    }[]
    lowest: { id: string; name: string; pct: number } | null
  }
  billed: number
  collected: number
  weekBars: { label: string; amount: number }[]
  inReview: { id: string; title: string; age: string; overdue: boolean }[]
  payments: { id: string; name: string; method: string; amount: number }[]
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
const nairaM = (n: number) => (n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}m` : naira(n))

function ClassSparkline({ recent }: { recent: { date: string; pct: number | null }[] }) {
  const width = 130
  const height = 26
  const valid = recent.filter((r) => r.pct !== null)
  if (valid.length === 0) {
    return <div className="w-[130px] h-[26px] flex items-center justify-center text-[11px] text-text-muted">—</div>
  }

  const pcts = valid.map((r) => r.pct as number)
  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length
  const color = avg < 90 ? '#FDB104' : '#023879'

  const padY = 4
  const plotH = height - padY * 2
  const minVal = Math.min(...pcts, 80)
  const maxVal = Math.max(...pcts, 100)
  const range = maxVal - minVal || 1

  const points = valid.map((r, i) => {
    const x = valid.length === 1 ? width / 2 : (i / (valid.length - 1)) * (width - 10) + 5
    const y = padY + plotH * (1 - (r.pct! - minVal) / range)
    return { x, y }
  })

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`), '')
  const lastPt = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      {points.length > 1 && (
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={color} />
    </svg>
  )
}

export function AdminTodayView(d: AdminTodayData) {
  const rollMax = Math.max(1, ...d.classRoll.map((c) => c.count))
  const feePct = d.billed ? Math.round((d.collected / d.billed) * 100) : 0
  const weekMax = Math.max(1, ...d.weekBars.map((w) => w.amount))
  const paidToday = d.payments.reduce((s, p) => s + p.amount, 0)

  const sortedClasses = [...d.attendance.classes].sort((a, b) => {
    if (a.pct === null && b.pct === null) return a.name.localeCompare(b.name)
    if (a.pct === null) return 1
    if (b.pct === null) return -1
    return a.pct - b.pct
  })

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-semibold leading-[1.05] sm:text-[40px]">{d.greeting ?? d.dateLabel}</h1>
          <p className="text-[15px] text-text-secondary">{d.greeting ? `${d.dateLabel} · ${d.termLabel}` : d.termLabel}</p>
        </div>
        <Link href="/dashboard/announcements/new" className="hidden h-10 items-center sm:flex gap-2 rounded-xl bg-surface px-4 text-sm font-medium shadow-card ring-1 ring-black/[0.06] hover:bg-raised">
          <Icon icon={Megaphone01Icon} size={17} />
          Send announcement
        </Link>
      </div>

      {/* Phones: the three jobs an admin does standing up, one tap each. */}
      <nav aria-label="Quick actions" className="-mt-1 grid grid-cols-3 gap-2.5 sm:hidden">
        {[
          { href: '/dashboard/attendance', label: 'Attendance', icon: UserCheck01Icon },
          { href: '/dashboard/fees/record', label: 'Record fee', icon: Money03Icon },
          { href: '/dashboard/announcements/new', label: 'Announce', icon: Megaphone01Icon },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface text-[13px] font-medium shadow-card ring-1 ring-black/[0.05] active:scale-[0.97] active:bg-school-soft transition-transform duration-100">
            <span className="text-school-ink"><Icon icon={a.icon} size={22} /></span>
            {a.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Attendance card */}
        <section aria-labelledby="attendance-h" className="card flex flex-col gap-6 p-6 sm:p-7 xl:col-span-8">
          {/* 1. Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 id="attendance-h" className="text-lg sm:text-xl font-semibold text-text-primary">
                Attendance
              </h2>
              <p className="text-sm text-text-secondary">
                {d.attendance.termName} · {d.attendance.sessionName}
              </p>
            </div>
            <Link
              href="/dashboard/attendance"
              className="flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-4.5 text-sm font-semibold text-white transition-transform hover:-translate-y-px shrink-0"
            >
              <Icon icon={UserCheck01Icon} size={18} />
              View attendance
            </Link>
          </div>

          {/* 2. Stat tiles or empty state */}
          {d.attendance.termAvg === null && !d.attendance.lowest ? (
            <p className="text-sm text-text-secondary py-1">No attendance recorded this term yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
              <div className="rounded-xl bg-ground/60 p-3 sm:p-4 flex flex-col justify-between">
                <span className="text-[11px] sm:text-xs text-text-secondary font-medium">Term average</span>
                <span className="mt-1 font-display text-lg sm:text-2xl font-bold tabular-nums text-text-primary">
                  {d.attendance.termAvg !== null ? `${d.attendance.termAvg.toFixed(1)}%` : '—'}
                </span>
              </div>

              <div className="rounded-xl bg-ground/60 p-3 sm:p-4 flex flex-col justify-between">
                <span className="text-[11px] sm:text-xs text-text-secondary font-medium">Today</span>
                <span className="mt-1 font-display text-lg sm:text-2xl font-bold tabular-nums text-text-primary">
                  {d.attendance.today?.pct !== null && d.attendance.today?.pct !== undefined ? (
                    `${d.attendance.today.pct.toFixed(1)}%`
                  ) : (
                    <span className="text-xs sm:text-sm font-normal text-text-muted">Not taken yet</span>
                  )}
                </span>
              </div>

              <div className="rounded-xl bg-ground/60 p-3 sm:p-4 flex flex-col justify-between">
                <span
                  className="text-[11px] sm:text-xs text-text-secondary font-medium truncate"
                  title={d.attendance.lowest ? `Lowest: ${d.attendance.lowest.name}` : 'Lowest'}
                >
                  {d.attendance.lowest ? `Lowest: ${d.attendance.lowest.name}` : 'Lowest'}
                </span>
                <span className={`mt-1 font-display text-lg sm:text-2xl font-bold tabular-nums ${
                  d.attendance.lowest && d.attendance.lowest.pct < 90 ? 'text-warning-text' : 'text-text-primary'
                }`}>
                  {d.attendance.lowest ? `${d.attendance.lowest.pct.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          )}

          {/* 3. Trend chart */}
          <AttendanceTrendChart daily={d.attendance.daily} termAvg={d.attendance.termAvg} />

          {/* 4. Classes, lowest first */}
          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
              Classes, lowest first
            </h3>

            {sortedClasses.length === 0 ? (
              <p className="text-sm text-text-secondary">No classes with enrolled students.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border/60">
                {sortedClasses.map((c) => {
                  const isWarning = c.pct !== null && c.pct < 90
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/attendance?classId=${c.id}`}
                      className="flex min-h-[44px] items-center gap-3 sm:gap-4 py-2 px-1 rounded-lg hover:bg-school-soft/50 transition-colors"
                    >
                      <span className="w-20 sm:w-28 shrink-0 truncate text-sm font-medium text-text-primary" title={c.name}>
                        {c.name}
                      </span>

                      <div className="flex-1 h-2 rounded-full bg-school-soft overflow-hidden relative">
                        <div
                          className={`h-full rounded-full ${isWarning ? 'bg-[#FDB104]' : 'bg-[#023879]'}`}
                          style={{ width: `${Math.min(100, Math.max(0, c.pct ?? 0))}%` }}
                        />
                      </div>

                      <span className={`w-12 sm:w-14 shrink-0 text-right text-sm font-semibold tabular-nums ${isWarning ? 'text-warning-text' : 'text-text-primary'}`}>
                        {c.pct === null ? '—' : `${c.pct.toFixed(1)}%`}
                      </span>

                      <div className="hidden sm:block shrink-0 w-[130px]">
                        <ClassSparkline recent={c.recent} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* 5. Footer line */}
          <p className="text-xs text-text-secondary -mt-2">
            Tap a class to see its day-by-day record. Gold means below 90%.
          </p>
        </section>

        <div className="grid gap-5 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <section aria-labelledby="students-h" className="card flex flex-col gap-3 p-5 sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <h2 id="students-h" className="text-[15px] font-semibold">Students</h2>
              <Link href="/dashboard/students" className="text-sm font-medium text-primary hover:underline">View all</Link>
            </div>
            <p className="font-display text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{d.totalStudents.toLocaleString('en-NG')}</p>
            <p className="text-sm text-text-secondary">
              Enrolled this session across {d.classRoll.filter((c) => c.count > 0).length} {d.classRoll.filter((c) => c.count > 0).length === 1 ? 'class' : 'classes'}
            </p>
          </section>

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
        <section aria-labelledby="classes-h" className="card flex flex-col gap-4 p-5 sm:p-6 xl:col-span-12">
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