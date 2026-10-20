// app/dashboard/lms/questions/[rootId]/thread-client.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LessonPlayerModal } from '../../lesson-player-modal'
import { replyToThread, setThreadStatus, deleteMessage } from '../actions'

interface ThreadClientProps {
  root: any
  replies: any[]
  canManage: boolean
  currentUserId: string
  rootId?: string
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return iso
  }
}

function StatusChip({ status }: { status: 'open' | 'answered' | 'closed' }) {
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Open
        </span>
      )
    case 'answered':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Answered
        </span>
      )
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-muted text-text-secondary border border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
          Closed
        </span>
      )
    default:
      return null
  }
}

export function ThreadClient({ root, replies, canManage, rootId }: ThreadClientProps) {
  const router = useRouter()
  const [replyBody, setReplyBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const targetRootId = rootId || root.id
  const lesson = root.lms_lessons
  const className = lesson?.classes?.name ?? ''
  const subjectName = lesson?.subjects?.name ?? ''
  const classSubject = [className, subjectName].filter(Boolean).join(' · ')

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = replyBody.trim()
    if (!trimmed) return
    setError(null)

    startTransition(async () => {
      const res = await replyToThread({ rootId: targetRootId, body: trimmed })
      if (res.error) {
        setError(res.error)
      } else {
        setReplyBody('')
        router.refresh()
      }
    })
  }

  async function handleToggleStatus() {
    setError(null)
    const newStatus: 'open' | 'closed' = root.status === 'closed' ? 'open' : 'closed'

    startTransition(async () => {
      const res = await setThreadStatus({ rootId: targetRootId, status: newStatus })
      if (res.error) {
        setError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  async function handleDeleteMessage(messageId: string, isRoot: boolean) {
    const confirmed = window.confirm(
      isRoot
        ? 'Are you sure you want to delete this question and all its replies? This cannot be undone.'
        : 'Are you sure you want to delete this reply?'
    )
    if (!confirmed) return

    setDeletingId(messageId)
    setError(null)

    startTransition(async () => {
      const res = await deleteMessage(messageId)
      setDeletingId(null)
      if (res.error) {
        setError(res.error)
      } else {
        if (isRoot) {
          router.push('/dashboard/lms/questions')
        } else {
          router.refresh()
        }
      }
    })
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      {/* Top back navigation & quick status */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard/lms/questions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 13L5 8L10 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Questions Inbox
        </Link>

        <StatusChip status={root.status} />
      </div>

      {error && (
        <div className="p-3 bg-danger-bg text-danger-text border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Lesson Details & Preview Banner */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {classSubject && (
              <span className="font-semibold px-2 py-0.5 rounded bg-surface-muted text-text-secondary border border-border">
                {classSubject}
              </span>
            )}
            {lesson?.week_no != null && (
              <span className="text-text-muted">Week {lesson.week_no}</span>
            )}
            {lesson?.topic && (
              <span className="text-text-muted">· {lesson.topic}</span>
            )}
          </div>
          <h1 className="text-lg font-bold text-text-primary truncate">
            {lesson?.title ?? 'Lesson'}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {lesson?.id && (
            <LessonPlayerModal
              lessonId={lesson.id}
              title={lesson.title ?? 'Lesson Preview'}
              label="Preview Lesson"
              size="lg"
            />
          )}

          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
              root.status === 'closed'
                ? 'bg-surface text-text-primary border-border hover:bg-surface-muted'
                : 'bg-surface text-text-secondary border-border hover:text-text-primary hover:bg-surface-muted'
            }`}
          >
            {root.status === 'closed' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M3 10a7 7 0 101.5-4.3M3 4v6h6"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Reopen Question
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M16 6L8.5 13.5L5 10"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Mark as Closed
              </>
            )}
          </button>
        </div>
      </div>

      {/* Root Question Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {root.author_kind === 'guardian' ? 'P' : 'S'}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {root.askerDisplay}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {formatDateTime(root.created_at)}
              </p>
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => handleDeleteMessage(root.id, true)}
              disabled={isPending || deletingId === root.id}
              className="text-xs text-danger-text hover:underline border border-red-200 px-2.5 py-1 rounded-md bg-danger-bg/30 hover:bg-danger-bg transition-colors disabled:opacity-50"
            >
              {deletingId === root.id ? 'Deleting…' : 'Delete Question'}
            </button>
          )}
        </div>

        <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap bg-surface-muted p-4 rounded-lg border border-border">
          {root.body}
        </div>
      </div>

      {/* Replies Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">
            Replies ({replies.length})
          </h2>
        </div>

        {replies.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-xs text-text-secondary">
            No replies yet. Type an answer below to respond.
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => {
              const isStaff = reply.author_kind === 'staff'
              return (
                <div
                  key={reply.id}
                  className={`border rounded-xl p-5 shadow-xs space-y-3 transition-colors ${
                    isStaff
                      ? 'bg-surface border-primary/30'
                      : 'bg-surface border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isStaff
                            ? 'bg-primary text-white'
                            : 'bg-surface-muted text-text-secondary border border-border'
                        }`}
                      >
                        {isStaff ? 'T' : reply.author_kind === 'guardian' ? 'P' : 'S'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">
                            {isStaff
                              ? reply.authorName || 'Teacher'
                              : reply.author_kind === 'guardian'
                              ? `Parent of ${root.studentName}`
                              : root.studentName}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isStaff
                                ? 'bg-primary/10 text-primary'
                                : 'bg-surface-muted text-text-muted border border-border'
                            }`}
                          >
                            {isStaff ? 'Staff' : reply.author_kind === 'guardian' ? 'Guardian' : 'Student'}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {formatDateTime(reply.created_at)}
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(reply.id, false)}
                        disabled={isPending || deletingId === reply.id}
                        className="text-[11px] text-danger-text hover:underline border border-red-200 px-2 py-0.5 rounded bg-danger-bg/30 hover:bg-danger-bg transition-colors disabled:opacity-50"
                      >
                        {deletingId === reply.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap pl-9">
                    {reply.body}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reply Form */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Reply to Thread</h3>
        <form onSubmit={handleSendReply} className="space-y-3">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            disabled={isPending}
            rows={4}
            maxLength={2000}
            placeholder="Write a clear, helpful reply for the student..."
            className="w-full border border-border rounded-lg p-3 text-sm text-text-primary bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-muted disabled:opacity-60"
          />

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-text-secondary">
              {replyBody.length} / 2000 characters
              <span className="hidden sm:inline text-text-muted ml-2">
                · Replying marks the question as Answered
              </span>
            </span>

            <button
              type="submit"
              disabled={isPending || replyBody.trim().length === 0}
              className="bg-primary text-white text-xs font-semibold rounded-lg px-4 py-2 hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isPending ? 'Sending reply…' : 'Send Reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
