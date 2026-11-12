'use client'

import { useRouter } from 'next/navigation'

type ClassRow = { id: string; name: string; arms: { id: string; name: string }[] }
export type TeacherOption = {
  key: string
  classId: string
  armId: string | null
  subjectId: string
  label: string
}

export default function ClassArmDatePicker({
  classes,
  selectedClassId,
  selectedArmId,
  selectedSubjectId,
  selectedDate,
  view,
  showDate,
  teacherOptions,
}: {
  classes: ClassRow[]
  selectedClassId: string
  selectedArmId: string
  selectedSubjectId?: string
  selectedDate: string
  view: string
  showDate: boolean
  teacherOptions?: TeacherOption[]
}) {
  const router = useRouter()
  const arms = classes.find((c) => c.id === selectedClassId)?.arms ?? []

  function navigate(next: { classId?: string; armId?: string; subjectId?: string; date?: string }) {
    const params = new URLSearchParams()
    params.set('view', view)
    const classId = next.classId !== undefined ? next.classId : selectedClassId
    const armId = next.armId !== undefined ? next.armId : selectedArmId
    const subjectId = next.subjectId !== undefined ? next.subjectId : (selectedSubjectId ?? '')
    const date = next.date !== undefined ? next.date : selectedDate
    if (classId) params.set('classId', classId)
    if (armId) params.set('armId', armId)
    if (subjectId) params.set('subjectId', subjectId)
    if (date) params.set('date', date)
    router.push(`/dashboard/attendance?${params.toString()}`)
  }

  if (view === 'mark' && teacherOptions && teacherOptions.length > 0) {
    const selectedKey = `${selectedClassId}:${selectedArmId}:${selectedSubjectId ?? ''}`
    return (
      <div className="flex flex-wrap items-center gap-3">
        {teacherOptions.length === 1 ? (
          <div>
            <span className="block text-xs text-text-secondary mb-1">Class & Subject</span>
            <div className="card px-3 py-2 text-sm font-medium text-text-primary bg-surface">
              {teacherOptions[0].label}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-text-secondary mb-1">Class & Subject</label>
            <select
              value={selectedKey}
              onChange={(e) => {
                const opt = teacherOptions.find((o) => o.key === e.target.value)
                if (opt) {
                  navigate({ classId: opt.classId, armId: opt.armId ?? '', subjectId: opt.subjectId })
                } else {
                  navigate({ classId: '', armId: '', subjectId: '' })
                }
              }}
              className="card px-3 py-2 text-sm"
            >
              <option value="">Select class & subject…</option>
              {teacherOptions.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        {showDate && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">Date</label>
            <input type="date" value={selectedDate} onChange={(e) => navigate({ date: e.target.value })} className="card px-3 py-2 text-sm" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <label className="block text-xs text-text-secondary mb-1">Class</label>
        <select value={selectedClassId} onChange={(e) => navigate({ classId: e.target.value, armId: '', subjectId: '' })} className="card px-3 py-2 text-sm">
          <option value="">Select a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {selectedClassId && arms.length > 0 && (
        <div>
          <label className="block text-xs text-text-secondary mb-1">Arm</label>
          <select value={selectedArmId} onChange={(e) => navigate({ armId: e.target.value })} className="card px-3 py-2 text-sm">
            <option value="">All arms</option>
            {arms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      {showDate && (
        <div>
          <label className="block text-xs text-text-secondary mb-1">Date</label>
          <input type="date" value={selectedDate} onChange={(e) => navigate({ date: e.target.value })} className="card px-3 py-2 text-sm" />
        </div>
      )}
    </div>
  )
}