// app/api/attendance/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export async function GET(request: NextRequest) {
  // Authenticate via user session
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
    .select('date, marked_at, students(first_name, last_name, admission_no), attendance_statuses(label), subjects(name), marker:profiles!marked_by(first_name, last_name)')
    .eq('class_id', classId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (armId) query = query.eq('arm_id', armId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lines = [['Date', 'Time', 'Admission No.', 'Student', 'Subject', 'Status', 'Marked By'].join(',')]
  for (const r of data ?? []) {
    const studentName = `${r.students?.first_name ?? ''} ${r.students?.last_name ?? ''}`.trim()
    const markedBy = r.marker ? `${r.marker.first_name} ${r.marker.last_name}` : ''
    const time = r.marked_at ? new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    lines.push(
      [r.date, time, r.students?.admission_no ?? '', studentName, r.subjects?.name ?? 'General', r.attendance_statuses?.label ?? '', markedBy]
        .map((v) => csvEscape(String(v)))
        .join(',')
    )
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance_${from}_to_${to}.csv"`,
    },
  })
}