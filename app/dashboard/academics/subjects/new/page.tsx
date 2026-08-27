import { createSubject } from '@/app/dashboard/academics/subjects/actions'
import Link from 'next/link'

export default async function NewSubjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href="/dashboard/academics/subjects" className="text-sm text-primary hover:text-primary-hover">
        ← Back to subjects
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Add Subject</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createSubject} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Subject Name *</label>
          <input name="name" required placeholder="e.g. Mathematics" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Code</label>
          <input name="code" placeholder="e.g. MTH" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Add Subject
        </button>
      </form>
    </div>
  )
}