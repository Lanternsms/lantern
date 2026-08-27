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
    <div className="px-8 py-8 max-w-lg">
      <Link href="/dashboard/academics/classes" className="text-sm text-primary hover:text-primary-hover">
        ← Back to classes
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Add Class</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={createClass} className="bg-surface border border-border rounded-xl p-6 space-y-4">
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
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Add Class
        </button>
      </form>
    </div>
  )
}