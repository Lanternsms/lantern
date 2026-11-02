import { createSubject } from '@/app/dashboard/academics/subjects/actions'
import Link from 'next/link'

export default async function NewSubjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 max-w-lg">
      <Link href="/dashboard/academics/subjects" className="inline-flex w-fit items-center gap-1 text-sm text-text-secondary hover:text-text-primary">← Back to subjects
      </Link>
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] mt-4 mb-6">Add Subject</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createSubject} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Subject Name *</label>
          <input name="name" required placeholder="e.g. Mathematics" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Code</label>
          <input name="code" placeholder="e.g. MTH" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
          Add Subject
        </button>
      </form>
    </div>
  )
}