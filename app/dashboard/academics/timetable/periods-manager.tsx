'use client'

import { useState, useTransition } from 'react'
import { savePeriod, deletePeriod } from './actions'

type Period = {
  id: string
  name: string
  start_time: string
  end_time: string
  sort_order: number
  is_break: boolean
}

export default function PeriodsManager({ periods }: { periods: Period[] }) {
  const [open, setOpen] = useState(periods.length === 0)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    id: '',
    name: '',
    start_time: '',
    end_time: '',
    sort_order: String(periods.length + 1),
    is_break: false,
  })

  function resetForm() {
    setForm({ id: '', name: '', start_time: '', end_time: '', sort_order: String(periods.length + 1), is_break: false })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'is_break') {
        if (v) fd.set('is_break', 'on')
      } else {
        fd.set(k, String(v))
      }
    })
    startTransition(async () => {
      await savePeriod(fd)
      resetForm()
    })
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm font-semibold text-text-primary flex items-center gap-2"
      >
        {open ? '▾' : '▸'} Manage Periods ({periods.length})
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-border">
                <th className="py-1 pr-2">Order</th>
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 pr-2">Start</th>
                <th className="py-1 pr-2">End</th>
                <th className="py-1 pr-2">Break?</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="py-1 pr-2">{p.sort_order}</td>
                  <td className="py-1 pr-2">{p.name}</td>
                  <td className="py-1 pr-2">{p.start_time}</td>
                  <td className="py-1 pr-2">{p.end_time}</td>
                  <td className="py-1 pr-2">{p.is_break ? 'Yes' : ''}</td>
                  <td className="py-1 flex gap-2">
                    <button
                      className="text-primary text-xs hover:underline"
                      onClick={() =>
                        setForm({
                          id: p.id,
                          name: p.name,
                          start_time: p.start_time,
                          end_time: p.end_time,
                          sort_order: String(p.sort_order),
                          is_break: p.is_break,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="text-danger text-xs hover:underline"
                      onClick={() => startTransition(async () => { await deletePeriod(p.id) })}
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
              <label className="block text-xs text-text-secondary mb-1">Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="w-20 border border-border rounded-lg px-2 py-1 text-sm bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Period 1 / Break"
                className="border border-border rounded-lg px-2 py-1 text-sm bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Start</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="border border-border rounded-lg px-2 py-1 text-sm bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">End</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="border border-border rounded-lg px-2 py-1 text-sm bg-background"
                required
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={form.is_break}
                onChange={(e) => setForm({ ...form, is_break: e.target.checked })}
              />
              Is a break
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {form.id ? 'Update period' : 'Add period'}
            </button>
            {form.id && (
              <button type="button" className="text-xs text-text-secondary hover:underline" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  )
}