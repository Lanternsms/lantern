export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlatformAdminNav } from '../_components/platform-admin-nav'
import { lockPlatformAdmin } from '../actions'
import { DemoCard } from './demo-card'
import { DEMO_STATUSES, STATUS_LABEL, type DemoRow, type DemoStatus } from './shared'

const lagos = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', ...opts }).format(new Date(iso))

export default async function DemoRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  if (!(await hasValidPlatformAdminSession())) redirect('/platform-admin')
  const sp = await searchParams
  const view = (DEMO_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as DemoStatus) : sp.status === 'all' ? 'all' : 'open'
  const q = (sp.q ?? '').trim().toLowerCase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient() as any)
    .from('demo_requests')
    .select('id, created_at, name, school, role, phone, email, students, preferred_time, notes, status, demo_at, admin_notes, lost_reason, onboarded_school_id')
    .order('created_at', { ascending: false })
    .limit(500)
  const all: DemoRow[] = data ?? []

  const counts = Object.fromEntries(DEMO_STATUSES.map((s) => [s, all.filter((d) => d.status === s).length])) as Record<DemoStatus, number>
  const openCount = all.length - counts.won - counts.lost
  // Server component: rendered once per request, so reading the clock here is safe.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const upcoming = all
    .filter((d) => d.status === 'scheduled' && d.demo_at && Date.parse(d.demo_at) > now - 2 * 3600 * 1000)
    .sort((a, b) => Date.parse(a.demo_at!) - Date.parse(b.demo_at!))
  const thisMonth = all.filter((d) => Date.parse(d.created_at) > now - 30 * 86400000).length
  const decided = counts.won + counts.lost
  const winRate = decided ? Math.round((counts.won / decided) * 100) : null

  const shown = all
    .filter((d) => (view === 'all' ? true : view === 'open' ? d.status !== 'won' && d.status !== 'lost' : d.status === view))
    .filter((d) => !q || [d.school, d.name, d.phone, d.email ?? ''].some((v) => v.toLowerCase().includes(q)))
  // Open view: most urgent first (new, then contacted, then booked by date, then done).
  if (view === 'open') {
    const rank: Record<string, number> = { new: 0, contacted: 1, scheduled: 2, demo_done: 3 }
    shown.sort((a, b) => rank[a.status] - rank[b.status] || (a.status === 'scheduled' ? Date.parse(a.demo_at ?? '') - Date.parse(b.demo_at ?? '') : 0))
  }

  const href = (status: string) => `/platform-admin/demos?${new URLSearchParams({ ...(status !== 'open' ? { status } : {}), ...(q ? { q } : {}) })}`
  const filters: { key: string; label: string; n: number }[] = [
    { key: 'open', label: 'To do', n: openCount },
    ...DEMO_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], n: counts[s] })),
    { key: 'all', label: 'All', n: all.length },
  ]

  return (
    <div className="min-h-screen bg-ground px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-5xl flex-col">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[32px]">Demo requests</h1>
            <p className="mt-1 text-[15px] text-text-secondary">Schools that asked for a demo on the website.</p>
          </div>
          <form action={lockPlatformAdmin}><button type="submit" className="text-sm text-text-secondary hover:text-text-primary">Lock</button></form>
        </div>
        <PlatformAdminNav active="demos" />

        {error && (
          <p role="alert" className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">
            Couldn’t load demo requests: {error.message}. If the table is missing, run the demo_requests migrations in Supabase.
          </p>
        )}

        <section aria-label="Summary" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'New, not contacted', value: counts.new, warn: counts.new > 0 },
            { label: 'Demos booked', value: counts.scheduled },
            { label: 'Requests in 30 days', value: thisMonth },
            { label: 'Won', value: counts.won, note: winRate === null ? '' : `${winRate}% of decided` },
          ].map((s) => (
            <div key={s.label} className="card flex flex-col gap-1 p-4">
              <span className="text-[13px] text-text-secondary">{s.label}</span>
              <span className={`font-display text-[28px] font-semibold leading-none tabular-nums ${s.warn ? 'text-danger-text' : ''}`}>{s.value}</span>
              {s.note && <span className="text-xs text-text-secondary">{s.note}</span>}
            </div>
          ))}
        </section>

        {upcoming.length > 0 && (
          <section aria-labelledby="up-h" className="mb-5 rounded-[20px] bg-school-deep p-5 text-white shadow-raise sm:p-6">
            <h2 id="up-h" className="mb-3 text-sm font-medium text-school-deep-muted">Coming up</h2>
            <ol className="flex flex-col gap-2">
              {upcoming.slice(0, 5).map((d) => (
                <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-xl bg-white/[0.07] px-4 py-3">
                  <span className="font-semibold">{d.school}</span>
                  <span className="text-sm tabular-nums text-school-deep-muted">
                    {lagos(d.demo_at!, { weekday: 'short', day: 'numeric', month: 'short' })} · {lagos(d.demo_at!, { hour: 'numeric', minute: '2-digit', hour12: true })} · {d.name}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="mb-4 flex flex-col gap-3">
          <nav aria-label="Filter by stage" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {filters.map((f) => (
              <Link key={f.key} href={href(f.key)} aria-current={view === f.key ? 'page' : undefined}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${view === f.key ? 'bg-primary text-white' : 'bg-surface text-text-secondary ring-1 ring-black/[0.06] hover:text-text-primary'}`}>
                {f.label}<span className={`tabular-nums ${view === f.key ? 'text-white/75' : 'text-text-muted'}`}>{f.n}</span>
              </Link>
            ))}
          </nav>
          <form method="get" className="flex gap-2">
            {view !== 'open' && <input type="hidden" name="status" value={view} />}
            <input name="q" defaultValue={sp.q ?? ''} placeholder="Search school, name, phone or email" aria-label="Search demo requests"
              className="h-11 min-w-0 flex-1 rounded-xl border border-control bg-surface px-3.5 text-[15px] focus:border-primary focus:outline-none focus:ring-4 focus:ring-school-soft sm:max-w-md" />
            <button className="h-11 rounded-xl border border-control bg-surface px-4 text-sm font-semibold hover:bg-raised">Search</button>
          </form>
        </div>

        {shown.length === 0 ? (
          <div className="card flex flex-col gap-1 p-8 text-center">
            <p className="font-semibold">{all.length === 0 ? 'No demo requests yet' : q ? 'Nothing matches that search' : 'Nothing here'}</p>
            <p className="text-sm text-text-secondary">
              {all.length === 0 ? 'When a school fills in the form at /book-demo, it shows up here and on the tab count.' : view === 'open' ? 'Every request has been won or closed. Nice work.' : 'Try another stage or clear the search.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">{shown.map((d) => <DemoCard key={d.id} d={d} now={now} />)}</div>
        )}
      </div>
    </div>
  )
}
