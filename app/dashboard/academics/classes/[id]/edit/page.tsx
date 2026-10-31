import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateClass } from '@/app/dashboard/academics/classes/actions'
import Link from 'next/link'

export default async function EditClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: cls, error: fetchError } = await supabase
    .from('classes')
    .select('id, name, level, department_id')
    .eq('id', id)
    .single()

  if (fetchError || !cls) notFound()

  const { data: departments } = await supabase.from('departments').select('id, name').order('name')
  const updateClassWithId = updateClass.bind(null, id)

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 max-w-lg">
      <Link href={`/dashboard/academics/classes/${id}`} className="inline-flex w-fit items-center gap-1 text-sm text-text-secondary hover:text-text-primary">← Back to class
      </Link>
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] mt-4 mb-6">Edit Class</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateClassWithId} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Class Name *</label>
          <input name="name" defaultValue={cls.name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Level</label>
          <input name="level" type="number" defaultValue={cls.level ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Department</label>
          <select name="department_id" defaultValue={cls.department_id ?? ''} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">None</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  )
}