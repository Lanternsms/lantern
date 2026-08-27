import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { createGradeBand, deleteGradeBand } from '@/app/dashboard/academics/grading/actions'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

export default async function ScaleDetailPage({
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
    .select('id, name, is_default')
    .eq('id', id)
    .single()

  if (fetchError || !scale) notFound()

  const { data: bands } = await supabase
    .from('grade_bands')
    .select('id, min_score, max_score, grade, remark')
    .eq('scale_id', id)
    .order('min_score', { ascending: false })

  return (
    <div className="px-8 py-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics/grading" className="hover:text-primary">Grading Scales</Link> / {scale.name}
      </p>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-text-primary">{scale.name}</h1>
          {scale.is_default && (
            <span className="text-xs font-medium bg-success-bg text-success-text rounded-full px-2.5 py-0.5">Default</span>
          )}
        </div>
        <Link href={`/dashboard/academics/grading/${id}/edit`} className="flex items-center gap-1.5 text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
          <Pencil size={14} /> Rename
        </Link>
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Grade Bands</h3>

        {bands && bands.length > 0 ? (
          <div className="mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary text-xs uppercase tracking-wide">
                  <th className="pb-2 font-medium">Score Range</th>
                  <th className="pb-2 font-medium">Grade</th>
                  <th className="pb-2 font-medium">Remark</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="py-2 text-text-primary">{b.min_score}–{b.max_score}</td>
                    <td className="py-2 text-text-primary font-medium">{b.grade}</td>
                    <td className="py-2 text-text-secondary">{b.remark ?? '—'}</td>
                    <td className="py-2 text-right">
                      <form action={deleteGradeBand}>
                        <input type="hidden" name="band_id" value={b.id} />
                        <input type="hidden" name="scale_id" value={id} />
                        <button type="submit" className="text-text-secondary hover:text-danger-text">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted mb-5">No grade bands yet. Add ranges below to cover 0–100.</p>
        )}

        <form action={createGradeBand} className="grid grid-cols-5 gap-2 items-end">
          <input type="hidden" name="scale_id" value={id} />
          <div>
            <label className="block text-xs text-text-secondary mb-1">Min *</label>
            <input name="min_score" type="number" min="0" max="100" required className="w-full rounded-lg border border-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Max *</label>
            <input name="max_score" type="number" min="0" max="100" required className="w-full rounded-lg border border-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Grade *</label>
            <input name="grade" required maxLength={2} placeholder="A" className="w-full rounded-lg border border-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Remark</label>
            <input name="remark" placeholder="Excellent" className="w-full rounded-lg border border-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors h-fit">
            Add Band
          </button>
        </form>
      </section>
    </div>
  )
}