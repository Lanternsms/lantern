import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Attendance Today</h2>
        <Link href="/dashboard/attendance" className="text-xs font-medium text-primary hover:underline">Record</Link>
      </div>
      {rate == null ? (
        <p className="text-sm text-text-secondary">No attendance recorded yet today.</p>
      ) : (
        <>
          <p className="text-2xl font-semibold text-text-primary">{rate.toFixed(1)}%</p>
          <p className="text-xs text-text-secondary">{present} of {total} marked present</p>
        </>
      )}
    </div>
  )
}