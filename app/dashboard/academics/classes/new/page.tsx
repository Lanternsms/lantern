import { createClient } from '@/lib/supabase/server'
import { createClass } from '@/app/dashboard/academics/classes/actions'
import Link from 'next/link'

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: departments } = await supabase.from('departments').select('id, name').order('name')

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 max-w-lg">
      <Link href="/dashboard/academics/classes" className="inline-flex w-fit items-center gap-1 text-sm text-text-secondary hover:text-text-primary">← Back to classes
      </Link>
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] mt-4 mb-6">Add Class</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createClass} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Class Name *</label>
          <input name="name" required placeholder="e.g. JSS1" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Level</label>
          <input name="level" type="number" placeholder="e.g. 1 (used for sort order — JSS1=1, JSS2=2...)" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Department</label>
          <select name="department_id" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">None</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
          Add Class
        </button>
      </form>
    </div>
  )
}