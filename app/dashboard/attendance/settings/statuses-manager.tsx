// app/dashboard/attendance/settings/statuses-manager.tsx
'use client'

import { useState, useTransition } from 'react'
import { saveAttendanceStatus, deleteAttendanceStatus } from '../actions'

type Status = { id: string; code: string; label: string; counts_as_present: boolean }

export default function StatusesManager({ statuses }: { statuses: Status[] }) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ id: '', code: '', label: '', counts_as_present: false })
  const [error, setError] = useState('')

  function resetForm() {
    setForm({ id: '', code: '', label: '', counts_as_present: false })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const fd = new FormData()
    fd.set('id', form.id)
    fd.set('code', form.code)
    fd.set('label', form.label)
    if (form.counts_as_present) fd.set('counts_as_present', 'on')
    startTransition(async () => {
      const result = await saveAttendanceStatus(fd)
      if (result?.error) setError(result.error)
      else resetForm()
    })
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-sm bg-surface border border-border rounded-xl overflow-hidden">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th className="p-3">Code</th>
            <th className="p-3">Label</th>
            <th className="p-3">Counts as present?</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0">
              <td className="p-3 text-text-secondary">{s.code}</td>
              <td className="p-3 text-text-primary">{s.label}</td>
              <td className="p-3">{s.counts_as_present ? 'Yes' : 'No'}</td>
              <td className="p-3 flex gap-3">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setForm({ id: s.id, code: s.code, label: s.label, counts_as_present: s.counts_as_present })}
                >
                  Edit
                </button>
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteAttendanceStatus(s.id)
                      if (result?.error) setError(result.error)
                    })
                  }
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Code</label>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="present / absent / late"
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Label (shown to teachers)</label>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Present"
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            required
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={form.counts_as_present}
            onChange={(e) => setForm({ ...form, counts_as_present: e.target.checked })}
          />
          Counts as present
        </label>
        <button type="submit" disabled={isPending} className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          {form.id ? 'Update' : 'Add'}
        </button>
        {form.id && (
          <button type="button" className="text-xs text-text-secondary hover:underline" onClick={resetForm}>
            Cancel edit
          </button>
        )}
      </form>

      {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
    </div>
  )
}