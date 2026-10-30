import { createSession } from '@/app/dashboard/academics/actions'
import Link from 'next/link'

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="px-5 py-7 sm:px-8 sm:py-8 max-w-lg">
      <Link href="/dashboard/academics/sessions" className="text-sm text-primary hover:text-primary-hover">
        ← Back to sessions
      </Link>
      <h1 className="text-2xl font-bold tracking-[-0.01em] text-text-primary mt-4 mb-6">Add Academic Session</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createSession} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Session Name *</label>
          <input name="name" required placeholder="e.g. 2025/2026" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Start Date *</label>
            <input name="start_date" type="date" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">End Date *</label>
            <input name="end_date" type="date" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
          Add Session
        </button>
      </form>
    </div>
  )
}