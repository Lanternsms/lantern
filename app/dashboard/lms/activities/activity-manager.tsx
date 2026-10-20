/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createActivity, setActivityStatus, deleteActivity, getBriefUploadUrl, setActivityBrief } from './actions'

interface Activity {
  id: string
  kind: 'quiz' | 'assignment'
  title: string
  status: 'draft' | 'published'
  instructions: string | null
  due_at: string | null
  time_limit_minutes: number | null
  attempts_allowed: number | null
  show_answers: boolean | null
  max_score: number
  created_at: string
  submissions_count?: number
  attachment_name?: string | null
  attachment_path?: string | null
}

interface ActivityManagerProps {
  lessonId: string
  activities: Activity[]
  canManage: boolean
  canViewResults: boolean
  isSchoolManager: boolean
  totalEnrolled?: number
}

export function ActivityManager({
  lessonId,
  activities,
  canManage,
  canViewResults,
  isSchoolManager,
  totalEnrolled = 0
}: ActivityManagerProps) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createKind, setCreateKind] = useState<'quiz' | 'assignment'>('quiz')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [timeLimit, setTimeLimit] = useState<number | ''>('')
  const [attempts, setAttempts] = useState<number>(1)
  const [showAnswers, setShowAnswers] = useState(false)
  const [maxScore, setMaxScore] = useState<number>(10)
  const [briefFile, setBriefFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenCreate = (kind: 'quiz' | 'assignment') => {
    setCreateKind(kind)
    setTitle('')
    setInstructions('')
    setDueAt('')
    setTimeLimit('')
    setAttempts(1)
    setShowAnswers(false)
    setMaxScore(kind === 'assignment' ? 10 : 1)
    setBriefFile(null)
    setError(null)
    setShowCreateModal(true)
  }

  const handleBriefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setBriefFile(null)
      return
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are allowed for the assignment document.')
      e.target.value = ''
      setBriefFile(null)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must not exceed 10MB.')
      e.target.value = ''
      setBriefFile(null)
      return
    }
    setError(null)
    setBriefFile(file)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please enter a title.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await createActivity({
        lessonId,
        kind: createKind,
        title: title.trim(),
        instructions: instructions.trim() || null,
        dueAt: dueAt || null,
        timeLimitMinutes: createKind === 'quiz' && timeLimit ? Number(timeLimit) : null,
        attemptsAllowed: createKind === 'quiz' ? Number(attempts) : 1,
        showAnswers: createKind === 'quiz' ? showAnswers : false,
        maxScore: createKind === 'assignment' ? Number(maxScore) : 1
      })

      if (res.error) {
        setError(res.error)
        return
      }

      const newActivityId = res.activity?.id
      if (createKind === 'assignment' && briefFile && newActivityId) {
        try {
          const uploadRes = await getBriefUploadUrl({
            activityId: newActivityId,
            fileName: briefFile.name,
            mimeType: briefFile.type || 'application/pdf',
            size: briefFile.size,
          })

          if (uploadRes.error || !uploadRes.signedUrl || !uploadRes.path) {
            throw new Error(uploadRes.error || 'Failed to get upload authorization.')
          }

          const putRes = await fetch(uploadRes.signedUrl, {
            method: 'PUT',
            body: briefFile,
            headers: {
              'Content-Type': 'application/pdf',
            },
          })

          if (!putRes.ok) {
            throw new Error(`Upload failed (${putRes.status})`)
          }

          const setRes = await setActivityBrief({
            activityId: newActivityId,
            attachmentPath: uploadRes.path,
            attachmentName: briefFile.name,
          })

          if (setRes.error) {
            throw new Error(setRes.error)
          }
        } catch (uploadErr) {
          console.error('Failed to attach brief during creation:', uploadErr)
          alert('Assignment saved, but the PDF failed to upload. Attach it again from Edit.')
        }
      }

      setShowCreateModal(false)
      router.refresh()
      if (createKind === 'quiz' && newActivityId) {
        router.push(`/dashboard/lms/activities/${newActivityId}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create activity.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (act: Activity) => {
    const nextStatus = act.status === 'published' ? 'draft' : 'published'
    const res = await setActivityStatus(act.id, nextStatus)
    if (res.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  const handleDelete = async (act: Activity) => {
    if (!confirm(`Are you sure you want to delete "${act.title}"? This cannot be undone.`)) return
    const res = await deleteActivity(act.id)
    if (res.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Activities & Assessments</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Quizzes and assignments for this lesson. Self-contained and not linked to term grading.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenCreate('quiz')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Quiz
            </button>
            <button
              type="button"
              onClick={() => handleOpenCreate('assignment')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Assignment
            </button>
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-text-secondary">No activities added yet</p>
          <p className="text-xs text-text-secondary/80 mt-1">
            Create a quiz or assignment to assess student learning on this lesson.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {activities.map(act => (
            <div
              key={act.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 hover:bg-surface-muted/40 transition-colors"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                      act.kind === 'quiz'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    }`}
                  >
                    {act.kind}
                  </span>
                  <Link
                    href={`/dashboard/lms/activities/${act.id}`}
                    className="text-sm font-medium text-text-primary hover:text-primary transition-colors truncate"
                  >
                    {act.title}
                  </Link>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      act.status === 'published'
                        ? 'bg-success-bg text-success-text'
                        : 'bg-surface-muted text-text-secondary border border-border'
                    }`}
                  >
                    {act.status}
                  </span>
                  {act.attachment_name && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400" title={act.attachment_name}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      PDF Brief
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span>Max Score: <strong className="text-text-primary">{act.max_score}</strong></span>
                  {act.due_at && (
                    <span>
                      Due: {new Date(act.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {act.kind === 'quiz' && act.time_limit_minutes && (
                    <span>Limit: {act.time_limit_minutes}m</span>
                  )}
                  {act.kind === 'quiz' && (
                    <span>Attempts: {act.attempts_allowed || 1}</span>
                  )}
                  {act.submissions_count !== undefined && (
                    <span>
                      Submissions: <strong className="text-text-primary">{act.submissions_count}</strong>
                      {totalEnrolled > 0 && ` / ${totalEnrolled}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                {canViewResults && (
                  <Link
                    href={`/dashboard/lms/activities/${act.id}`}
                    className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors"
                  >
                    {act.kind === 'quiz' ? 'Questions & Submissions' : 'Submissions & Marking'}
                  </Link>
                )}

                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(act)}
                    className="inline-flex items-center rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
                  >
                    {act.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                )}

                {isSchoolManager && (
                  <button
                    type="button"
                    onClick={() => handleDelete(act)}
                    className="inline-flex items-center rounded-lg border border-border bg-surface p-1.5 text-xs text-danger-text hover:bg-danger-bg/20 transition-colors"
                    title="Delete activity"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for creating a new activity */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-text-primary">
                New {createKind === 'quiz' ? 'Multiple Choice Quiz' : 'Assignment'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-danger-bg bg-danger-bg/20 p-3 text-xs text-danger-text">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Title <span className="text-danger-text">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={createKind === 'quiz' ? 'e.g. Week 3 Quick Quiz: Photosynthesis' : 'e.g. Lab Report: Water Electrolysis'}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Instructions / Description
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Instructions for students..."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Due Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={e => setDueAt(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {createKind === 'assignment' ? (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Max Score <span className="text-danger-text">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      required
                      value={maxScore}
                      onChange={e => setMaxScore(Number(e.target.value))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Time Limit (Minutes, optional)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      placeholder="e.g. 15"
                      value={timeLimit}
                      onChange={e => setTimeLimit(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {createKind === 'assignment' && (
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <label className="block text-xs font-medium text-text-secondary">
                    Assignment document (PDF, max 10MB)
                  </label>
                  {!briefFile ? (
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handleBriefChange}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-primary/90"
                    />
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium text-text-primary truncate">{briefFile.name}</span>
                        <span className="text-text-secondary text-[11px]">({(briefFile.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBriefFile(null)}
                        className="text-text-secondary hover:text-danger-text p-1"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {createKind === 'quiz' && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        Allowed Attempts
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={attempts}
                        onChange={e => setAttempts(Number(e.target.value))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={showAnswers}
                      onChange={e => setShowAnswers(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-text-secondary">
                      Show correct answers and explanations after submission
                    </span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating...' : createKind === 'quiz' ? 'Create & Add Questions' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
