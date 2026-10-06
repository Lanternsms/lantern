import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Settings,
  ArrowRight,
} from 'lucide-react'

export const metadata = {
  title: 'Results Management | Lantern',
  description: 'Manage results, gradebooks, approvals, class summaries, and report card remarks.',
}

export default async function ResultsHubPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)

  const roleNames = (userRoles ?? [])
    .map((ur) => (ur.roles as { name: string } | null)?.name)
    .filter(Boolean)

  const hasPrincipalRole = roleNames.includes('principal')
  const isAdmin = roleNames.includes('admin')

  // Check pending approvals count
  const { data: pendingBatches } = await supabase
    .from('result_batches')
    .select('id')
    .eq('status', 'in_review')

  const pendingApprovalsCount = pendingBatches?.length ?? 0

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary mb-1">Results Management</h1>
        <p className="text-sm text-text-secondary">
          Central hub for grades entry, approvals, report card remarks, and class academic summaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Result Remarks */}
        <Link
          href="/dashboard/results/remarks"
          className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <MessageSquare size={18} />
            </div>
            <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors mb-1">
              Result Remarks Entry
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Enter official Class Teacher and Principal remarks for end-of-term student report cards, with built-in quick presets and student performance insights.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
            <span>Enter Remarks</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Class Result Summary */}
        <Link
          href="/dashboard/class-results"
          className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent-hover flex items-center justify-center mb-3">
              <BarChart3 size={18} />
            </div>
            <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors mb-1">
              Class Results Summary
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Full class performance overview — subject totals, student averages, ranks, and grade distribution charts across any academic term.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
            <span>View Summary</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Gradebook */}
        <Link
          href="/dashboard/gradebook"
          className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <BookOpen size={18} />
            </div>
            <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors mb-1">
              Gradebook
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Record assessment and exam scores for your assigned subjects, save progress drafts, and submit for multi-stage approval.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
            <span>Open Gradebook</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* My Submissions */}
        <Link
          href="/dashboard/my-submissions"
          className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center mb-3">
              <Clock size={18} />
            </div>
            <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors mb-1">
              My Submissions Tracker
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Track the approval progress of your submitted result batches, review feedback comments on returned scores, and re-open drafts.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
            <span>Track Submissions</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Approvals Queue */}
        <Link
          href="/dashboard/approvals"
          className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-success-bg text-success-text flex items-center justify-center">
                <CheckCircle2 size={18} />
              </div>
              {pendingApprovalsCount > 0 && (
                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {pendingApprovalsCount} in review
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors mb-1">
              Approvals Queue
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Review, approve, or return score submissions at your stage of the academic workflow before publication.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
            <span>Go to Approvals</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Results Configuration */}
        {isAdmin && (
          <Link
            href="/dashboard/academics/results-config"
            className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-surface-muted text-text-secondary flex items-center justify-center mb-3">
                <Settings size={18} />
              </div>
              <h2 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors mb-1">
                Results Configuration
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Configure ranking methods, student and parent visibility toggles, and school grading scales.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4">
              <span>Configure Rules</span>
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
