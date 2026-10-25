'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
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

export function NotificationBell({
  initialUnreadCount,
}: {
  initialUnreadCount: number
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const fetchUnreadCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)
    setUnreadCount(count ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Real-time subscription for new notifications
  useEffect(() => {
    const channel = supabase
      .channel('user_notifications_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUnreadCount])

  async function fetchNotifications() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('user_notifications')
      .select('id, title, body, url, category, created_at, read_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setNotifications(data ?? [])
    setLoading(false)
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('read_at', null)
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
  }

  async function markOneRead(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  function handleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      startTransition(() => {
        fetchNotifications()
      })
    }
  }

  const clampedCount = Math.min(unreadCount, 99)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="notification-bell-btn"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-full text-text-primary hover:bg-surface-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {/* Bell icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {clampedCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none rounded-full bg-primary text-white ring-2 ring-surface"
          >
            {clampedCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id="notification-dropdown"
          className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-secondary">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="text-sm">No notifications yet</span>
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = !n.read_at
                const dot = categoryColour[n.category] ?? 'bg-slate-400'
                const inner = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-muted transition-colors cursor-pointer ${isUnread ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      if (isUnread) markOneRead(n.id)
                      if (n.url) setOpen(false)
                    }}
                  >
                    <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug truncate ${isUnread ? 'font-semibold text-text-primary' : 'text-text-primary'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[11px] text-text-secondary mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {isUnread && (
                      <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                )
                return n.url ? (
                  <Link key={n.id} href={n.url}>{inner}</Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border text-center">
            <Link
              href="/dashboard/notifications"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
