import { createTerm } from '@/app/dashboard/academics/actions'
import Link from 'next/link'

export default async function NewTermPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href={`/dashboard/academics/sessions/${id}`} className="text-sm text-primary hover:text-primary-hover">
        ← Back to session
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Add Term</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createTerm} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <input type="hidden" name="session_id" value={id} />
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Term Name *</label>
          <select name="name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select...</option>
            <option value="First Term">First Term</option>
            <option value="Second Term">Second Term</option>
            <option value="Third Term">Third Term</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Start Date *</label>
            <input name="start_date" type="date" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">End Date *</label>
            <input name="end_date" type="date" required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Add Term
        </button>
      </form>
    </div>
  )
}