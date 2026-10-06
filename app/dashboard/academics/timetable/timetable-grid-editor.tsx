'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveTimetableEntry, deleteTimetableEntry } from './actions'

const DAYS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
]

type Period = { id: string; name: string; start_time: string; end_time: string; sort_order: number; is_break: boolean }
type ClassRow = { id: string; name: string; level: number | null; arms: { id: string; name: string }[] }
type Entry = {
    id: string
    day_of_week: number
    period_id: string
    subject_id: string
    teacher_id: string | null
}

export default function TimetableGridEditor({
    sessionId,
    periods,
    classes,
    subjects,
    teachers,
    selectedClassId,
    selectedArmId,
    entries,
}: {
    sessionId: string
    periods: Period[]
    classes: ClassRow[]
    subjects: { id: string; name: string }[]
    teachers: { id: string; name: string }[]
    selectedClassId: string
    selectedArmId: string | null
    entries: Entry[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [editingCell, setEditingCell] = useState<{ day: number; periodId: string } | null>(null)
    const [cellForm, setCellForm] = useState({ subjectId: '', teacherId: '' })
    const [warning, setWarning] = useState<string | null>(null)
    const [conflictMessage, setConflictMessage] = useState<string | null>(null)

    const selectedClass = classes.find((c) => c.id === selectedClassId)
    const arms = selectedClass?.arms ?? []
    const teachingPeriods = periods.filter((p) => !p.is_break)

    function entryFor(day: number, periodId: string) {
        return entries.find((e) => e.day_of_week === day && e.period_id === periodId)
    }

    function openCell(day: number, periodId: string) {
        const existing = entryFor(day, periodId)
        setCellForm({ subjectId: existing?.subject_id ?? '', teacherId: existing?.teacher_id ?? '' })
        setWarning(null)
        setConflictMessage(null)
        setEditingCell({ day, periodId })
    }

    function handleClassChange(classId: string) {
        router.push(`/dashboard/academics/timetable?classId=${classId}`)
    }

    function handleArmChange(armId: string) {
        router.push(`/dashboard/academics/timetable?classId=${selectedClassId}&armId=${armId}`)
    }

    function saveCell(force = false) {
        if (!editingCell || !cellForm.subjectId) return
        // Arms-having classes must have an arm selected before saving
        if (arms.length > 0 && !selectedArmId) return
        startTransition(async () => {
            const result = await saveTimetableEntry({
                sessionId,
                classId: selectedClassId,
                armId: selectedArmId,
                dayOfWeek: editingCell.day,
                periodId: editingCell.periodId,
                subjectId: cellForm.subjectId,
                teacherId: cellForm.teacherId || null,
                force,
            })
            if ('error' in result && result.error) {
                setWarning(result.error)
            } else if ('conflict' in result && result.conflict) {
                setConflictMessage(result.conflict)
            } else {
                setConflictMessage(null)
                setEditingCell(null)
                router.refresh()
            }
        })
    }

    function clearCell() {
        const existing = editingCell && entryFor(editingCell.day, editingCell.periodId)
        if (!existing) {
            setEditingCell(null)
            return
        }
        startTransition(async () => {
            await deleteTimetableEntry(existing.id)
            setEditingCell(null)
            router.refresh()
        })
    }

    return (
      <>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap gap-3">
                <div>
                    <label className="block text-xs text-text-secondary mb-1">Class</label>
                    <select
                        value={selectedClassId}
                        onChange={(e) => handleClassChange(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    >
                        <option value="">Select a class…</option>
                        {classes.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                {selectedClassId && arms.length > 0 && (
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">Arm</label>
                        <select
                            value={selectedArmId ?? ''}
                            onChange={(e) => handleArmChange(e.target.value)}
                            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
                        >
                            <option value="">Select an arm…</option>
                            {arms.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {!selectedClassId || (arms.length > 0 && !selectedArmId) ? (
                <p className="text-sm text-text-secondary">
                    {!selectedClassId
                        ? 'Pick a class to view/edit its timetable.'
                        : 'Pick an arm to view/edit its timetable.'}
                </p>
            ) : teachingPeriods.length === 0 ? (
                <p className="text-sm text-text-secondary">Add at least one (non-break) period above before building the grid.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left text-xs text-text-secondary p-2 border border-border">Period</th>
                                {DAYS.map((d) => (
                                    <th key={d.value} className="text-left text-xs text-text-secondary p-2 border border-border">
                                        {d.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {periods.map((p) =>
                                p.is_break ? (
                                    <tr key={p.id} className="bg-background">
                                        <td colSpan={DAYS.length + 1} className="text-center text-xs text-text-secondary p-2 border border-border">
                                            {p.name} ({p.start_time}–{p.end_time})
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={p.id}>
                                        <td className="p-2 border border-border text-xs text-text-secondary">
                                            {p.name}
                                            <div className="text-[10px]">{p.start_time}–{p.end_time}</div>
                                        </td>
                                        {DAYS.map((d) => {
                                            const entry = entryFor(d.value, p.id)
                                            const subject = subjects.find((s) => s.id === entry?.subject_id)
                                            const teacher = teachers.find((t) => t.id === entry?.teacher_id)
                                            return (
                                                <td
                                                    key={d.value}
                                                    onClick={() => openCell(d.value, p.id)}
                                                    className="p-2 border border-border cursor-pointer hover:bg-background align-top"
                                                >
                                                    {entry ? (
                                                        <div>
                                                            <div className="text-xs font-medium text-text-primary">{subject?.name}</div>
                                                            {teacher && <div className="text-[10px] text-text-secondary">{teacher.name}</div>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-text-secondary">+ Add</span>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {editingCell && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
                        onClick={() => {
                            if (!isPending) {
                                setEditingCell(null)
                                setWarning(null)
                            }
                        }}
                    />

                    {/* Dialog Container */}
                    <div className="relative bg-surface border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-text-primary">
                                    {DAYS.find((d) => d.value === editingCell.day)?.label} — {periods.find((p) => p.id === editingCell.periodId)?.name}
                                </h3>
                                {(() => {
                                    const p = periods.find((item) => item.id === editingCell.periodId)
                                    return p ? (
                                        <p className="text-xs text-text-secondary mt-0.5">
                                            {p.start_time} – {p.end_time}
                                        </p>
                                    ) : null
                                })()}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingCell(null)
                                    setWarning(null)
                                }}
                                disabled={isPending}
                                className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface-muted transition-colors"
                                aria-label="Close"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {warning && (
                            <p className="text-xs text-warning-text bg-warning-bg rounded-lg px-3 py-2">{warning}</p>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Subject</label>
                                <select
                                    value={cellForm.subjectId}
                                    onChange={(e) => setCellForm({ ...cellForm, subjectId: e.target.value })}
                                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">Select subject…</option>
                                    {subjects.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Teacher</label>
                                <select
                                    value={cellForm.teacherId}
                                    onChange={(e) => setCellForm({ ...cellForm, teacherId: e.target.value })}
                                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">No teacher yet</option>
                                    {teachers.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                            <div>
                                {entryFor(editingCell.day, editingCell.periodId) && (
                                    <button
                                        type="button"
                                        onClick={clearCell}
                                        disabled={isPending}
                                        className="text-danger text-xs font-medium hover:underline disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingCell(null)
                                        setWarning(null)
                                    }}
                                    className="text-text-secondary hover:text-text-primary px-3 py-2 text-sm rounded-lg hover:bg-surface-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => saveCell()}
                                    disabled={isPending || !cellForm.subjectId}
                                    className="bg-primary hover:bg-primary-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {isPending ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

      {/* Teacher conflict confirmation modal */}
      {conflictMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConflictMessage(null)}
          />
          {/* Dialog */}
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
            {/* Warning icon */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center">
                <svg className="w-5 h-5 text-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-text-primary">Scheduling Conflict</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{conflictMessage}</p>
            <p className="text-sm text-text-secondary">Do you want to save anyway?</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => saveCell(true)}
                disabled={isPending}
                className="flex-1 bg-warning-bg text-warning-text border border-warning-text/20 hover:bg-warning-text hover:text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Save Anyway
              </button>
              <button
                onClick={() => setConflictMessage(null)}
                disabled={isPending}
                className="flex-1 border border-border rounded-lg px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}