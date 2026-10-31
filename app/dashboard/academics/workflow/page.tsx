import { createClient } from '@/lib/supabase/server'
import { setActiveTemplate, deleteTemplate, seedWorkflowPreset } from '@/app/dashboard/academics/workflow/actions'
import Link from 'next/link'
import { Trash2 } from '@/components/icons'

export default async function WorkflowListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: templates, error: fetchError } = await supabase
    .from('workflow_templates')
    .select('id, name, is_active, workflow_stages(id)')
    .order('is_active', { ascending: false })
    .order('name')

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Approval Workflow
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Approval Workflow</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Define who reviews and approves results before they are published. Only the active workflow is used for new submissions.
          </p>
        </div>
        <Link href="/dashboard/academics/workflow/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">New Workflow
        </Link>
      </div>

      {(error || fetchError) && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">
          {error ?? fetchError?.message}
        </p>
      )}

      {!fetchError && templates?.length === 0 && (
        <div className="card p-8">
          <p className="text-sm text-text-secondary text-center mb-6">
            No approval workflow yet. Start from a preset, or build your own from scratch.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form action={seedWorkflowPreset} className="border border-border rounded-lg p-5">
              <input type="hidden" name="preset" value="simple" />
              <h3 className="text-sm font-medium text-text-primary mb-1">Simple</h3>
              <p className="text-xs text-text-secondary mb-4">Teacher submits, the principal approves, results are published.</p>
              <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
                Use Simple
              </button>
            </form>
            <form action={seedWorkflowPreset} className="border border-border rounded-lg p-5">
              <input type="hidden" name="preset" value="standard" />
              <h3 className="text-sm font-medium text-text-primary mb-1">Standard</h3>
              <p className="text-xs text-text-secondary mb-4">Teacher submits, the HOD reviews, the principal approves, results are published.</p>
              <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
                Use Standard
              </button>
            </form>
          </div>
        </div>
      )}

      {templates && templates.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Workflow</th>
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Stages</th>
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-school-soft/40">
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/academics/workflow/${t.id}`} className="text-text-primary font-medium hover:text-primary">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">{t.workflow_stages?.length ?? 0}</td>
                  <td className="px-5 py-3.5">
                    {t.is_active ? (
                      <span className="text-xs font-medium bg-success-bg text-success-text rounded-full px-2.5 py-1">Active</span>
                    ) : (
                      <form action={setActiveTemplate}>
                        <input type="hidden" name="template_id" value={t.id} />
                        <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium">
                          Make Active
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {!t.is_active && (
                      <form action={deleteTemplate}>
                        <input type="hidden" name="template_id" value={t.id} />
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