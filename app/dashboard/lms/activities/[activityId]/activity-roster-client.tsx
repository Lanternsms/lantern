/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  markSubmission,
  updateActivity,
  setActivityStatus,
  getSubmission,
  getBriefUploadUrl,
  setActivityBrief,
  removeActivityBrief,
  getBriefDownloadUrl,
} from '../actions'
import { QuizBuilder } from '../quiz-builder'

interface ActivityRosterClientProps {
  activity: any
  session: any
  roster: any[]
  totalEnrolled: number
  submittedCount: number
  canManage: boolean
  canViewResults: boolean
  questions?: any[]
}

export function ActivityRosterClient({
  activity,
  session,
  roster,
  totalEnrolled,
  submittedCount,
  canManage,
  canViewResults,
  questions = []
}: ActivityRosterClientProps) {
  const router = useRouter()
  const isQuiz = activity.kind === 'quiz'

  const [activeTab, setActiveTab] = useState<'roster' | 'builder' | 'settings'>('roster')
  const [selectedSub, setSelectedSub] = useState<any | null>(null)
  const [loadingSub, setLoadingSub] = useState(false)
  const [markingScore, setMarkingScore] = useState<number | ''>('')
  const [markingFeedback, setMarkingFeedback] = useState('')
  const [savingMark, setSavingMark] = useState(false)
  const [markingError, setMarkingError] = useState<string | null>(null)

  // Settings state
  const [editTitle, setEditTitle] = useState(activity.title)
  const [editInstructions, setEditInstructions] = useState(activity.instructions || '')
  const [editDueAt, setEditDueAt] = useState(activity.due_at ? activity.due_at.slice(0, 16) : '')
  const [editTimeLimit, setEditTimeLimit] = useState(activity.time_limit_minutes ?? '')
  const [editAttempts, setEditAttempts] = useState(activity.attempts_allowed ?? 1)
  const [editShowAnswers, setEditShowAnswers] = useState(!!activity.show_answers)
  const [editMaxScore, setEditMaxScore] = useState(activity.max_score)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)

  // Brief state
  const [currentBriefName, setCurrentBriefName] = useState<string | null>(activity.attachment_name || null)
  const [downloadingBrief, setDownloadingBrief] = useState(false)
  const [uploadingBrief, setUploadingBrief] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)
  const briefInputRef = useRef<HTMLInputElement>(null)

  const hasSubmissions = submittedCount > 0

  const handleOpenMarking = async (sub: any, student: any) => {
    setMarkingError(null)
    setLoadingSub(true)
    try {
      const full = await getSubmission(sub.id)
      setSelectedSub({ ...full, studentName: `${student.profile.first_name} ${student.profile.last_name}` })
      setMarkingScore(full?.score ?? '')
      setMarkingFeedback(full?.feedback ?? '')
    } catch (err: any) {
      setMarkingError(err?.message || 'Failed to load submission.')
    } finally {
      setLoadingSub(false)
    }
  }

  const handleSaveMark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSub) return

    const num = Number(markingScore)
    if (isNaN(num) || num < 0 || num > activity.max_score) {
      setMarkingError(`Score must be between 0 and ${activity.max_score}.`)
      return
    }

    setSavingMark(true)
    setMarkingError(null)
    try {
      const res = await markSubmission(selectedSub.id, {
        score: num,
        feedback: markingFeedback
      })
      if (res.error) {
        setMarkingError(res.error)
      } else {
        setSelectedSub(null)
        router.refresh()
      }
    } catch (err: any) {
      setMarkingError(err?.message || 'Failed to save score.')
    } finally {
      setSavingMark(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsMsg(null)

    try {
      const res = await updateActivity(activity.id, {
        title: editTitle,
        instructions: editInstructions,
        dueAt: editDueAt || null,
        timeLimitMinutes: isQuiz && editTimeLimit ? Number(editTimeLimit) : null,
        attemptsAllowed: isQuiz ? Number(editAttempts) : 1,
        showAnswers: isQuiz ? editShowAnswers : false,
        maxScore: !isQuiz ? Number(editMaxScore) : undefined
      })

      if (res.error) {
        setSettingsMsg(`Error: ${res.error}`)
      } else {
        setSettingsMsg('Settings updated successfully!')
        router.refresh()
      }
    } catch (err: any) {
      setSettingsMsg(`Error: ${err?.message || 'Failed to update.'}`)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleTogglePublish = async () => {
    const next = activity.status === 'published' ? 'draft' : 'published'
    const res = await setActivityStatus(activity.id, next)
    if (res.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  const handleDownloadBrief = async () => {
    setBriefError(null)
    setDownloadingBrief(true)
    try {
      const res = await getBriefDownloadUrl({ activityId: activity.id })
      if (res.error || !res.url) {
        setBriefError(res.error || 'Failed to download assignment document.')
      } else {
        window.open(res.url, '_blank')
      }
    } catch (err: any) {
      setBriefError(err?.message || 'Failed to download brief.')
    } finally {
      setDownloadingBrief(false)
    }
  }

  const handleReplaceBrief = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setBriefError('Only PDF documents are allowed for the assignment brief.')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setBriefError('File size must not exceed 10MB.')
      e.target.value = ''
      return
    }

    setBriefError(null)
    setUploadingBrief(true)
    try {
      const uploadRes = await getBriefUploadUrl({
        activityId: activity.id,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size,
      })

      if (uploadRes.error || !uploadRes.signedUrl || !uploadRes.path) {
        throw new Error(uploadRes.error || 'Failed to get upload authorization.')
      }

      const putRes = await fetch(uploadRes.signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/pdf' },
      })

      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`)
      }

      const setRes = await setActivityBrief({
        activityId: activity.id,
        attachmentPath: uploadRes.path,
        attachmentName: file.name,
      })

      if (setRes.error) {
        throw new Error(setRes.error)
      }

      setCurrentBriefName(file.name)
      router.refresh()
    } catch (err: any) {
      setBriefError(err?.message || 'Failed to update assignment document.')
    } finally {
      setUploadingBrief(false)
      if (briefInputRef.current) briefInputRef.current.value = ''
    }
  }

  const handleRemoveBrief = async () => {
    if (!confirm('Are you sure you want to remove the attached assignment document?')) return
    setBriefError(null)
    setUploadingBrief(true)
    try {
      const res = await removeActivityBrief(activity.id)
      if (res.error) {
        throw new Error(res.error)
      }
      setCurrentBriefName(null)
      router.refresh()
    } catch (err: any) {
      setBriefError(err?.message || 'Failed to remove document.')
    } finally {
      setUploadingBrief(false)
    }
  }

  // Calculate statistics
  const markedSubmissions = roster.filter(r => {
    if (isQuiz) return r.bestScore != null
    return r.submission?.status === 'marked'
  })
  const markedCount = markedSubmissions.length

  const avgScore = markedCount > 0
    ? (markedSubmissions.reduce((sum, r) => sum + (isQuiz ? r.bestScore : r.submission?.score || 0), 0) / markedCount).toFixed(1)
    : '—'

  return (
    <div className="space-y-6">
      {/* Assignment Document Brief (if attached) */}
      {!isQuiz && currentBriefName && (
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Assignment Document (PDF)</div>
              <div className="text-sm font-medium text-text-primary truncate">{currentBriefName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadBrief}
            disabled={downloadingBrief}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-muted transition-colors shrink-0 disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloadingBrief ? 'Opening...' : 'Download Document'}
          </button>
        </div>
      )}

      {briefError && (
        <div className="rounded-xl border border-danger-bg bg-danger-bg/20 p-3 text-xs text-danger-text">
          {briefError}
        </div>
      )}

      {/* Top action bar / summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-secondary">Enrolled Students</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{totalEnrolled}</div>
          <div className="text-[11px] text-text-secondary mt-0.5">{session?.name || 'Current Session'}</div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-secondary">Submissions</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">
            {submittedCount} <span className="text-sm font-normal text-text-secondary">/ {totalEnrolled}</span>
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">
            {totalEnrolled > 0 ? `${Math.round((submittedCount / totalEnrolled) * 100)}% turnout` : 'No enrolments'}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-secondary">{isQuiz ? 'Scored' : 'Marked'}</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">
            {markedCount} <span className="text-sm font-normal text-text-secondary">/ {submittedCount}</span>
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">
            {submittedCount - markedCount > 0 ? `${submittedCount - markedCount} pending` : 'All marked'}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-secondary">Average Score</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">
            {avgScore} <span className="text-sm font-normal text-text-secondary">/ {activity.max_score}</span>
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">
            Max possible: {activity.max_score} pts
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'roster'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Submissions Roster ({roster.length})
          </button>

          {isQuiz && (
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'builder'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Quiz Questions ({questions.length})
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Settings & Rules
            </button>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={handleTogglePublish}
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activity.status === 'published'
                  ? 'border border-border bg-surface text-text-secondary hover:bg-surface-muted'
                  : 'bg-success-text text-white hover:opacity-90'
              }`}
            >
              {activity.status === 'published' ? 'Unpublish' : 'Publish Activity'}
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: SUBMISSIONS ROSTER */}
      {activeTab === 'roster' && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/50 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Admission No</th>
                  <th className="px-4 py-3">Status</th>
                  {isQuiz ? (
                    <>
                      <th className="px-4 py-3">Attempts</th>
                      <th className="px-4 py-3">Best Score</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-text-secondary">
                      No enrolled students found for this class and current academic session.
                    </td>
                  </tr>
                ) : (
                  roster.map(item => {
                    const st = item.student
                    const fullName = st.profile ? `${st.profile.first_name} ${st.profile.last_name}` : 'Unknown'

                    if (isQuiz) {
                      const hasAttempted = item.attemptsCount > 0
                      return (
                        <tr key={st.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {fullName}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary font-mono">
                            {st.admission_number || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {item.hasInProgress ? (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                In Progress
                              </span>
                            ) : hasAttempted ? (
                              <span className="inline-flex items-center rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success-text">
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                                Not started
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary">
                            {item.attemptsCount} / {activity.attempts_allowed || 1}
                          </td>
                          <td className="px-4 py-3">
                            {item.bestScore != null ? (
                              <span className="font-semibold text-text-primary">
                                {item.bestScore} <span className="text-xs font-normal text-text-secondary">/ {activity.max_score}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-text-secondary">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    } else {
                      const sub = item.submission
                      const status = sub?.status || 'not_submitted'
                      return (
                        <tr key={st.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {fullName}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary font-mono">
                            {st.admission_number || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {status === 'marked' ? (
                              <span className="inline-flex items-center rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success-text">
                                Marked {sub.is_late && '(Late)'}
                              </span>
                            ) : status === 'submitted' ? (
                              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                Submitted {sub.is_late && '(Late)'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                                Not submitted
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary">
                            {sub?.submitted_at ? new Date(sub.submitted_at).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {sub?.score != null ? (
                              <span className="font-semibold text-text-primary">
                                {sub.score} <span className="text-xs font-normal text-text-secondary">/ {activity.max_score}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-text-secondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {sub ? (
                              <button
                                type="button"
                                onClick={() => handleOpenMarking(sub, st)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors"
                              >
                                {sub.status === 'marked' ? 'Review & Edit' : 'Review & Mark'}
                              </button>
                            ) : (
                              <span className="text-xs text-text-secondary/60">No submission</span>
                            )}
                          </td>
                        </tr>
                      )
                    }
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: QUIZ QUESTION BUILDER */}
      {isQuiz && activeTab === 'builder' && (
        <QuizBuilder
          activityId={activity.id}
          initialQuestions={questions}
          readOnly={!canManage}
          hasSubmissions={hasSubmissions}
        />
      )}

      {/* TAB 3: SETTINGS & RULES */}
      {canManage && activeTab === 'settings' && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-5 max-w-2xl">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Activity Settings</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Update instructions, due dates, and grading settings.
            </p>
          </div>

          {settingsMsg && (
            <div className={`rounded-lg p-3 text-xs ${
              settingsMsg.startsWith('Error')
                ? 'border border-danger-bg bg-danger-bg/20 text-danger-text'
                : 'border border-success-bg bg-success-bg/20 text-success-text'
            }`}>
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Instructions</label>
              <textarea
                rows={3}
                value={editInstructions}
                onChange={e => setEditInstructions(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Due Date & Time</label>
                <input
                  type="datetime-local"
                  value={editDueAt}
                  onChange={e => setEditDueAt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {!isQuiz ? (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Maximum Score</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    disabled={hasSubmissions}
                    value={editMaxScore}
                    onChange={e => setEditMaxScore(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  />
                  {hasSubmissions && (
                    <p className="text-[11px] text-text-secondary mt-1">Locked because submissions exist.</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Time Limit (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    disabled={hasSubmissions}
                    value={editTimeLimit}
                    onChange={e => setEditTimeLimit(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  />
                </div>
              )}
            </div>

            {!isQuiz && (
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-medium text-text-secondary">
                  Assignment Document (PDF Brief)
                </label>
                <input
                  type="file"
                  ref={briefInputRef}
                  accept="application/pdf,.pdf"
                  onChange={handleReplaceBrief}
                  className="hidden"
                />
                {currentBriefName ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-text-primary truncate">{currentBriefName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleDownloadBrief}
                        disabled={downloadingBrief || uploadingBrief}
                        className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-muted disabled:opacity-50"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => briefInputRef.current?.click()}
                        disabled={uploadingBrief}
                        className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-muted disabled:opacity-50"
                      >
                        {uploadingBrief ? 'Uploading...' : 'Replace'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveBrief}
                        disabled={uploadingBrief}
                        className="rounded-md border border-danger-bg/40 bg-danger-bg/20 px-2.5 py-1 text-xs font-medium text-danger-text hover:bg-danger-bg/40 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => briefInputRef.current?.click()}
                      disabled={uploadingBrief}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-3 py-2 text-xs font-medium text-primary hover:bg-surface-muted transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {uploadingBrief ? 'Uploading PDF...' : 'Attach Assignment Document (PDF, max 10MB)'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isQuiz && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Allowed Attempts</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    disabled={hasSubmissions}
                    value={editAttempts}
                    onChange={e => setEditAttempts(Number(e.target.value))}
                    className="w-32 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editShowAnswers}
                    onChange={e => setEditShowAnswers(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-text-secondary">
                    Show correct answers and explanations after submission
                  </span>
                </label>
              </div>
            )}

            <div className="pt-3 border-t border-border">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Update Settings'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* MARKING MODAL FOR ASSIGNMENTS */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Review Submission: {selectedSub.studentName}
                </h3>
                <p className="text-xs text-text-secondary">
                  Submitted on {new Date(selectedSub.submitted_at || selectedSub.started_at).toLocaleString()}
                  {selectedSub.is_late && <span className="ml-2 font-semibold text-amber-500">(Late Submission)</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {markingError && (
              <div className="rounded-lg border border-danger-bg bg-danger-bg/20 p-3 text-xs text-danger-text">
                {markingError}
              </div>
            )}

            {/* Submission content */}
            <div className="space-y-3">
              {selectedSub.text_response && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Student Written Response:
                  </label>
                  <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs text-text-primary whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedSub.text_response}
                  </div>
                </div>
              )}

              {selectedSub.attachment_path && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Attached File:
                  </label>
                  {selectedSub.downloadUrl ? (
                    <a
                      href={selectedSub.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-primary hover:bg-surface-muted transition-colors"
                    >
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Student Submission File
                    </a>
                  ) : (
                    <p className="text-xs text-text-secondary">Generating secure download link...</p>
                  )}
                </div>
              )}
            </div>

            {/* Grading Form */}
            <form onSubmit={handleSaveMark} className="space-y-4 pt-3 border-t border-border">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Score (Out of {activity.max_score}) <span className="text-danger-text">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={activity.max_score}
                    step="0.5"
                    required
                    value={markingScore}
                    onChange={e => setMarkingScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Teacher Feedback & Comments
                </label>
                <textarea
                  rows={3}
                  value={markingFeedback}
                  onChange={e => setMarkingFeedback(e.target.value)}
                  placeholder="Well structured work! Remember to check units on step 3..."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMark}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingMark ? 'Saving...' : 'Save & Record Mark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
