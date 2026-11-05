'use client'

import { startTransition, useActionState, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/icon'
import { Call02Icon, Mail01Icon, WhatsappIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'
import { markContacted, saveDemo, type SaveState } from './actions'
import { DEMO_STATUSES, NEXT_STEP, STATUS_LABEL, STATUS_TONE, type DemoRow, type DemoStatus } from './shared'

const lagos = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', ...opts }).format(new Date(iso))

/** 0803 123 4567 → 2348031234567 for WhatsApp links. */
function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('234')) return d
  if (d.startsWith('0')) return `234${d.slice(1)}`
  return d
}

function ago(iso: string, now: number) {
  const mins = Math.round((now - Date.parse(iso)) / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export function DemoCard({ d, now }: { d: DemoRow; now: number }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDemo, {})
  const [status, setStatus] = useState<DemoStatus>(d.status)
  const [open, setOpen] = useState(d.status === 'new')
  const first = d.name.replace(/^(mr|mrs|ms|miss|dr|prof|chief|alhaji|alhaja)\.?\s+/i, '').split(/\s+/)[0]
  const wa = `https://wa.me/${waNumber(d.phone)}?text=${encodeURIComponent(`Hello ${first}, this is Lantern. Thanks for asking for a demo for ${d.school}. When is a good time for a 30-minute call?`)}`
  const stale = d.status === 'new' && now - Date.parse(d.created_at) > 24 * 3600 * 1000

  return (
    <article className="card flex flex-col gap-4 p-5" aria-labelledby={`demo-${d.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={`demo-${d.id}`} className="text-[17px] font-semibold leading-snug">{d.school}</h3>
          <p className="text-sm text-text-secondary">{d.name} · {d.role}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
          <span className={`text-xs ${stale ? 'font-semibold text-danger-text' : 'text-text-secondary'}`}>{stale ? `Waiting ${ago(d.created_at, now).replace(' ago', '')}` : ago(d.created_at, now)}</span>
        </div>
      </div>

      {d.demo_at && d.status === 'scheduled' && (
        <p className="rounded-xl bg-school-soft px-3.5 py-2.5 text-sm font-medium text-school-ink">
          Demo {lagos(d.demo_at, { weekday: 'long', day: 'numeric', month: 'short' })} at {lagos(d.demo_at, { hour: 'numeric', minute: '2-digit', hour12: true })}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-text-secondary">Phone</dt><dd className="font-medium tabular-nums">{d.phone}</dd></div>
        <div><dt className="text-xs text-text-secondary">Students</dt><dd className="font-medium">{d.students ?? 'Not said'}</dd></div>
        <div><dt className="text-xs text-text-secondary">Best time</dt><dd className="font-medium">{d.preferred_time ?? 'Any time'}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-text-secondary">Email</dt><dd className="truncate font-medium">{d.email ?? '—'}</dd></div>
      </dl>
      {d.notes && <p className="rounded-xl bg-raised px-3.5 py-2.5 text-sm"><span className="text-text-secondary">They wrote: </span>{d.notes}</p>}

      <div className="flex flex-wrap gap-2">
        <a href={`tel:${d.phone.replace(/\s/g, '')}`} className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><Icon icon={Call02Icon} size={17} /> Call</a>
        <a href={wa} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-xl border border-control bg-surface px-4 text-sm font-semibold hover:bg-raised"><Icon icon={WhatsappIcon} size={17} /> WhatsApp</a>
        {d.email && <a href={`mailto:${d.email}?subject=${encodeURIComponent(`Your Lantern demo for ${d.school}`)}`} className="flex h-11 items-center gap-2 rounded-xl border border-control bg-surface px-4 text-sm font-semibold hover:bg-raised"><Icon icon={Mail01Icon} size={17} /> Email</a>}
        {d.status === 'new' && (
          <form action={markContacted}><input type="hidden" name="id" value={d.id} />
            <button className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-secondary hover:bg-raised hover:text-text-primary"><Icon icon={CheckmarkCircle02Icon} size={17} /> I’ve contacted them</button>
          </form>
        )}
        {d.status === 'won' && !d.onboarded_school_id && (
          <Link href={`/platform-admin/onboard?demo=${d.id}`} className="flex h-11 items-center rounded-xl bg-success-text px-4 text-sm font-semibold text-white">Onboard this school</Link>
        )}
        {d.onboarded_school_id && <span className="flex h-11 items-center gap-1.5 text-sm font-semibold text-success-text"><Icon icon={CheckmarkCircle02Icon} size={17} /> Onboarded</span>}
      </div>

      <div className="border-t border-rule pt-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-sm font-semibold">
          <span>{NEXT_STEP[d.status] ? `Next: ${NEXT_STEP[d.status]}` : 'Update'}</span>
          <span className="text-text-secondary">{open ? 'Hide' : 'Update'}</span>
        </button>
        {open && (
          <form
            // Submit by hand so React doesn't reset the fields after a failed save.
            onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)) }}
            className="mt-3 flex flex-col gap-3"
          >
            <input type="hidden" name="id" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">Stage
                <select name="status" value={status} onChange={(e) => setStatus(e.target.value as DemoStatus)} className="h-11 rounded-xl border border-control bg-surface px-3 text-sm text-text-primary">
                  {DEMO_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">Demo date
                <input type="date" name="demo_date" defaultValue={d.demo_at ? lagos(d.demo_at, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-') : ''} className="h-11 rounded-xl border border-control bg-surface px-3 text-sm text-text-primary" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">Time (Lagos)
                <input type="time" name="demo_time" defaultValue={d.demo_at ? lagos(d.demo_at, { hour: '2-digit', minute: '2-digit', hour12: false }) : ''} className="h-11 rounded-xl border border-control bg-surface px-3 text-sm text-text-primary" />
              </label>
            </div>
            {status === 'lost' && (
              <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">Why did we lose it?
                <input name="lost_reason" defaultValue={d.lost_reason ?? ''} placeholder="e.g. Price, chose another system, not ready this term" className="h-11 rounded-xl border border-control bg-surface px-3 text-sm text-text-primary" />
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">Your notes (only Lantern sees these)
              <textarea name="admin_notes" rows={3} defaultValue={d.admin_notes ?? ''} placeholder="What did they say? What do they need?" className="rounded-xl border border-control bg-surface px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={pending} className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">{pending ? 'Saving…' : 'Save'}</button>
              {state.error && <p role="alert" className="text-sm text-danger-text">{state.error}</p>}
              {state.ok && !pending && <p role="status" className="text-sm text-success-text">Saved.</p>}
            </div>
          </form>
        )}
      </div>
    </article>
  )
}
