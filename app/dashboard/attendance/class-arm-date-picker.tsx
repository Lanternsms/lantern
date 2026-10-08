'use client'

import { useRouter } from 'next/navigation'

type ClassRow = { id: string; name: string; arms: { id: string; name: string }[] }

export default function ClassArmDatePicker({
  classes,
  selectedClassId,
  selectedArmId,
  selectedDate,
  view,
  showDate,
}: {
  classes: ClassRow[]
  selectedClassId: string
  selectedArmId: string
  selectedDate: string
  view: string
  showDate: boolean
}) {
  const router = useRouter()
  const arms = classes.find((c) => c.id === selectedClassId)?.arms ?? []

  function navigate(next: { classId?: string; armId?: string; date?: string }) {
    const params = new URLSearchParams()
    params.set('view', view)
    const classId = next.classId ?? selectedClassId
    const armId = next.armId ?? selectedArmId
    const date = next.date ?? selectedDate
    if (classId) params.set('classId', classId)
    if (armId) params.set('armId', armId)
    if (date) params.set('date', date)
    router.push(`/dashboard/attendance?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <label className="block text-xs text-text-secondary mb-1">Class</label>
        <select value={selectedClassId} onChange={(e) => navigate({ classId: e.target.value, armId: '' })} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface">
          <option value="">Select a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {selectedClassId && arms.length > 0 && (
        <div>
          <label className="block text-xs text-text-secondary mb-1">Arm</label>
          <select value={selectedArmId} onChange={(e) => navigate({ armId: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface">
            <option value="">All arms</option>
            {arms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      {showDate && (
        <div>
          <label className="block text-xs text-text-secondary mb-1">Date</label>
          <input type="date" value={selectedDate} onChange={(e) => navigate({ date: e.target.value })} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface" />
        </div>
      )}
    </div>
  )
}