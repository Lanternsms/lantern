import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from '@/components/icons'

/** How long a batch has waited, and whether that is long enough to flag. */
function age(iso: string | null) {
  if (!iso) return { text: '', late: false }
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return { text: d <= 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`, late: d >= 2 }
}

export default async function ApprovalsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ decided?: string }>
}) {
  const { decided } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve the current user's role so we only show batches at their stage.
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .single()

  // Fetch all in-review batches and filter to those whose current stage's
  // approver_role_id matches this user's role.
  const { data: batches, error } = await supabase
    .from('result_batches')
    .select('id, submitted_at, classes(name), arms(name), subjects(name), profiles(first_name, last_name), workflow_stages!current_stage_id(name, approver_role_id)')
    .eq('status', 'in_review')
    .order('submitted_at')

  const myBatches = userRole
    ? (batches ?? []).filter((b) => {
        const stage = b.workflow_stages as { name: string; approver_role_id: string } | null
        return stage?.approver_role_id === userRole.role_id
      })
    : []

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] font-semibold leading-tight sm:text-[36px]">Waiting for your approval</h1>
        <p className="text-[15px] text-text-secondary">
          {myBatches.length === 0 ? 'Nothing is waiting on you right now.' : `${myBatches.length} result batch${myBatches.length === 1 ? '' : 'es'}, oldest first.`}
        </p>
      </div>

      {decided && <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm text-success-text"><CheckCircle2 size={16} /> Decision recorded. The teacher has been told.</p>}
      {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">Couldn’t load approvals: {error.message}</p>}

      {myBatches.length > 0 && (
        <ul className="card divide-y divide-rule">
          {myBatches.map((b) => {
            const stage = b.workflow_stages as { name: string; approver_role_id: string } | null
            const a = age(b.submitted_at)
            return (
              <li key={b.id}>
                <Link href={`/dashboard/approvals/${b.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-school-soft/40">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-school-soft font-display font-semibold text-school-ink">
                    {(b.subjects?.name ?? '?').slice(0, 2)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{b.subjects?.name} · {b.classes?.name}{b.arms?.name ?? ''}</span>
                    <span className="truncate text-sm text-text-secondary">{b.profiles?.first_name} {b.profiles?.last_name}{stage?.name ? ` · at ${stage.name}` : ''}</span>
                  </span>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${a.late ? 'bg-warning-bg text-warning-text' : 'bg-raised text-[#374151]'}`}>{a.text}</span>
                  <span className="hidden h-9 items-center rounded-xl bg-primary px-3.5 text-sm font-semibold text-white group-hover:bg-primary-hover sm:flex">Review</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
