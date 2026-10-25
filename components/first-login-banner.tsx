'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Sparkles, X } from 'lucide-react'

export function FirstLoginBanner({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const key = `lantern_first_visit_${userId}`
      const dismissed = localStorage.getItem(key)
      if (!dismissed) {
        setVisible(true)
      }
    } catch {
      // Ignore localStorage error
    }
  }, [userId])

  if (!visible) return null

  function handleDismiss() {
    setVisible(false)
    try {
      localStorage.setItem(`lantern_first_visit_${userId}`, 'true')
    } catch {
      // Ignore localStorage error
    }
  }

  return (
    <div className="relative mb-6 rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="absolute top-3 right-3 text-text-muted hover:text-text-primary p-1 rounded-md transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3.5 pr-8">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-text-primary">
            Welcome to Lantern! Install the app &amp; enable notifications
          </h2>
          <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">
            Stay up to date with instant attendance notices, published academic results, and school announcements. Enable push alerts on this device and add Lantern to your home screen.
          </p>
          <div className="pt-1.5 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/notifications/settings"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-3.5 py-1.5 rounded-lg transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              Manage notifications &amp; install
            </Link>
            <button
              onClick={handleDismiss}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
