'use client'

import { useState, useTransition } from 'react'
import { saveAttendance } from './actions'

type Status = { id: string; label: string }
type Student = { id: string; first_name: string; last_name: string; admission_no: string; arm_id: string | null }
type Subject = { id: string; name: string }

/** Derive a colour theme from the status label so selected buttons look meaningful */
function statusTheme(label: string, selected: boolean) {
  const l = label.toLowerCase()
  if (l.includes('present')) {
    return selected
      ? 'bg-success-text text-white border-success-text'
      : 'border-border text-text-secondary hover:bg-success-bg hover:border-success-bg hover:text-success-text'
  }
  if (l.includes('absent')) {
    return selected
      ? 'bg-danger-text text-white border-danger-text'
      : 'border-border text-text-secondary hover:bg-danger-bg hover:border-danger-bg hover:text-danger-text'
  }
  if (l.includes('late')) {
    return selected
      ? 'bg-warning-text text-white border-warning-text'
      : 'border-border text-text-secondary hover:bg-warning-bg hover:border-warning-bg hover:text-warning-text'
  }
  return selected
    ? 'bg-primary text-white border-primary shadow-md'
    : 'border-border text-text-secondary hover:bg-surface-muted'
}

function markAllChipTheme(label: string) {
  const l = label.toLowerCase()
  if (l.includes('present')) return 'border-success-bg text-success-text hover:bg-success-bg active:bg-success-bg'
  if (l.includes('absent')) return 'border-danger-bg text-danger-text hover:bg-danger-bg active:bg-danger-bg'
  if (l.includes('late')) return 'border-warning-bg text-warning-text hover:bg-warning-bg active:bg-warning-bg'
  return 'border-border text-text-secondary hover:bg-surface-muted active:bg-background'
}

export default function MarkingGrid({
  classId,
  date,
  students,
  statuses,
  existingMarks,
  teachableSubjects,
}: {
  classId: string
  date: string
  students: Student[]
  statuses: Status[]
  existingMarks: { student_id: string; status_id: string; subject_id: string | null; marked_at: string }[]
  teachableSubjects: Subject[]
}) {
  const [isPending, startTransition] = useTransition()
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    existingMarks.forEach((m) => { initial[m.student_id] = m.status_id })
    return initial
  })
  const [subjectId, setSubjectId] = useState<string>(
    existingMarks[0]?.subject_id ?? teachableSubjects[0]?.id ?? ''
  )
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState('')

  const lastMarkedAt = existingMarks.length > 0 && existingMarks[0]?.marked_at
    ? new Date(existingMarks[0].marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  function setMark(studentId: string, statusId: string) {
    setMarks((prev) => ({ ...prev, [studentId]: statusId }))
    setError('')
    setSavedMessage('')
  }

  function markAllAs(statusId: string) {
    const next: Record<string, string> = {}
    students.forEach((s) => { next[s.id] = statusId })
    setMarks(next)
    setError('')
    setSavedMessage('')
  }

  function handleSave() {
    setError('')
    setSavedMessage('')
    const unmarked = students.filter((s) => !marks[s.id])
    if (unmarked.length > 0) {
      setError(`${unmarked.length} student(s) still unmarked.`)
      return
    }
    const payload = students.map((s) => ({ studentId: s.id, armId: s.arm_id, statusId: marks[s.id] }))
    startTransition(async () => {
      const result = await saveAttendance({
        classId,
        date,
        subjectId: subjectId || null,
        marks: payload,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSavedMessage(`Attendance saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`)
      }
    })
  }

  if (students.length === 0) {
    return <p className="text-sm text-text-secondary">No students enrolled for this selection.</p>
  }

  const markedCount = students.filter((s) => marks[s.id]).length
  const allMarked = markedCount === students.length
  const progressPct = Math.round((markedCount / students.length) * 100)

  return (
    <div className="space-y-4">
      {teachableSubjects.length > 0 && (
        <div>
          <label className="block text-xs text-text-secondary mb-1">Subject (for this attendance record)</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-surface"
          >
            <option value="">General (no specific subject)</option>
            {teachableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {lastMarkedAt && (
        <p className="text-xs text-text-secondary">Last saved today at {lastMarkedAt}.</p>
      )}

      {/* Mark-all chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-text-secondary">Mark all as:</span>
        {statuses.map((s) => (
          <button
            key={s.id}
            onClick={() => markAllAs(s.id)}
            className={`text-xs border rounded-full px-3 py-1 font-medium transition-all duration-150 active:scale-95 ${markAllChipTheme(s.label)}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-text-secondary whitespace-nowrap">
          {markedCount} / {students.length} marked
        </span>
      </div>

      {/* Student table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-secondary bg-surface-muted">
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5">Admission No.</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const isFullyMarked = !!marks[s.id]
              return (
                <tr
                  key={s.id}
                  className={`border-b border-border last:border-0 transition-colors duration-100 ${isFullyMarked ? 'bg-surface' : 'bg-warning-bg'}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200 ${isFullyMarked ? 'bg-success-text' : 'bg-warning-text'}`}
                      />
                      <span className="font-medium text-text-primary">
                        {s.first_name} {s.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.admission_no}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {statuses.map((st) => {
                        const selected = marks[s.id] === st.id
                        return (
                          <button
                            key={st.id}
                            onClick={() => setMark(s.id, st.id)}
                            className={`text-xs rounded-full px-3 py-1 border font-medium transition-all duration-150 active:scale-95 ${statusTheme(st.label, selected)}`}
                          >
                            {st.label}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Feedback messages */}
      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {savedMessage && (
        <p className="text-sm text-success-text bg-success-bg border border-success-bg rounded-lg px-3 py-2">
          ✓ {savedMessage}
        </p>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isPending}
        className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
          allMarked
            ? 'bg-primary text-white hover:bg-primary-hover '
            : 'bg-primary/80 text-white hover:bg-primary'
        }`}
      >
        {isPending && (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {isPending ? 'Saving…' : 'Save Attendance'}
      </button>
    </div>
  )
}