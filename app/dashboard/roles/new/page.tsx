import { createRole } from '@/app/dashboard/roles/actions'
import Link from 'next/link'

export default async function NewRolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="px-5 py-7 sm:px-8 sm:py-8 max-w-lg">
      <Link href="/dashboard/roles" className="text-sm text-primary hover:text-primary-hover">
        ← Back to roles
      </Link>
      <h1 className="text-2xl font-bold tracking-[-0.01em] text-text-primary mt-4 mb-6">Add Custom Role</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createRole} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Role Name *</label>
          <input name="name" required placeholder="e.g. Head of Sciences" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Description</label>
          <textarea name="description" rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <p className="text-xs text-text-muted">You&apos;ll attach permissions to this role after creating it.</p>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
          Create Role
        </button>
      </form>
    </div>
  )
}