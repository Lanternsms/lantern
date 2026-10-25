import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, UserPlus, ArrowUpRight } from 'lucide-react'

export async function StaffWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const { count } = await supabase
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', profile.school_id)

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Staff &amp; Faculty</h2>
              <p className="text-xs text-text-secondary mt-0.5">Educators, administrators, and staff</p>
            </div>
          </div>
          <Link
            href="/dashboard/staff"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Directory →
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {(count ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-text-secondary ml-2 font-medium">active personnel</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-muted text-text-secondary border border-border">
              Staff Team
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <Link
              href="/dashboard/staff/new"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-indigo-600" />
                <span className="font-semibold text-text-primary">Add Staff</span>
              </div>
              <ArrowUpRight size={13} className="text-text-muted group-hover:text-primary transition-colors" />
            </Link>
            <Link
              href="/dashboard/staff"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-text-secondary" />
                <span className="font-semibold text-text-primary">All Staff</span>
              </div>
              <ArrowUpRight size={13} className="text-text-muted group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Team Roster</span>
        <Link href="/dashboard/staff" className="font-semibold text-primary hover:underline">
          Manage personnel →
        </Link>
      </div>
    </div>
  )
}