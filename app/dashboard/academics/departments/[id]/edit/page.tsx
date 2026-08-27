import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateDepartment } from '@/app/dashboard/academics/departments/actions'
import Link from 'next/link'

export default async function EditDepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: department, error: fetchError } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', id)
    .single()

  if (fetchError || !department) notFound()

  const updateDepartmentWithId = updateDepartment.bind(null, id)

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href="/dashboard/academics/departments" className="text-sm text-primary hover:text-primary-hover">
        ← Back to departments
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Edit Department</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateDepartmentWithId} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Department Name *</label>
          <input name="name" defaultValue={department.name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  )
}