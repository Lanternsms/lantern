import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-semibold text-accent tracking-wide uppercase">404</p>
        <h1 className="text-2xl font-semibold text-text-primary">Page not found</h1>
        <p className="text-sm text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist, may have been moved, or the link might be out of date.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-text-secondary hover:text-text-primary border border-border px-4 py-2 rounded-lg transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}