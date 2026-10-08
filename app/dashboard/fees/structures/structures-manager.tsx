'use client'

import { useState, useTransition } from 'react'
import { saveFeeStructure, deleteFeeStructure } from '../actions'

type Structure = {
  id: string; name: string; amount: number
  session_id: string; term_id: string | null; class_id: string | null
  academic_sessions: { name: string } | null
  terms: { name: string } | null
  classes: { name: string } | null
}

export default function StructuresManager({
  structures, sessions, terms, classes,
}: {
  structures: Structure[]
  sessions: { id: string; name: string; is_current: boolean }[]
  terms: { id: string; name: string; session_id: string }[]
  classes: { id: string; name: string }[]
}) {
  const [isPending, startTransition] = useTransition()
  const currentSession = sessions.find((s) => s.is_current)
  const [form, setForm] = useState({
    id: '', name: '', amount: '',
    session_id: currentSession?.id ?? '', term_id: '', class_id: '',
  })
  const [error, setError] = useState('')

  const availableTerms = terms.filter((t) => t.session_id === form.session_id)

  function resetForm() {
    setForm({ id: '', name: '', amount: '', session_id: currentSession?.id ?? '', term_id: '', class_id: '' })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))
    startTransition(async () => {
      const result = await saveFeeStructure(fd)
      if (result?.error) setError(result.error)
      else resetForm()
    })
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-sm bg-surface border border-border rounded-xl overflow-hidden">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th className="p-3">Name</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Session</th>
            <th className="p-3">Term</th>
            <th className="p-3">Class</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {structures.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0">
              <td className="p-3 text-text-primary">{s.name}</td>
              <td className="p-3 text-text-secondary">₦{Number(s.amount).toLocaleString()}</td>
              <td className="p-3 text-text-secondary">{s.academic_sessions?.name}</td>
              <td className="p-3 text-text-secondary">{s.terms?.name ?? 'All terms'}</td>
              <td className="p-3 text-text-secondary">{s.classes?.name ?? 'All classes'}</td>
              <td className="p-3 flex gap-3">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setForm({
                    id: s.id, name: s.name, amount: String(s.amount),
                    session_id: s.session_id, term_id: s.term_id ?? '', class_id: s.class_id ?? '',
                  })}
                >
                  Edit
                </button>
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={() => startTransition(async () => {
                    const result = await deleteFeeStructure(s.id)
                    if (result?.error) setError(result.error)
                  })}
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
          <label className="block text-xs text-text-secondary mb-1">Component name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tuition" className="border border-border rounded-lg px-3 py-2 text-sm bg-background" required />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Amount (₦)</label>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm bg-background w-32" required />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Session</label>
          <select value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value, term_id: '' })} className="border border-border rounded-lg px-3 py-2 text-sm bg-background" required>
            <option value="">Select…</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Term (optional)</label>
          <select value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="">All terms this session</option>
            {availableTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Class (optional)</label>
          <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={isPending} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
          {form.id ? 'Update' : 'Add'}
        </button>
        {form.id && <button type="button" className="text-xs text-text-secondary hover:underline" onClick={resetForm}>Cancel edit</button>}
      </form>

      {error && <p className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</p>}
    </div>
  )
}