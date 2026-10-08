// app/api/attendance/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // Authenticate via the user session (respects RLS for the auth check)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const armId = searchParams.get('armId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!classId || !from || !to) {
    return NextResponse.json({ error: 'classId, from and to are required' }, { status: 400 })
  }

  // Use admin client so the students join isn't blocked by RLS
  const admin = createAdminClient()
  let query = admin
    .from('attendance')
    .select('id, date, marked_at, students(first_name, last_name, admission_no), attendance_statuses(label), subjects(name), marker:profiles!marked_by(first_name, last_name)')
    .eq('class_id', classId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  if (armId) query = query.eq('arm_id', armId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    time: r.marked_at ? new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    admission_no: r.students?.admission_no ?? '',
    student_name: `${r.students?.first_name ?? ''} ${r.students?.last_name ?? ''}`.trim(),
    status_label: r.attendance_statuses?.label ?? '',
    subject_name: r.subjects?.name ?? 'General',
    marked_by_name: r.marker ? `${r.marker.first_name} ${r.marker.last_name}` : null,
  }))

  return NextResponse.json({ rows })
}