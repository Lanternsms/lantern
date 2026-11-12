'use client'

import { useState, useTransition } from 'react'
import { saveAttendance } from './actions'

type Status = { id: string; label: string }
type Student = { id: string; first_name: string; last_name: string; admission_no: string; arm_id: string | null }

type Tone = 'present' | 'late' | 'absent' | 'other'
function tone(label: string): Tone {
  const l = label.toLowerCase()
  if (l.includes('present')) return 'present'
  if (l.includes('late')) return 'late'
  if (l.includes('absent')) return 'absent'
  return 'other'
}
const SELECTED: Record<Tone, string> = {
  present: 'bg-primary text-white',
  late: 'bg-warning-text text-white',
  absent: 'bg-danger-text text-white',
  other: 'bg-text-primary text-white',
}

export default function MarkingGrid({
  classId,
  date,
  subjectId,
  subjectName,
  students,
  statuses,
  existingMarks,
}: {
  classId: string
  date: string
  subjectId: string
  subjectName: string
  students: Student[]
  statuses: Status[]
  existingMarks: { student_id: string; status_id: string; subject_id: string | null; marked_at: string }[]
}) {
  const [isPending, startTransition] = useTransition()
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    existingMarks.forEach((m) => { initial[m.student_id] = m.status_id })
    return initial
  })
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

  function markRestAs(statusId: string) {
    const next: Record<string, string> = { ...marks }
    students.forEach((s) => { if (!next[s.id]) next[s.id] = statusId })
    setMarks(next)
    setError('')
    setSavedMessage('')
  }

  function handleSave() {
    setError('')
    setSavedMessage('')
    const unmarked = students.filter((s) => !marks[s.id])
    if (unmarked.length > 0) {
      setError(`${unmarked.length} student${unmarked.length === 1 ? ' is' : 's are'} still unmarked.`)
      return
    }
    const payload = students.map((s) => ({ studentId: s.id, armId: s.arm_id, statusId: marks[s.id] }))
    startTransition(async () => {
      const result = await saveAttendance({
        classId,
        date,
        subjectId,
        marks: payload,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSavedMessage(`Attendance saved at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Guardians of absent and late students are being told.`)
      }
    })
  }

  if (students.length === 0) {
    return <p className="card p-6 text-text-secondary">No students are enrolled in this class arm yet.</p>
  }

  const markedCount = students.filter((s) => marks[s.id]).length
  const left = students.length - markedCount
  const presentStatus = statuses.find((st) => tone(st.label) === 'present')
  const counts = statuses.map((st) => ({ ...st, n: students.filter((s) => marks[s.id] === st.id).length }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2" aria-live="polite">
          {counts.map((c) => (
            <span key={c.id} className="flex flex-col">
              <span className="text-2xl font-semibold tabular-nums">{c.n}</span>
              <span className="text-sm text-text-secondary">{c.label}</span>
            </span>
          ))}
          <span className="flex flex-col">
            <span className="text-2xl font-semibold tabular-nums">{left}</span>
            <span className="text-sm text-text-secondary">Not marked</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 items-center gap-1.5 rounded-md border border-control bg-surface px-3 text-sm font-medium text-text-primary">
            <span className="text-text-secondary text-xs">Subject:</span> {subjectName}
          </span>
          {presentStatus && left > 0 && (
            <button type="button" onClick={() => markRestAs(presentStatus.id)} className="h-9 rounded-md border border-control bg-surface px-3.5 text-sm font-medium hover:bg-raised">
              Mark the rest {presentStatus.label.toLowerCase()}
            </button>
          )}
        </div>
      </div>

      {lastMarkedAt && <p className="text-sm text-text-secondary">Last saved today at {lastMarkedAt}. Changes save over it.</p>}

      <ol className="card overflow-hidden">
        {students.map((s, i) => {
          const current = marks[s.id]
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-2.5 last:border-0">
              <span className="w-6 text-right text-xs tabular-nums text-text-secondary">{i + 1}</span>
              <span className="flex min-w-[160px] flex-1 flex-col">
                <span className="font-medium">{s.first_name} {s.last_name}</span>
                <span className={`text-xs ${current ? 'text-text-secondary' : 'text-warning-text'}`}>{current ? s.admission_no : 'Not marked yet'}</span>
              </span>
              <div role="radiogroup" aria-label={`${s.first_name} ${s.last_name}`} className="flex w-full gap-0.5 rounded-lg bg-raised p-[3px] sm:w-auto">
                {statuses.map((st) => {
                  const selected = current === st.id
                  return (
                    <button
                      key={st.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMark(s.id, st.id)}
                      className={`h-11 min-w-[72px] flex-1 rounded-md px-2.5 sm:h-[34px] sm:flex-none text-sm font-medium ${selected ? SELECTED[tone(st.label)] : 'text-[#374151] hover:bg-surface'}`}
                    >
                      {st.label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>

      {error && <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2.5 text-sm text-danger-text">{error}</p>}
      {savedMessage && <p role="status" className="rounded-lg bg-success-bg px-3 py-2.5 text-sm text-success-text">{savedMessage}</p>}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <span className="text-sm text-text-secondary">{left ? `${markedCount} of ${students.length} marked` : `All ${students.length} marked`}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={`flex h-11 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${left ? 'bg-raised text-text-secondary' : 'bg-primary text-white hover:bg-primary-hover'}`}
        >
          {isPending ? 'Saving…' : left ? `Mark ${left} more to save` : 'Save attendance'}
        </button>
      </div>
    </div>
  )
}
