import { createClient } from '@/lib/supabase/server'
import { seedDefaultAssessmentTypes, createAssessmentType, updateAssessmentType, deleteAssessmentType } from '@/app/dashboard/academics/assessments/actions'
import Link from 'next/link'
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default async function AssessmentTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: types, error: fetchError } = await supabase
    .from('assessment_types')
    .select('id, name, weight')
    .order('weight', { ascending: false })

  const totalWeight = types?.reduce((sum, t) => sum + Number(t.weight), 0) ?? 0
  const isBalanced = Math.abs(totalWeight - 100) < 0.01

  return (
    <div className="px-8 py-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Assessment Types
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Assessment Types</h1>
      <p className="text-sm text-text-secondary mb-6">
        Define how each term&apos;s final score is built — e.g. CA1, CA2, and Exam — and what percentage each contributes.
      </p>

      {(error || fetchError) && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error ?? fetchError?.message}
        </p>
      )}

      {!fetchError && types?.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center mb-6">
          <p className="text-sm text-text-secondary mb-4">
            No assessment types yet. Start with the standard CA1 / CA2 / Exam split, or build your own.
          </p>
          <form action={seedDefaultAssessmentTypes}>
            <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
              Create Standard Set (CA1 10% · CA2 10% · Exam 80%)
            </button>
          </form>
        </div>
      )}

      {types && types.length > 0 && (
        <>
          <div
            className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 mb-4 ${
              isBalanced ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'
            }`}
          >
            {isBalanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            Total weight: {totalWeight}%{!isBalanced && ' — this should add up to exactly 100%'}
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Weight (%)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
                            <tbody>
                {types.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <form action={updateAssessmentType} className="flex items-center gap-2 flex-1">
                          <input type="hidden" name="type_id" value={t.id} />
                          <input
                            name="name"
                            defaultValue={t.name}
                            className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <input
                            name="weight"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            defaultValue={t.weight}
                            className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium whitespace-nowrap">
                            Save
                          </button>
                        </form>
                        <form action={deleteAssessmentType}>
                          <input type="hidden" name="type_id" value={t.id} />
                          <button type="submit" className="text-text-secondary hover:text-danger-text">
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Add Assessment Type</h3>
        <form action={createAssessmentType} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="e.g. CA3"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            name="weight"
            type="number"
            step="0.1"
            min="0"
            max="100"
            required
            placeholder="Weight %"
            className="w-28 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors whitespace-nowrap">
            Add
          </button>
        </form>
      </section>
    </div>
  )
}