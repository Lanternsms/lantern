'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadDocument } from '../actions'

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'staff', label: 'Staff (all employees)' },
  { value: 'student', label: 'Students' },
  { value: 'guardian', label: 'Guardians' },
]

type ClassRow = { id: string; name: string; level: number | null; arms: { id: string; name: string }[] }

export default function UploadForm({ classes }: { classes: ClassRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [audience, setAudience] = useState<string[]>(['all'])
  const [classId, setClassId] = useState('')
  const [armId, setArmId] = useState('')

  const arms = classes.find((c) => c.id === classId)?.arms ?? []

  function toggleAudience(value: string) {
    setAudience((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    audience.forEach((a) => fd.append('audience', a))
    if (classId) fd.set('class_id', classId)
    if (armId) fd.set('arm_id', armId)

    startTransition(async () => {
      const result = await uploadDocument(fd)
      if (result?.error) setError(result.error)
      else router.push('/dashboard/documents')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-xs text-text-secondary mb-1">Title</label>
        <input name="title" required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Description (optional)</label>
        <textarea name="description" rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">File (PDF or image, max 10MB)</label>
        <input
          name="file"
          type="file"
          accept=".pdf,image/*"
          required
          className="block w-full text-xs text-text-secondary cursor-pointer file:cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:text-xs file:font-medium file:text-text-primary file:bg-surface hover:file:bg-surface-muted file:transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-2">Who should see this?</label>
        <div className="space-y-2">
          {AUDIENCE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={audience.includes(opt.value)} onChange={() => toggleAudience(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Limit to a class (optional)</label>
          <select
            value={classId}
            onChange={(e) => { setClassId(e.target.value); setArmId('') }}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
          >
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {classId && arms.length > 0 && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">Limit to an arm (optional)</label>
            <select value={armId} onChange={(e) => setArmId(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface">
              <option value="">All arms</option>
              {arms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending || audience.length === 0} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
          {isPending ? 'Uploading…' : 'Upload'}
        </button>
        <button type="button" onClick={() => router.push('/dashboard/documents')} className="text-sm text-text-secondary hover:underline">
          Cancel
        </button>
      </div>
    </form>
  )
}