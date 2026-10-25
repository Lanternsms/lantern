'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { RosterEntry, AttendanceStatus } from '@/app/dashboard/lms/attendance/actions'
import { savePeriodAttendance } from '@/app/dashboard/lms/attendance/actions'

interface RosterWidgetProps {
  timetableEntryId: string
  date: string
  roster: RosterEntry[]
  statuses: AttendanceStatus[]
}

export default function RosterWidget({
  timetableEntryId,
  date,
  roster,
  statuses,
}: RosterWidgetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ marked: number; total: number; present: number } | null>(null)

  // initialise from existing marks
  const initialMarks: Record<string, string> = {}
  for (const s of roster) {
    if (s.existingStatusId) initialMarks[s.id] = s.existingStatusId
  }
  const [marks, setMarks] = useState<Record<string, string>>(initialMarks)

  // double-click guard
  const savingRef = useRef(false)

  const presentStatus = statuses.find(
    (s) => (s.code || '').toLowerCase() === 'present' || (s.label || '').toLowerCase().includes('present')
  )

  const markedCount = Object.keys(marks).length

  function handleStatusChange(studentId: string, statusId: string) {
    setMarks((prev) => ({ ...prev, [studentId]: statusId }))
  }

  function handleMarkAllPresent() {
    if (!presentStatus) return
    const next: Record<string, string> = {}
    for (const s of roster) {
      next[s.id] = presentStatus.id
    }
    setMarks(next)
  }

  function handleSave() {
    if (savingRef.current || isPending) return
    savingRef.current = true
    setError(null)

    const markArray = Object.entries(marks).map(([studentId, statusId]) => ({
      studentId,
      statusId,
    }))

    startTransition(async () => {
      const res = await savePeriodAttendance({
        timetableEntryId,
        date,
        marks: markArray,
      })
      savingRef.current = false
      if (!res.ok) {
        setError(res.error)
      } else {
        setResult({ marked: res.marked, total: res.total, present: res.present })
        setSaved(true)
      }
    })
  }

  if (saved && result) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-text-primary">Attendance saved!</p>
          <p className="text-sm text-text-secondary mt-1">
            {result.marked} of {result.total} students marked · {result.present} present
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/lms/today')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover px-5 py-2.5 rounded-lg transition-colors"
        >
          ← Back to Today&apos;s Lessons
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{markedCount}</span> of{' '}
          <span className="font-semibold text-text-primary">{roster.length}</span> marked
        </p>
        <div className="flex items-center gap-2">
          {presentStatus && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={isPending}
              className="text-xs font-medium border border-border rounded-lg px-3 py-2 bg-surface hover:bg-surface-muted transition-colors disabled:opacity-50"
            >
              Mark all present
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || markedCount === 0}
            className="text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Roster table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {roster.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            No students enrolled for this class{' '}
            {/* arm-specific message omitted intentionally */}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/40 text-text-secondary text-xs border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Student</th>
                <th className="text-left px-4 py-2.5 font-medium">Adm. No</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roster.map((student) => (
                <tr key={student.id} className="hover:bg-surface-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs whitespace-nowrap">
                    {student.admission_no}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
                      {statuses.map((status) => {
                        const selected = marks[student.id] === status.id
                        const code = (status.code || '').toLowerCase()
                        const label = (status.label || '').toLowerCase()
                        let colorClass = 'border-border text-text-secondary hover:border-primary hover:text-primary'
                        if (selected) {
                          if (status.counts_as_present || code === 'present' || label.includes('present')) {
                            colorClass = 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                          } else if (code === 'late' || label.includes('late')) {
                            colorClass = 'border-amber-500 bg-amber-50 text-amber-700 font-semibold'
                          } else {
                            colorClass = 'border-red-400 bg-red-50 text-red-700 font-semibold'
                          }
                        }
                        return (
                          <button
                            key={status.id}
                            type="button"
                            onClick={() => handleStatusChange(student.id, status.id)}
                            disabled={isPending}
                            className={`text-xs px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50 ${colorClass}`}
                          >
                            {status.label}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom save bar */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
        <p className="text-xs text-text-secondary">
          {markedCount} / {roster.length} marked
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || markedCount === 0}
          className="text-sm font-semibold text-white bg-primary hover:bg-primary-hover px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save attendance'}
        </button>
      </div>
    </div>
  )
}
