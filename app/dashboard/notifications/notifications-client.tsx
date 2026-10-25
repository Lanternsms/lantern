'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Notification {
  id: string
  title: string
  body: string | null
  url: string | null
  category: string
  created_at: string
  read_at: string | null
}

const categoryColour: Record<string, string> = {
  results: 'bg-blue-500',
  attendance: 'bg-amber-500',
  fees: 'bg-green-500',
  learning: 'bg-violet-500',
  qa: 'bg-pink-500',
  announcements: 'bg-sky-500',
  account: 'bg-orange-500',
  system: 'bg-slate-500',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationsPageClient({
  initialNotifications,
}: {
  initialNotifications: Notification[]
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const supabase = createClient()

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('read_at', null)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
  }

  async function markOneRead(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
  }

  const unread = notifications.filter(n => !n.read_at).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          {unread > 0 && (
            <p className="text-sm text-text-secondary mt-0.5">{unread} unread</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              Mark all as read
            </button>
          )}
          <Link
            href="/dashboard/notifications/settings"
            className="text-xs font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted transition-colors"
          >
            Settings &amp; App
          </Link>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-text-secondary">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-base">You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden">
          {notifications.map(n => {
            const isUnread = !n.read_at
            const dot = categoryColour[n.category] ?? 'bg-slate-400'
            const inner = (
              <div
                className={`flex items-start gap-4 px-5 py-4 hover:bg-surface-muted transition-colors cursor-pointer ${isUnread ? 'bg-primary/5' : ''}`}
                onClick={() => { if (isUnread) markOneRead(n.id) }}
              >
                <span className={`mt-2 shrink-0 w-2.5 h-2.5 rounded-full ${dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-text-primary' : 'text-text-primary'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-sm text-text-secondary mt-0.5">{n.body}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-text-secondary">{timeAgo(n.created_at)}</span>
                    <span className="text-xs capitalize text-text-secondary bg-surface-muted px-2 py-0.5 rounded-full">{n.category}</span>
                  </div>
                </div>
                {isUnread && (
                  <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
            )

            return (
              <Link key={n.id} href={`/n/${n.id}`}>
                {inner}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
