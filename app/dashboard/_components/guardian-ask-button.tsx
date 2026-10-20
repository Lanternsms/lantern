'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  askQuestion,
  listMyThreads,
  replyToThread,
  setThreadStatus,
} from '@/app/dashboard/lms/questions/actions'

type Reply = {
  id: string
  body: string
  author_kind?: string
  author_name?: string | null
  created_at: string
}

type Thread = {
  id: string
  body: string
  status: 'open' | 'answered' | 'closed'
  created_at: string
  replies?: Reply[]
}

const MAX = 2000
const GENERIC_ERROR = 'Something went wrong. Please try again.'

function unwrapError(res: any): string | null {
  if (res && typeof res === 'object' && !Array.isArray(res) && res.error) {
    return typeof res.error === 'string' ? res.error : GENERIC_ERROR
  }
  return null
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function statusChip(status: Thread['status']) {
  if (status === 'answered') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'closed') return 'bg-surface-muted text-text-secondary border-border'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

function statusLabel(status: Thread['status']) {
  if (status === 'answered') return 'Answered'
  if (status === 'closed') return 'Resolved'
  return 'Waiting for reply'
}

export default function GuardianAskButton({
  lessonId,
  title,
  studentId,
  label = 'Q&A',
}: {
  lessonId: string
  title: string
  studentId: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [draft, setDraft] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res: any = await listMyThreads({ lessonId, studentId })
      const err = unwrapError(res)
      if (err) {
        setError(err)
        setThreads([])
      } else {
        setThreads(Array.isArray(res) ? res : res?.threads ?? [])
      }
    } catch {
      setError('Could not load your questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [lessonId, studentId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function run(fn: () => Promise<any>, onOk?: () => void) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      const err = unwrapError(res)
      if (err) {
        setError(err)
      } else {
        onOk?.()
        await load()
      }
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  function submitQuestion(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || body.length > MAX) return
    run(() => askQuestion({ lessonId, studentId, body }), () => setDraft(''))
  }

  function submitReply(rootId: string) {
    const body = (replyDrafts[rootId] ?? '').trim()
    if (!body || body.length > MAX) return
    run(
      () => replyToThread({ rootId, body }),
      () => setReplyDrafts((d) => ({ ...d, [rootId]: '' }))
    )
  }

  function resolve(rootId: string) {
    run(() => setThreadStatus({ rootId, status: 'closed' }))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center text-sm font-medium text-primary border border-primary/30 hover:bg-primary/10 rounded-lg px-3 py-1.5 transition-colors"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Questions about ${title}`}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="min-w-0">
                <p className="text-xs text-text-secondary">Questions about</p>
                <h2 className="text-sm font-semibold text-text-primary truncate">{title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-text-secondary hover:text-text-primary text-xl leading-none px-1"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {loading ? (
                <p className="text-sm text-text-secondary">Loading…</p>
              ) : threads.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-6">
                  No questions yet. Ask your teacher about this lesson.
                </p>
              ) : (
                threads.map((t) => (
                  <div key={t.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2.5 bg-surface-muted/50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] text-text-secondary">You · {formatWhen(t.created_at)}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusChip(t.status)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{t.body}</p>
                    </div>

                    {(t.replies ?? []).map((r) => (
                      <div key={r.id} className="px-3 py-2.5 border-t border-border">
                        <span className="block text-[11px] text-text-secondary mb-1">
                          {r.author_kind === 'staff'
                            ? `${r.author_name ? `${r.author_name} · ` : ''}Teacher`
                            : 'You'}{' '}
                          · {formatWhen(r.created_at)}
                        </span>
                        <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{r.body}</p>
                      </div>
                    ))}

                    {t.status !== 'closed' && (
                      <div className="px-3 py-2.5 border-t border-border space-y-2">
                        <textarea
                          value={replyDrafts[t.id] ?? ''}
                          onChange={(e) => setReplyDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                          rows={2}
                          maxLength={MAX}
                          placeholder="Write a follow-up…"
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => resolve(t.id)}
                            disabled={busy}
                            className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                          >
                            Mark resolved
                          </button>
                          <button
                            type="button"
                            onClick={() => submitReply(t.id)}
                            disabled={busy || !(replyDrafts[t.id] ?? '').trim()}
                            className="text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg px-3 py-1.5 disabled:opacity-50"
                          >
                            Send reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitQuestion} className="px-5 py-4 border-t border-border space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={MAX}
                placeholder="Ask a question about this lesson…"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-secondary">
                  {draft.length}/{MAX}
                </span>
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Ask question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}