import { createScale } from '@/app/dashboard/academics/grading/actions'
import Link from 'next/link'

export default async function NewScalePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href="/dashboard/academics/grading" className="text-sm text-primary hover:text-primary-hover">
        ← Back to grading scales
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Add Grading Scale</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createScale} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Scale Name *</label>
          <input name="name" required placeholder="e.g. Junior Class Scale" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <p className="text-xs text-text-muted">
          You&apos;ll add grade bands (score ranges) after creating the scale. It won&apos;t become your default scale until you explicitly set it as one.
        </p>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Create Scale
        </button>
      </form>
    </div>
  )
}