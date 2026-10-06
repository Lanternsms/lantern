import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

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
    <div className="px-8 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Approvals</h1>
      <p className="text-sm text-text-secondary mb-6">Result batches waiting on your review.</p>

      {decided && (
        <p className="flex items-center gap-2 text-sm text-success-text bg-success-bg rounded-lg px-3 py-2 mb-4">
          <CheckCircle2 size={16} /> Decision recorded.
        </p>
      )}
      {error && <p className="text-sm text-danger-text">Error: {error.message}</p>}
      {!error && myBatches.length === 0 && <p className="text-sm text-text-secondary">Nothing waiting on you right now.</p>}

      {myBatches.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Class / Subject</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Submitted By</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Stage</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {myBatches.map((b) => {
                const stage = b.workflow_stages as { name: string; approver_role_id: string } | null
                return (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {b.subjects?.name} - {b.classes?.name}{b.arms?.name ? ` ${b.arms.name}` : ''}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{b.profiles?.first_name} {b.profiles?.last_name}</td>
                    <td className="px-4 py-3 text-text-secondary">{stage?.name}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/approvals/${b.id}`} className="text-xs text-primary hover:text-primary-hover font-medium">
                        Review
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}