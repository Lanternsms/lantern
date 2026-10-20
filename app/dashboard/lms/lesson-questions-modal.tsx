// app/dashboard/lms/lesson-questions-modal.tsx
"use client"

import React, { useState, useEffect } from 'react'

interface Thread {
  id: string
  body: string
  status: string
  created_at: string
  replies: Reply[]
}
interface Reply {
  id: string
  body: string
  created_at: string
  author_id: string
  author_kind: string
}

export default function LessonQuestionsModal({
  lessonId,
  lessonTitle,
  studentId,
  onClose,
}: {
  lessonId: string
  lessonTitle: string
  studentId: string
  onClose: () => void
}) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(false)
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchThreads = async () => {
    setLoading(true)
    try {
      const res = await fetch('/dashboard/lms/questions/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listMyThreads', lessonId, studentId }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setThreads(data.threads ?? [])
    } catch (e) {
      setError('Failed to load threads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBody.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/dashboard/lms/questions/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'askQuestion', lessonId, studentId, body: newBody }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else {
        setNewBody('')
        await fetchThreads()
      }
    } catch {
      setError('Failed to submit question')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (rootId: string, replyBody: string) => {
    if (!replyBody.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/dashboard/lms/questions/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replyToThread', rootId, body: replyBody }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else await fetchThreads()
    } catch {
      setError('Failed to submit reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatus = async (rootId: string, status: 'open' | 'closed') => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/dashboard/lms/questions/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setThreadStatus', rootId, status }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else await fetchThreads()
    } catch {
      setError('Failed to change status')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">{lessonTitle} – Questions</h2>
          <button onClick={onClose} className="text-sm text-text-secondary hover:text-text-primary">Close</button>
        </div>
        {error && (
          <div className="mb-2 p-2 bg-danger-bg text-danger-text rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleAsk} className="mb-4">
          <textarea
            className="w-full rounded border border-border p-2 text-text-primary bg-surface"
            rows={3}
            placeholder="Ask a question…"
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            disabled={submitting}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-text-secondary">{newBody.length}/2000</span>
            <button
              type="submit"
              disabled={submitting || newBody.length === 0 || newBody.length > 2000}
              className="px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Ask'}
            </button>
          </div>
        </form>
        {loading ? (
          <p className="text-center text-text-secondary">Loading threads…</p>
        ) : threads.length === 0 ? (
          <p className="text-center text-text-secondary">No questions yet. Ask your teacher about this lesson.</p>
        ) : (
          <div className="space-y-4">
            {threads.map(thread => (
              <div key={thread.id} className="border border-border rounded p-3 bg-surface-muted">
                <p className="font-medium text-text-primary mb-1">{thread.body}</p>
                <p className="text-xs text-text-secondary mb-2">
                  {new Date(thread.created_at).toLocaleString()} – Status: {thread.status}
                </p>
                {thread.replies.map(reply => (
                  <div key={reply.id} className="ml-4 border-l pl-2 border-border mt-2">
                    <p className="text-sm text-text-primary">{reply.body}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(reply.created_at).toLocaleString()} – {reply.author_kind}
                    </p>
                  </div>
                ))}
                <ReplyForm onSubmit={body => handleReply(thread.id, body)} submitting={submitting} />
                {thread.status !== 'closed' && (
                  <button
                    className="mt-2 text-xs text-primary hover:underline"
                    onClick={() => handleStatus(thread.id, thread.status === 'open' ? 'closed' : 'open')}
                  >
                    Mark as {thread.status === 'open' ? 'Closed' : 'Open'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReplyForm({ onSubmit, submitting }: { onSubmit: (body: string) => void; submitting: boolean }) {
  const [body, setBody] = useState('')
  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    onSubmit(body)
    setBody('')
  }
  return (
    <form onSubmit={handle} className="mt-2">
      <textarea
        className="w-full rounded border border-border p-1 text-sm text-text-primary bg-surface"
        rows={2}
        placeholder="Reply…"
        value={body}
        onChange={e => setBody(e.target.value)}
        disabled={submitting}
      />
      <button
        type="submit"
        disabled={submitting || body.trim().length === 0}
        className="mt-1 px-3 py-1 text-xs bg-primary text-white rounded disabled:opacity-50"
      >
        Reply
      </button>
    </form>
  )
}
