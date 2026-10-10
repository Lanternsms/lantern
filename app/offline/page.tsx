'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-semibold text-accent tracking-wide uppercase">No connection</p>
        <h1 className="text-2xl font-semibold text-text-primary">You&apos;re offline</h1>
        <p className="text-sm text-text-secondary">
          Lantern needs an internet connection to load your school&apos;s data. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}