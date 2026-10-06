import { Fragment } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import {
  renameTemplate, setActiveTemplate, addStage, updateStage, moveStage, deleteStage,
} from '@/app/dashboard/academics/workflow/actions'
import Link from 'next/link'
import { ArrowRight, ArrowUp, ArrowDown, Trash2, AlertTriangle } from 'lucide-react'

function roleLabel(name: string) {
  if (name === 'hod') return 'HOD'
  return name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default async function WorkflowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: template, error: fetchError } = await supabase
    .from('workflow_templates')
    .select('id, name, is_active')
    .eq('id', id)
    .single()

  if (fetchError || !template) notFound()

  const { data: stages } = await supabase
    .from('workflow_stages')
    .select('id, sequence_order, name, approver_role_id, is_final')
    .eq('template_id', id)
    .order('sequence_order')

  const { data: allRoles } = await supabase.from('roles').select('id, name').order('name')
  // Parents and students should never be able to approve results
  const approverRoles = (allRoles ?? []).filter((r) => r.name !== 'parent' && r.name !== 'student')
  const roleNameById = new Map((allRoles ?? []).map((r) => [r.id, r.name] as [string, string]))

  // How many people currently hold each stage's approver role. A stage
  // whose role nobody holds would leave submitted results stuck forever,
  // so we warn about it. (Counts are only complete for users allowed to
  // view all role assignments, i.e. admins.)
  const stageRoleIds = [...new Set((stages ?? []).map((s) => s.approver_role_id).filter((r): r is string => !!r))]
  const { data: holders } =
    stageRoleIds.length > 0
      ? await supabase.from('user_roles').select('role_id').in('role_id', stageRoleIds)
      : { data: [] as { role_id: string }[] }

  const holderCount = new Map<string, number>()
  for (const h of holders ?? []) holderCount.set(h.role_id, (holderCount.get(h.role_id) ?? 0) + 1)

  const renameWithId = renameTemplate.bind(null, id)

  return (
    <div className="px-8 py-8 max-w-3xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics/workflow" className="hover:text-primary">Approval Workflow</Link> / {template.name}
      </p>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-text-primary">{template.name}</h1>
          {template.is_active && (
            <span className="text-xs font-medium bg-success-bg text-success-text rounded-full px-2.5 py-0.5">Active</span>
          )}
        </div>
        {!template.is_active && (
          <form action={setActiveTemplate}>
            <input type="hidden" name="template_id" value={id} />
            <input type="hidden" name="back" value={`/dashboard/academics/workflow/${id}`} />
            <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
              Make Active
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {!template.is_active && (
        <p className="text-xs text-text-secondary bg-surface-muted border border-border rounded-lg px-3 py-2 mb-4">
          This workflow isn&apos;t active, so new result submissions won&apos;t use it yet.
        </p>
      )}

      {/* Visual flow */}
      <section className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">Approval Flow</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium bg-secondary/10 text-secondary rounded-lg px-3 py-2">Teacher submits</span>
          {stages?.map((s) => (
            <Fragment key={s.id}>
              <ArrowRight size={14} className="text-text-muted" />
              <span className="text-xs font-medium bg-primary/10 text-primary rounded-lg px-3 py-2">
                {s.name}
                <span className="block text-[11px] font-normal text-text-secondary">
                  {roleLabel(roleNameById.get(s.approver_role_id ?? '') ?? 'No role')}
                </span>
              </span>
            </Fragment>
          ))}
          <ArrowRight size={14} className="text-text-muted" />
          <span className="text-xs font-medium bg-success-bg text-success-text rounded-lg px-3 py-2">Published</span>
        </div>
        {(!stages || stages.length === 0) && (
          <p className="text-xs text-text-muted mt-3">No approval stages yet. Add the first one below.</p>
        )}
      </section>

      {/* Stages */}
      <section className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">Approval Stages</h3>

        {stages && stages.length > 0 && (
          <div className="space-y-3 mb-5">
            {stages.map((s, i) => {
              const roleName = roleNameById.get(s.approver_role_id ?? '')
              const holdersForRole = s.approver_role_id ? holderCount.get(s.approver_role_id) ?? 0 : 0
              const isFirst = i === 0
              const isLast = i === stages.length - 1

              return (
                <div key={s.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>

                    <form action={updateStage} className="flex items-center gap-2 flex-1">
                      <input type="hidden" name="stage_id" value={s.id} />
                      <input type="hidden" name="template_id" value={id} />
                      <input
                        name="name"
                        defaultValue={s.name}
                        required
                        className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <select
                        name="approver_role_id"
                        defaultValue={s.approver_role_id ?? ''}
                        required
                        className="rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {approverRoles.map((r) => (
                          <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>
                        ))}
                      </select>
                      <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium whitespace-nowrap">
                        Save
                      </button>
                    </form>

                    <form action={moveStage}>
                      <input type="hidden" name="stage_id" value={s.id} />
                      <input type="hidden" name="template_id" value={id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={isFirst}
                        aria-label="Move up"
                        className="p-1.5 rounded text-text-secondary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp size={14} />
                      </button>
                    </form>
                    <form action={moveStage}>
                      <input type="hidden" name="stage_id" value={s.id} />
                      <input type="hidden" name="template_id" value={id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={isLast}
                        aria-label="Move down"
                        className="p-1.5 rounded text-text-secondary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </form>
                    <form action={deleteStage}>
                      <input type="hidden" name="stage_id" value={s.id} />
                      <input type="hidden" name="template_id" value={id} />
                      <button type="submit" aria-label="Delete stage" className="p-1.5 text-text-secondary hover:text-danger-text">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>

                  {s.is_final && (
                    <p className="text-xs text-text-secondary mt-2 ml-8">
                      Final stage: approving here publishes the results.
                    </p>
                  )}
                  {holdersForRole === 0 && (
                    <p className="text-xs text-amber-700 mt-1 ml-8 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      No one holds the {roleLabel(roleName ?? 'selected')} role yet, so results would stall at this stage.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <form action={addStage} className="flex gap-2 pt-4 border-t border-border">
          <input type="hidden" name="template_id" value={id} />
          <input
            name="name"
            required
            placeholder="e.g. HOD Review"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            name="approver_role_id"
            required
            defaultValue=""
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>Approver role...</option>
            {approverRoles.map((r) => (
              <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>
            ))}
          </select>
          <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors whitespace-nowrap">
            Add Stage
          </button>
        </form>
      </section>

      {/* Rename */}
      <form action={renameWithId} className="bg-surface border border-border rounded-xl p-5 flex items-end gap-2 mb-6">
        <div className="flex-1">
          <label className="block text-sm text-text-secondary mb-1.5">Workflow Name</label>
          <input
            name="name"
            defaultValue={template.name}
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button type="submit" className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
          Rename
        </button>
      </form>

      <p className="text-xs text-text-muted">
        How it works: when a teacher submits results, they go to stage 1. Each approver can approve, reject or return
        them to the teacher. Approving the last stage publishes the results to students and parents.
      </p>
    </div>
  )
}