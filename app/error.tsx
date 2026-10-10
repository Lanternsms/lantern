'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled app error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-semibold text-red-600 tracking-wide uppercase">Something went wrong</p>
        <h1 className="text-2xl font-semibold text-text-primary">We hit a snag</h1>
        <p className="text-sm text-text-secondary">
          An unexpected error occurred. You can try again, or head back and pick up where you left off.
        </p>
        {error.digest && (
          <p className="text-xs text-text-secondary font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-text-secondary hover:text-text-primary border border-border px-4 py-2 rounded-lg transition-colors"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}