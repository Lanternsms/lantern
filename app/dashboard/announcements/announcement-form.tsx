'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'staff', label: 'Staff (all employees)' },
  { value: 'student', label: 'Students' },
  { value: 'guardian', label: 'Guardians' },
]

export default function AnnouncementForm({
  initial,
  onSubmit,
}: {
  initial?: { title: string; body: string; audience: string[] }
  onSubmit: (formData: FormData) => Promise<{ error?: string } | void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [audience, setAudience] = useState<string[]>(initial?.audience ?? ['all'])

  function toggleAudience(value: string) {
    setAudience((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    audience.forEach((a) => fd.append('audience', a))
    startTransition(async () => {
      const result = await onSubmit(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-xs text-text-secondary mb-1">Title</label>
        <input
          name="title"
          defaultValue={initial?.title}
          required
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface"
        />
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Message</label>
        <textarea
          name="body"
          defaultValue={initial?.body}
          required
          rows={6}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface"
        />
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-2">Who should see this?</label>
        <div className="space-y-2">
          {AUDIENCE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={audience.includes(opt.value)}
                onChange={() => toggleAudience(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {audience.includes('all') && audience.length > 1 && (
          <p className="text-xs text-text-secondary mt-1">
            "Everyone" already covers the other groups you've selected.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || audience.length === 0}
          className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Post announcement'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/announcements')}
          className="text-sm text-text-secondary hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}