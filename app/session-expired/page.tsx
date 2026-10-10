import Link from 'next/link'

export default function SessionExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-semibold text-accent tracking-wide uppercase">Session expired</p>
        <h1 className="text-2xl font-semibold text-text-primary">You&apos;ve been signed out</h1>
        <p className="text-sm text-text-secondary">
          For your security, you were signed out after a period of inactivity. Please log in again to continue.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors"
        >
          Log in again
        </Link>
      </div>
    </div>
  )
}