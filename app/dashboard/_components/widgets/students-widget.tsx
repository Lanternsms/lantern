import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, UserPlus, ArrowUpRight } from 'lucide-react'

export async function StudentsWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const [{ count: totalStudents }, { count: activeEnrolled }] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('status', 'active'),
  ])

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Student Population</h2>
              <p className="text-xs text-text-secondary mt-0.5">Enrolments and student records</p>
            </div>
          </div>
          <Link
            href="/dashboard/students"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Directory →
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {(totalStudents ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-text-secondary ml-2 font-medium">total registered</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {(activeEnrolled ?? 0).toLocaleString()} Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <Link
              href="/dashboard/students/new"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-primary" />
                <span className="font-semibold text-text-primary">New Student</span>
              </div>
              <ArrowUpRight size={13} className="text-text-muted group-hover:text-primary transition-colors" />
            </Link>
            <Link
              href="/dashboard/students/import"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <Users size={14} className="text-blue-600" />
                <span className="font-semibold text-text-primary">Import CSV</span>
              </div>
              <ArrowUpRight size={13} className="text-text-muted group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Roster Management</span>
        <Link href="/dashboard/students" className="font-semibold text-primary hover:underline">
          View full list →
        </Link>
      </div>
    </div>
  )
}