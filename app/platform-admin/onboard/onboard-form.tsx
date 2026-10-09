'use client'

import { useState, useTransition } from 'react'
import { createSchool } from './actions'

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function OnboardForm() {
  const [schoolName, setSchoolName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ schoolId: string; slug: string; adminEmail: string } | null>(null)

  function handleNameChange(value: string) {
    setSchoolName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createSchool(formData)
      if (res?.error) setError(res.error)
      else if (res?.success) setResult({ schoolId: res.schoolId, slug: res.slug, adminEmail: res.adminEmail })
    })
  }

  if (result) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-emerald-600">School created</h2>
        <p className="text-sm text-text-secondary">
          <span className="font-medium text-text-primary">{result.slug}</span> is set up, and an invite email was sent to{' '}
          <span className="font-medium text-text-primary">{result.adminEmail}</span> so they can set their password and sign in.
        </p>
        <p className="text-xs text-text-secondary">
          Grading scale isn't seeded yet — set that up from the school's own settings after first login.
        </p>
        <button
          onClick={() => { setResult(null); setSchoolName(''); setSlug(''); setSlugTouched(false) }}
          className="text-sm font-medium text-primary hover:underline"
        >
          Onboard another school
        </button>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">School</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-text-secondary space-y-1 block">
            School name
            <input name="schoolName" required value={schoolName} onChange={(e) => handleNameChange(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-secondary space-y-1 block">
            Slug (subdomain)
            <input name="slug" required value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }} className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary font-mono" />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">First admin account</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-text-secondary space-y-1 block">
            First name
            <input name="adminFirstName" required className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-secondary space-y-1 block">
            Last name
            <input name="adminLastName" required className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-secondary space-y-1 block sm:col-span-2">
            Email
            <input name="adminEmail" type="email" required className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
        </div>
        <p className="text-[11px] text-text-secondary">They'll get an email to set their own password — nothing is shown here in plain text.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">First academic session & term</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs text-text-secondary space-y-1 block">
            Session name
            <input name="sessionName" placeholder="2025/2026" required className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-secondary space-y-1 block">
            Session start
            <input name="sessionStart" type="date" required className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-secondary space-y-1 block">
            Session end
            <input name="sessionEnd" type="date" required className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs text-text-secondary space-y-1 block">
            First term name
            <input name="termName" placeholder="First Term" className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-secondary space-y-1 block">
            Term start
            <input name="termStart" type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-secondary space-y-1 block">
            Term end
            <input name="termEnd" type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary" />
          </label>
        </div>
        <p className="text-[11px] text-text-secondary">Leave term dates blank to reuse the session's dates.</p>
      </section>

      <button type="submit" disabled={isPending} className="w-full bg-primary text-white text-sm font-medium py-2.5 rounded-lg hover:bg-primary-hover disabled:opacity-60 transition-colors">
        {isPending ? 'Creating school…' : 'Create school & invite admin'}
      </button>
    </form>
  )
}