'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

type RecordRow = {
  id: string
  date: string
  time: string
  admission_no: string
  student_name: string
  status_label: string
  counts_as_present?: boolean
  subject_name: string
  marked_by_name: string | null
}

const formatDisplayDate = (iso: string) => {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d)
  } catch {
    return iso
  }
}

export default function HistoryView({
  classId,
  armId,
  subjects = [],
}: {
  classId: string
  armId: string | null
  subjects?: { id: string; name: string }[]
}) {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [subjectFilter, setSubjectFilter] = useState('')
  const [rows, setRows] = useState<RecordRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ classId, from, to })
    if (armId) params.set('armId', armId)
    if (subjectFilter) params.set('subjectId', subjectFilter)
    return params
  }, [classId, armId, from, to, subjectFilter])

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
          // By default, expand the first (latest) date
          if (data.rows && data.rows.length > 0) {
            setExpandedDates(new Set([data.rows[0].date]))
          }
        }
      } catch {
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

  // Group rows by date
  const dailyGroups = useMemo(() => {
    if (!rows) return []
    const groupsMap = new Map<string, RecordRow[]>()
    for (const r of rows) {
      const existing = groupsMap.get(r.date) ?? []
      existing.push(r)
      groupsMap.set(r.date, existing)
    }

    return Array.from(groupsMap.entries()).map(([date, items]) => {
      const total = items.length
      const present = items.filter((i) =>
        i.counts_as_present !== undefined
          ? i.counts_as_present
          : i.status_label.toLowerCase().includes('present')
      ).length
      const absent = total - present
      const pct = total > 0 ? Math.round((present / total) * 100) : 0
      return {
        date,
        total,
        present,
        absent,
        pct,
        items,
      }
    })
  }, [rows])

  function toggleDate(date: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  function toggleAll() {
    if (expandedDates.size === dailyGroups.length) {
      setExpandedDates(new Set())
    } else {
      setExpandedDates(new Set(dailyGroups.map((g) => g.date)))
    }
  }

  function getStatusBadge(label: string) {
    const l = (label || '').toLowerCase()
    if (l.includes('present')) {
      return 'bg-success-bg text-success-text border-success-bg'
    }
    if (l.includes('absent')) {
      return 'bg-danger-bg text-danger-text border-danger-bg'
    }
    if (l.includes('late')) {
      return 'bg-warning-bg text-warning-text border-warning-bg'
    }
    return 'bg-school-soft text-school-ink border-school-track'
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="card px-3 py-2 text-sm"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="daily_older">Daily (older record)</option>
            </select>
          </div>
          {dailyGroups.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="px-3 py-2 text-sm text-primary hover:underline font-medium"
            >
              {expandedDates.size === dailyGroups.length ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        <a
          href={`/api/attendance/export?${buildParams().toString()}`}
          className="inline-flex items-center gap-1.5 border border-border bg-surface hover:bg-school-soft/40 text-text-primary rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:border-text-secondary/40 active:scale-95"
        >
          <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Export CSV</span>
        </a>
      </div>

      {loading && rows === null ? (
        <div className="card p-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <svg className="w-4 h-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading attendance records…
          </div>
        </div>
      ) : dailyGroups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-text-secondary">
          No attendance records found for this period.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dailyGroups.map((g) => {
            const isExpanded = expandedDates.has(g.date)
            const isWarning = g.pct < 90
            return (
              <div key={g.date} className="card overflow-hidden transition-all duration-150">
                {/* Day summary row */}
                <button
                  type="button"
                  onClick={() => toggleDate(g.date)}
                  className="w-full flex flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-raised/40 transition-colors"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-4 h-4 text-text-secondary transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <div>
                      <span className="font-semibold text-text-primary text-sm sm:text-base">
                        {formatDisplayDate(g.date)}
                      </span>
                      <span className="block text-xs text-text-secondary sm:hidden">
                        {g.present} present · {g.absent} absent ({g.total} marked)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5 ml-auto sm:ml-0">
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      <span className="text-success-text font-medium">{g.present} present</span>
                      <span className="text-text-muted">·</span>
                      <span className="text-danger-text font-medium">{g.absent} absent</span>
                      <span className="text-text-muted">·</span>
                      <span className="text-text-secondary">{g.total} total</span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                        isWarning
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-success-bg text-success-text border border-success-bg'
                      }`}
                    >
                      {g.pct}%
                    </span>
                  </div>
                </button>

                {/* Per-student status expansion */}
                {isExpanded && (
                  <div className="border-t border-border overflow-x-auto bg-surface">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-rule text-left text-xs text-text-secondary bg-surface-muted/30">
                          <th className="p-3 font-medium">Student</th>
                          <th className="p-3 font-medium">Admission No.</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium">Subject</th>
                          <th className="p-3 font-medium">Time</th>
                          <th className="p-3 font-medium">Marked By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-border last:border-0 hover:bg-school-soft/30 transition-colors"
                          >
                            <td className="p-3 font-medium text-text-primary">{r.student_name}</td>
                            <td className="p-3 text-text-secondary font-mono text-xs">{r.admission_no || '—'}</td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                  r.status_label
                                )}`}
                              >
                                {r.status_label}
                              </span>
                            </td>
                            <td className="p-3 text-text-secondary">{r.subject_name ?? 'General'}</td>
                            <td className="p-3 text-text-secondary font-mono text-xs">{r.time ?? '—'}</td>
                            <td className="p-3 text-text-secondary">{r.marked_by_name ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
