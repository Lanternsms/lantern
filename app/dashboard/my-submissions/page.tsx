import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  FileText,
  ArrowUpRight,
} from 'lucide-react'

export const metadata = {
  title: 'My Submissions | Lantern',
  description: 'Track all result batches you have submitted for approval.',
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

type BatchStatus = 'draft' | 'in_review' | 'returned' | 'published'

const statusConfig: Record<
  BatchStatus,
  { label: string; icon: React.ElementType; className: string; badgeClass: string }
> = {
  draft: {
    label: 'Draft',
    icon: FileText,
    className: 'text-text-secondary',
    badgeClass: 'bg-surface-muted text-text-secondary border border-border',
  },
  in_review: {
    label: 'In Review',
    icon: Clock,
    className: 'text-secondary',
    badgeClass: 'bg-secondary/10 text-secondary border border-secondary/20',
  },
  returned: {
    label: 'Returned',
    icon: RotateCcw,
    className: 'text-danger-text',
    badgeClass: 'bg-danger-bg text-danger-text border border-red-200',
  },
  published: {
    label: 'Published',
    icon: CheckCircle2,
    className: 'text-success-text',
    badgeClass: 'bg-success-bg text-success-text border border-green-200',
  },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as BatchStatus] ?? {
    label: status,
    icon: AlertCircle,
    className: 'text-text-secondary',
    badgeClass: 'bg-surface-muted text-text-secondary border border-border',
  }
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${cfg.badgeClass}`}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default async function MySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; subject?: string }>
}) {
  const { status: filterStatus, subject: filterSubject } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // All batches submitted by this teacher (across all terms)
  let query = supabase
    .from('result_batches')
    .select(
      `id, status, submitted_at, created_at,
       classes(name), arms(name), subjects(id, name), terms(name, is_current),
       workflow_stages!current_stage_id(name),
       workflow_actions(comment, action, created_at, profiles(first_name, last_name))`
    )
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })

  if (filterStatus) {
    query = query.eq('status', filterStatus)
  }

  const { data: batches, error } = await query

  // Resolve class_subjects for the "Re-open" link: match class+subject+session
  // We need the class_subjects id to build the gradebook link
  const { data: assignments } = await supabase
    .from('class_subjects')
    .select('id, class_id, arm_id, subject_id, session_id')
    .eq('teacher_id', user.id)

  // Build a quick lookup: subjectId → assignment id (for gradebook deep-link)
  // We try to match by subject only as a fallback since we don't have session per batch here
  const assignmentBySubject = new Map<string, string>()
  for (const a of assignments ?? []) {
    assignmentBySubject.set(a.subject_id, a.id)
  }

  // Filter by subject name client-side from the already-fetched data
  const filtered = filterSubject
    ? (batches ?? []).filter((b) => {
        const s = b.subjects as { name: string } | null
        return s?.name?.toLowerCase().includes(filterSubject.toLowerCase())
      })
    : (batches ?? [])

  // Summary counts
  const counts = {
    all: (batches ?? []).length,
    draft: (batches ?? []).filter((b) => b.status === 'draft').length,
    in_review: (batches ?? []).filter((b) => b.status === 'in_review').length,
    returned: (batches ?? []).filter((b) => b.status === 'returned').length,
    published: (batches ?? []).filter((b) => b.status === 'published').length,
  }

  const tabs: { key: string; label: string; count: number }[] = [
    { key: '', label: 'All', count: counts.all },
    { key: 'returned', label: 'Returned', count: counts.returned },
    { key: 'in_review', label: 'In Review', count: counts.in_review },
    { key: 'published', label: 'Published', count: counts.published },
    { key: 'draft', label: 'Draft', count: counts.draft },
  ]

  return (
    <div className="px-8 py-8 max-w-5xl">
      <h1 className="text-xl font-semibold text-text-primary mb-1">My Submissions</h1>
      <p className="text-sm text-text-secondary mb-6">
        All result batches you have submitted — track their progress through the approval workflow.
      </p>

      {/* ── Status tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-border -mx-1 px-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = (filterStatus ?? '') === tab.key
          return (
            <Link
              key={tab.key}
              href={`/dashboard/my-submissions${tab.key ? `?status=${tab.key}` : ''}`}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                  isActive ? 'bg-primary/15 text-primary' : 'bg-surface-muted text-text-muted'
                }`}
              >
                {tab.count}
              </span>
            </Link>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error.message}
        </p>
      )}

      {/* ── Returned items alert ── */}
      {counts.returned > 0 && !filterStatus && (
        <div className="flex items-start gap-3 bg-danger-bg border border-red-200 rounded-xl px-4 py-3 mb-6">
          <RotateCcw size={16} className="text-danger-text mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-danger-text">
              {counts.returned} batch{counts.returned !== 1 ? 'es' : ''} returned to you for revision
            </p>
            <Link
              href="/dashboard/my-submissions?status=returned"
              className="text-xs text-danger-text underline underline-offset-2"
            >
              View returned batches →
            </Link>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <FileText size={36} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            {filterStatus
              ? `No ${statusConfig[filterStatus as BatchStatus]?.label ?? filterStatus} submissions.`
              : 'You have not submitted any result batches yet.'}
          </p>
          <Link
            href="/dashboard/gradebook"
            className="inline-block mt-4 text-sm text-primary hover:text-primary-hover font-medium"
          >
            Go to Gradebook →
          </Link>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/40">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Class / Subject
                </th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Term
                </th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Current Stage
                </th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Submitted
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const cls = b.classes as { name: string } | null
                const arm = b.arms as { name: string } | null
                const subj = b.subjects as { id: string; name: string } | null
                const term = b.terms as { name: string; is_current: boolean } | null
                const stage = b.workflow_stages as { name: string } | null
                const actions = (
                  b.workflow_actions as {
                    comment: string | null
                    action: string
                    created_at: string
                    profiles: { first_name: string; last_name: string } | null
                  }[]
                ) ?? []

                // Latest reviewer comment (most recent return_to_teacher action)
                const returnAction = [...actions]
                  .sort((a, c) => new Date(c.created_at).getTime() - new Date(a.created_at).getTime())
                  .find((a) => a.action === 'return_to_teacher')

                const assignmentId = subj ? assignmentBySubject.get(subj.id) : undefined

                const submittedDate = b.submitted_at
                  ? new Date(b.submitted_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'

                return (
                  <tr
                    key={b.id}
                    className={`border-b border-border last:border-0 hover:bg-surface-muted/30 transition-colors ${
                      b.status === 'returned' ? 'bg-red-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-text-primary">
                        {subj?.name}
                      </span>
                      <span className="block text-xs text-text-secondary">
                        {cls?.name}
                        {arm?.name ? ` ${arm.name}` : ''}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-text-secondary">
                      {term?.name ?? '—'}
                      {term?.is_current && (
                        <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                          Current
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>

                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {b.status === 'published' ? (
                        <span className="text-success-text font-medium">✓ Approved</span>
                      ) : b.status === 'returned' ? (
                        <span className="text-danger-text font-medium">Returned to you</span>
                      ) : b.status === 'draft' ? (
                        <span className="text-text-muted">Not submitted</span>
                      ) : (
                        stage?.name ?? '—'
                      )}
                    </td>

                    <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                      {submittedDate}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {b.status === 'returned' && assignmentId ? (
                        <Link
                          href={`/dashboard/gradebook/${assignmentId}`}
                          className="inline-flex items-center gap-1 text-xs text-white bg-danger-text/90 hover:bg-danger-text rounded-lg px-2.5 py-1.5 font-medium transition-colors"
                        >
                          Revise <ArrowUpRight size={11} />
                        </Link>
                      ) : b.status === 'draft' && assignmentId ? (
                        <Link
                          href={`/dashboard/gradebook/${assignmentId}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
                        >
                          Open <ArrowUpRight size={11} />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Reviewer comments panel — shown below rows for returned batches */}
          {filtered.some(
            (b) =>
              b.status === 'returned' &&
              (
                b.workflow_actions as {
                  comment: string | null
                  action: string
                  created_at: string
                  profiles: { first_name: string; last_name: string } | null
                }[]
              )?.some((a) => a.action === 'return_to_teacher' && a.comment)
          ) && (
            <div className="border-t border-border px-5 py-4 space-y-3">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Reviewer Feedback
              </h3>
              {filtered
                .filter((b) => b.status === 'returned')
                .map((b) => {
                  const subj = b.subjects as { name: string } | null
                  const cls = b.classes as { name: string } | null
                  const arm = b.arms as { name: string } | null
                  const actions = (
                    b.workflow_actions as {
                      comment: string | null
                      action: string
                      created_at: string
                      profiles: { first_name: string; last_name: string } | null
                    }[]
                  ) ?? []
                  const returnAction = [...actions]
                    .sort(
                      (a, c) =>
                        new Date(c.created_at).getTime() - new Date(a.created_at).getTime()
                    )
                    .find((a) => a.action === 'return_to_teacher' && a.comment)

                  if (!returnAction) return null

                  return (
                    <div
                      key={b.id}
                      className="bg-danger-bg/60 border border-red-200/60 rounded-lg px-4 py-3"
                    >
                      <p className="text-xs font-medium text-text-primary mb-1">
                        {subj?.name} — {cls?.name}
                        {arm?.name ? ` ${arm.name}` : ''}
                      </p>
                      <p className="text-sm text-text-secondary italic">
                        &ldquo;{returnAction.comment}&rdquo;
                      </p>
                      {returnAction.profiles && (
                        <p className="text-xs text-text-muted mt-1">
                          — {returnAction.profiles.first_name} {returnAction.profiles.last_name},{' '}
                          {new Date(returnAction.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
