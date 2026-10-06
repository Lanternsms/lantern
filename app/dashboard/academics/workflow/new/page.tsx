import { createTemplate } from '@/app/dashboard/academics/workflow/actions'
import Link from 'next/link'

export default async function NewWorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href="/dashboard/academics/workflow" className="text-sm text-primary hover:text-primary-hover">
        ← Back to workflows
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">New Approval Workflow</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createTemplate} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Workflow Name *</label>
          <input
            name="name"
            required
            placeholder="e.g. Senior Classes Approval"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <p className="text-xs text-text-muted">
          You&apos;ll add approval stages next. A new workflow stays inactive until you make it the active one.
        </p>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Create Workflow
        </button>
      </form>
    </div>
  )
}