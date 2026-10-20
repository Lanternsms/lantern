'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LessonPlayerModal } from '../lesson-player-modal'
import { markLessonDelivered, undoLessonDelivery } from '../actions'

export type LessonOption = {
  id: string
  title: string
  topic: string | null
  week_no: number | null
  duration_seconds: number | null
  isDeliveredForClassArm: boolean
  openQuestionsCount?: number
}

export type DeliveryInfo = {
  id: string
  lesson_id: string
  delivered_by: string
  lesson_title?: string
}

interface FacilitatorPeriodCardProps {
  timetableEntryId: string
  periodName: string
  startTime: string
  endTime: string
  className: string
  armName: string | null
  subjectName: string
  publishedLessons: LessonOption[]
  suggestedLessonId: string | null
  todayDelivery: DeliveryInfo | null
  currentUserId: string
  canManage: boolean
}

export function FacilitatorPeriodCard({
  timetableEntryId,
  periodName,
  startTime,
  endTime,
  className,
  armName,
  subjectName,
  publishedLessons,
  suggestedLessonId,
  todayDelivery,
  currentUserId,
  canManage,
}: FacilitatorPeriodCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const defaultId = todayDelivery?.lesson_id ?? suggestedLessonId ?? publishedLessons[0]?.id ?? ''
  const [selectedLessonId, setSelectedLessonId] = useState<string>(defaultId)

  const selectedLesson = publishedLessons.find((l) => l.id === selectedLessonId)
  const isDeliveredToday = !!todayDelivery
  const canUndo = todayDelivery && (todayDelivery.delivered_by === currentUserId || canManage)

  function handleMarkDelivered() {
    if (!selectedLessonId) return
    setError(null)
    startTransition(async () => {
      const res = await markLessonDelivered({
        lessonId: selectedLessonId,
        timetableEntryId,
      })
      if (res?.error) {
        setError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleUndo() {
    if (!todayDelivery) return
    setError(null)
    startTransition(async () => {
      const res = await undoLessonDelivery(todayDelivery.id)
      if (res?.error) {
        setError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4">
      {/* Header: Time, Class+Arm, Subject, and Status Chip */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-muted text-text-secondary border border-border">
              {periodName} ({startTime}–{endTime})
            </span>
            <span className="text-xs font-medium text-text-muted">
              {className} {armName ? `· ${armName}` : ''}
            </span>
          </div>
          <h3 className="text-base font-semibold text-text-primary mt-1">{subjectName}</h3>
        </div>

        <div>
          {isDeliveredToday ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Delivered today
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Not yet
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Body: Lessons selection and action buttons */}
      {publishedLessons.length === 0 ? (
        <p className="text-xs text-text-muted italic py-1">
          No published lessons available for this subject yet.
        </p>
      ) : (
        <div className="space-y-3 pt-1">
          {isDeliveredToday ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-muted border border-border">
              <div className="min-w-0">
                <p className="text-xs text-text-secondary font-medium">Delivered Lesson</p>
                <p className="text-sm font-semibold text-text-primary truncate">
                  {todayDelivery.lesson_title ?? 'Recorded Lesson'}
                </p>
                {Boolean(selectedLesson?.openQuestionsCount && selectedLesson.openQuestionsCount > 0) && (
                  <Link
                    href={`/dashboard/lms/questions?lessonId=${todayDelivery.lesson_id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium mt-1"
                  >
                    💬 {selectedLesson!.openQuestionsCount} open question{selectedLesson!.openQuestionsCount === 1 ? '' : 's'}
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <LessonPlayerModal
                  lessonId={todayDelivery.lesson_id}
                  title={todayDelivery.lesson_title ?? 'Lesson'}
                  size="lg"
                  label="Play"
                />
                {canUndo && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={isPending}
                    className="text-xs text-danger-text hover:underline border border-red-200 px-3 py-2 rounded-lg bg-danger-bg/40 hover:bg-danger-bg transition-colors disabled:opacity-50"
                  >
                    {isPending ? 'Undoing…' : 'Undo delivery'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  Select Lesson {suggestedLessonId && <span className="text-primary">(Suggested lesson chosen)</span>}
                </label>
                <select
                  value={selectedLessonId}
                  onChange={(e) => setSelectedLessonId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {publishedLessons.map((l) => {
                    const tag = l.id === suggestedLessonId
                      ? '★ Suggested'
                      : l.isDeliveredForClassArm
                      ? '✓ Delivered'
                      : ''
                    return (
                      <option key={l.id} value={l.id}>
                        {l.week_no ? `Wk ${l.week_no}: ` : ''}{l.title} {tag ? `(${tag})` : ''}
                      </option>
                    )
                  })}
                </select>
                {Boolean(selectedLesson?.openQuestionsCount && selectedLesson.openQuestionsCount > 0) && (
                  <Link
                    href={`/dashboard/lms/questions?lessonId=${selectedLesson!.id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium mt-1.5"
                  >
                    💬 {selectedLesson!.openQuestionsCount} open question{selectedLesson!.openQuestionsCount === 1 ? '' : 's'}
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 sm:pt-0 shrink-0 self-end">
                {selectedLesson && (
                  <LessonPlayerModal
                    lessonId={selectedLesson.id}
                    title={selectedLesson.title}
                    size="lg"
                    label="Play"
                  />
                )}
                <button
                  type="button"
                  onClick={handleMarkDelivered}
                  disabled={isPending || !selectedLessonId}
                  className="text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Marking…' : 'Mark as delivered'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
