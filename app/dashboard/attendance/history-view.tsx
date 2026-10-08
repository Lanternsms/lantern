'use client'

import { useState, useEffect, useCallback } from 'react'

export default function HistoryView({ classId, armId }: { classId: string; armId: string | null }) {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ classId, from, to })
    if (armId) params.set('armId', armId)
    return params
  }, [classId, armId, from, to])

  useEffect(() => {
    let active = true

    async function loadHistory() {
      if (!classId || !from || !to) return
      setLoading(true)
      try {
        const res = await fetch(`/api/attendance/history?${buildParams().toString()}`)
        const data = await res.json()
        if (active) {
          setRows(data.rows ?? [])
        }
      } catch (err) {
        if (active) {
          setRows([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadHistory()

    return () => {
      active = false
    }
  }, [classId, armId, from, to, buildParams])

  function getStatusBadge(label: string) {
    const l = (label || '').toLowerCase()
    if (l.includes('present')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    if (l.includes('absent')) {
      return 'bg-red-50 text-red-700 border-red-200'
    }
    if (l.includes('late')) {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
          />
        </div>

        {/* Highlighted History indicator replacing the old View History button */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm select-none">
          {loading ? (
            <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 1118 0z" />
            </svg>
          )}
          <span>History</span>
        </div>

        <a
          href={`/api/attendance/export?${buildParams().toString()}`}
          className="inline-flex items-center gap-1.5 border border-border bg-surface hover:bg-surface-muted text-text-primary rounded-lg px-3.5 py-2 text-sm font-medium transition-colors shadow-sm hover:border-text-secondary/40 active:scale-95"
        >
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Export CSV</span>
        </a>
      </div>

      {loading && rows === null ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <svg className="w-4 h-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading attendance history…
          </div>
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-text-secondary">
          No attendance records in this range.
        </div>
      ) : rows && rows.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-secondary bg-surface-muted/30">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">Admission No.</th>
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Subject</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Marked By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/20 transition-colors">
                  <td className="p-3 text-text-secondary font-mono text-xs">{r.date}</td>
                  <td className="p-3 text-text-secondary font-mono text-xs">{r.time ?? '—'}</td>
                  <td className="p-3 text-text-secondary font-mono text-xs">{r.admission_no || '—'}</td>
                  <td className="p-3 font-medium text-text-primary">{r.student_name}</td>
                  <td className="p-3 text-text-secondary">{r.subject_name ?? 'General'}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(r.status_label)}`}>
                      {r.status_label}
                    </span>
                  </td>
                  <td className="p-3 text-text-secondary">{r.marked_by_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}