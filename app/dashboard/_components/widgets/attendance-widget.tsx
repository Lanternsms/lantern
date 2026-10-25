import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CalendarCheck, ArrowRight, UserCheck, AlertCircle } from 'lucide-react'

export async function AttendanceWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: statuses }, { data: rows }] = await Promise.all([
    supabase.from('attendance_statuses').select('id, code, counts_as_present').eq('school_id', profile.school_id),
    supabase.from('attendance').select('status_id').eq('school_id', profile.school_id).eq('date', today),
  ])

  const statusById = new Map((statuses ?? []).map((s) => [s.id, s]))
  const total = rows?.length ?? 0
  const present = (rows ?? []).filter((r) => statusById.get(r.status_id)?.counts_as_present).length
  const rate = total > 0 ? (present / total) * 100 : null

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60">
              <CalendarCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Attendance Today</h2>
              <p className="text-xs text-text-secondary mt-0.5">School-wide daily attendance rate</p>
            </div>
          </div>
          <Link
            href="/dashboard/attendance"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Mark →
          </Link>
        </div>

        {rate === null ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2 bg-surface-muted/30">
            <p className="text-xs font-medium text-text-secondary">No attendance sessions recorded yet today.</p>
            <Link
              href="/dashboard/attendance"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-1"
            >
              Start Roll Call <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                  {rate.toFixed(1)}%
                </span>
                <span className="text-xs text-text-secondary ml-2 font-medium">marked present</span>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  rate >= 90
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : rate >= 75
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {rate >= 90 ? <UserCheck size={12} /> : <AlertCircle size={12} />}
                {rate >= 90 ? 'High' : rate >= 75 ? 'Moderate' : 'Low'}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-border/60 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/80">
                <span className="text-xs text-text-secondary block mb-0.5">Present Today</span>
                <span className="text-base font-bold text-emerald-600">{present}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/80">
                <span className="text-xs text-text-secondary block mb-0.5">Total Records</span>
                <span className="text-base font-bold text-text-primary">{total}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Daily &amp; Period Tracking</span>
        <Link href="/dashboard/attendance" className="font-semibold text-primary hover:underline">
          View register history →
        </Link>
      </div>
    </div>
  )
}