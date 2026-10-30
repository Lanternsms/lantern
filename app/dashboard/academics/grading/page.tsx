import { createClient } from '@/lib/supabase/server'
import { setDefaultScale, deleteScale, seedDefaultScale } from '@/app/dashboard/academics/grading/actions'
import Link from 'next/link'
import { Trash2 } from '@/components/icons'

export default async function GradingScalesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: scales, error: fetchError } = await supabase
    .from('grading_scales')
    .select('id, name, is_default, grade_bands(id)')
    .order('is_default', { ascending: false })

  return (
    <div className="px-5 py-7 sm:px-8 sm:py-8">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Grading Scales
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.01em] text-text-primary">Grading Scales</h1>
          <p className="text-sm text-text-secondary mt-1">
            Define how scores map to grades. One scale must always be marked default.
          </p>
        </div>
        <Link href="/dashboard/academics/grading/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-xl px-4 py-2 transition-colors">
          + Add Scale
        </Link>
      </div>

      {(error || fetchError) && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">
          {error ?? fetchError?.message}
        </p>
      )}

      {!fetchError && scales?.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-secondary mb-4">
            No grading scales yet. Start with the standard A–F scale, or build your own from scratch.
          </p>
          <form action={seedDefaultScale}>
            <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-xl px-4 py-2 transition-colors">
              Create Standard Scale (A–F)
            </button>
          </form>
        </div>
      )}

      {scales && scales.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs ">Scale</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs ">Grade Bands</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs ">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {scales.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/academics/grading/${s.id}`} className="text-text-primary font-medium hover:text-primary">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.grade_bands?.length ?? 0} bands</td>
                  <td className="px-4 py-3">
                    {s.is_default ? (
                      <span className="text-xs font-medium bg-success-bg text-success-text rounded-full px-2.5 py-1">Default</span>
                    ) : (
                      <form action={setDefaultScale}>
                        <input type="hidden" name="scale_id" value={s.id} />
                        <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium">
                          Set as Default
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!s.is_default && (
                      <form action={deleteScale}>
                        <input type="hidden" name="scale_id" value={s.id} />
                        <input type="hidden" name="is_default" value="false" />
                        <button type="submit" className="text-text-secondary hover:text-danger-text inline-flex">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}