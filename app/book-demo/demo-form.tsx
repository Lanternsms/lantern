'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { authButton, authError, authInput, authLabel } from '@/components/auth/auth-layout'
import { requestDemo, type DemoState } from './actions'

const ROLES = ['Proprietor / owner', 'Principal', 'Vice principal', 'School administrator', 'Bursar', 'Teacher', 'Other']
const SIZES = ['Under 200', '200 – 500', '500 – 1,000', 'Over 1,000']
const TIMES = ['Weekday morning', 'Weekday afternoon', 'Weekday evening', 'Saturday']

export function DemoForm() {
  const [state, action, pending] = useActionState<DemoState, FormData>(requestDemo, { ok: false })
  const f: Record<string, string> = state.fields ?? {}

  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <div className="rounded-xl bg-success-bg px-4 py-4 text-success-text">
          <p className="font-semibold">Thanks, we’ve got your request.</p>
          <p className="mt-1 text-sm">We’ll call you within one working day to pick a time. Have a class list handy and we’ll set it up while you watch.</p>
        </div>
        <Link href="/" className="text-sm font-medium text-text-primary underline decoration-control underline-offset-4">Back to the website</Link>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <p role="alert" className={authError}>{state.error}</p>}

      <label className={authLabel}>
        Your name
        <input name="name" required autoComplete="name" defaultValue={f.name} className={authInput} placeholder="e.g. Mrs. Adaeze Okafor" />
      </label>
      <label className={authLabel}>
        School name
        <input name="school" required autoComplete="organization" defaultValue={f.school} className={authInput} placeholder="e.g. Greenfield College, Lekki" />
      </label>
      <label className={authLabel}>
        Your role
        <select key={`role-${f.role ?? ""}`} name="role" required defaultValue={f.role ?? ''} className={authInput}>
          <option value="" disabled>Choose one</option>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className={authLabel}>
        Phone number
        <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" defaultValue={f.phone} className={authInput} placeholder="0803 123 4567" />
        <span className="text-[13px] font-normal text-text-secondary">We’ll call or WhatsApp you on this number.</span>
      </label>
      <label className={authLabel}>
        <span>Email <span className="font-normal text-text-secondary">(optional)</span></span>
        <input name="email" type="email" autoComplete="email" defaultValue={f.email} className={authInput} placeholder="you@school.com" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={authLabel}>
          Number of students
          <select key={`students-${f.students ?? ""}`} name="students" defaultValue={f.students ?? ''} className={authInput}>
            <option value="">Not sure</option>
            {SIZES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className={authLabel}>
          Best time to call
          <select key={`time-${f.preferred_time ?? ""}`} name="preferred_time" defaultValue={f.preferred_time ?? ''} className={authInput}>
            <option value="">Any time</option>
            {TIMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className={authLabel}>
        <span>Anything we should know? <span className="font-normal text-text-secondary">(optional)</span></span>
        <textarea name="notes" rows={3} defaultValue={f.notes} className={`${authInput} h-auto py-2.5`} placeholder="e.g. We want to start next term, or we use another system today" />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <button type="submit" disabled={pending} className={`${authButton} mt-1 h-12`}>
        {pending ? 'Sending…' : 'Book my demo'}
      </button>
      <p className="text-[13px] text-text-secondary">A 30-minute call, free. No payment details needed.</p>
    </form>
  )
}
