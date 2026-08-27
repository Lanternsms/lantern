import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateScale } from '@/app/dashboard/academics/grading/actions'
import Link from 'next/link'

export default async function EditScalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: scale, error: fetchError } = await supabase
    .from('grading_scales')
    .select('id, name')
    .eq('id', id)
    .single()

  if (fetchError || !scale) notFound()

  const updateScaleWithId = updateScale.bind(null, id)

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href={`/dashboard/academics/grading/${id}`} className="text-sm text-primary hover:text-primary-hover">
        ← Back to scale
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Rename Scale</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateScaleWithId} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Scale Name *</label>
          <input name="name" defaultValue={scale.name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  )
}