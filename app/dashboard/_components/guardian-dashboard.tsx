import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ChildSelect, ChildrenTermSelect } from './child-select'
import TimetableGridView, { TimetableRow } from '../my-timetable/timetable-grid-view'

function getAttendanceStatusBadge(label: string) {
  const l = (label || '').toLowerCase()
  if (l.includes('present')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (l.includes('absent')) return 'bg-red-50 text-red-700 border-red-200'
  if (l.includes('late')) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function GuardianDashboard({
  guardianRow,
  searchParams,
}: {
  guardianRow: { id: string; school_id: string; first_name: string; last_name: string; phone: string | null; email: string | null }
  searchParams: { child?: string; term?: string; tab?: string; attScope?: string }
}) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: links } = await supabase
    .from('student_guardians')
    .select('students(id, first_name, last_name, admission_no, school_id)')
    .eq('guardian_id', guardianRow.id)

  const myChildren = (links ?? [])
    .map((l) => l.students as { id: string; first_name: string; last_name: string; admission_no: string; school_id: string } | null)
    .filter((s): s is NonNullable<typeof s> => s !== null)

  const { child: childParam, term: termParam, tab: tabParam, attScope: attScopeParam } = searchParams
  const activeTab = tabParam || 'all'
  const attScope = attScopeParam || 'term'

  const selectedChild = myChildren.find((c) => c.id === childParam) ?? myChildren[0]

  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, is_current, start_date, end_date, academic_sessions(name)')
    .order('start_date', { ascending: false })

  const selectedTermId = termParam || terms?.find((t) => t.is_current)?.id || terms?.[0]?.id
  const currentTerm = terms?.find((t) => t.id === selectedTermId)

  let subjectRows: { subject: string; scores: { label: string; score: number }[]; total: number; grade: { grade: string; remark: string | null } | null }[] = []
  let remark: { class_teacher_remark: string | null; principal_remark: string | null } | null = null
  let rank: { rank: number; out_of: number; metric?: number } | null = null

  if (selectedChild && selectedTermId) {
    const { data: results } = await admin
      .from('results')
      .select('score, subjects(name), assessment_types(name, weight), result_batches!inner(status)')
      .eq('student_id', selectedChild.id)
      .eq('term_id', selectedTermId)
      .eq('result_batches.status', 'published')

    const { data: remarkData } = await admin
      .from('result_remarks')
      .select('class_teacher_remark, principal_remark')
      .eq('student_id', selectedChild.id)
      .eq('term_id', selectedTermId)
      .maybeSingle()
    remark = remarkData ?? null

    const { data: rankData } = await supabase.rpc('get_my_rank', {
      p_term_id: selectedTermId,
      p_student_id: selectedChild.id,
    })
    rank = (rankData?.[0] as any) ?? null

    const { data: scale } = await admin
      .from('grading_scales')
      .select('grade_bands(min_score, max_score, grade, remark)')
      .eq('school_id', selectedChild.school_id)
      .eq('is_default', true)
      .maybeSingle()

    const bySubject = new Map<string, { scores: { label: string; score: number }[]; total: number }>()
    for (const r of results ?? []) {
      const subjectName = (r.subjects as { name: string } | null)?.name ?? 'Unknown subject'
      const assessmentName = (r.assessment_types as { name: string } | null)?.name ?? ''
      const entry = bySubject.get(subjectName) ?? { scores: [], total: 0 }
      entry.scores.push({ label: assessmentName, score: r.score })
      entry.total += r.score
      bySubject.set(subjectName, entry)
    }

    const bands = (scale?.grade_bands as { min_score: number; max_score: number; grade: string; remark: string | null }[]) ?? []
    subjectRows = Array.from(bySubject.entries()).map(([subject, data]) => ({
      subject,
      ...data,
      grade: bands.find((b) => data.total >= b.min_score && data.total <= b.max_score) ?? null,
    }))
  }

  // Attendance
  let rawAttendance: any[] = []
  if (selectedChild) {
    const { data: attData } = await admin
      .from('attendance')
      .select('id, date, marked_at, status_id, attendance_statuses(label, code, counts_as_present), subjects(name), marker:profiles!marked_by(first_name, last_name)')
      .eq('student_id', selectedChild.id)
      .order('date', { ascending: false })
      .order('marked_at', { ascending: false })
    rawAttendance = attData ?? []
  }

  const termAttendance = currentTerm?.start_date && currentTerm?.end_date
    ? rawAttendance.filter((r) => r.date >= currentTerm.start_date && r.date <= currentTerm.end_date)
    : rawAttendance

  const displayedAttendance = attScope === 'all' ? rawAttendance : termAttendance

  const totalMarked = displayedAttendance.length
  let presentCount = 0
  let lateCount = 0
  let absentCount = 0

  for (const r of displayedAttendance) {
    const code = (r.attendance_statuses?.code || '').toLowerCase()
    const label = (r.attendance_statuses?.label || '').toLowerCase()
    if (code === 'present' || label.includes('present')) presentCount++
    else if (code === 'late' || label.includes('late')) lateCount++
    else if (code === 'absent' || label.includes('absent')) absentCount++
  }

  const attendedCount = displayedAttendance.filter((r) => r.attendance_statuses?.counts_as_present).length
  const attendanceRate = totalMarked > 0 ? Math.round((attendedCount / totalMarked) * 100) : null

  // Current session (needed for timetable + fees)
  let currentSessionId: string | null = null
  let enrolment: { class_id: string; arm_id: string | null } | null = null

  if (selectedChild) {
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', selectedChild.school_id)
      .eq('is_current', true)
      .single()
    currentSessionId = session?.id ?? null

    if (currentSessionId) {
      const { data: enr } = await supabase
        .from('enrolments')
        .select('class_id, arm_id')
        .eq('student_id', selectedChild.id)
        .eq('session_id', currentSessionId)
        .maybeSingle()
      enrolment = enr ?? null
    }
  }

  // Timetable
  let timetablePeriods: { id: string; name: string; start_time: string; end_time: string; is_break: boolean }[] = []
  let timetableRows: TimetableRow[] = []

  if (selectedChild && currentSessionId) {
    const { data: periodsData } = await (supabase as any)
      .from('timetable_periods')
      .select('id, name, start_time, end_time, is_break')
      .order('sort_order')
    timetablePeriods = periodsData ?? []

    if (enrolment?.class_id) {
      let entriesQuery = (supabase as any)
        .from('timetable_entries')
        .select('day_of_week, period_id, subjects(name), teacher:profiles(first_name, last_name)')
        .eq('session_id', currentSessionId)
        .eq('class_id', enrolment.class_id)

      entriesQuery = enrolment.arm_id
        ? entriesQuery.eq('arm_id', enrolment.arm_id)
        : entriesQuery.is('arm_id', null)

      const { data: entries } = await entriesQuery
      timetableRows = (entries ?? []).map((e: any) => ({
        day_of_week: e.day_of_week,
        period_id: e.period_id,
        subject_name: e.subjects?.name ?? '',
        teacher_name: e.teacher ? `${e.teacher.first_name} ${e.teacher.last_name}` : null,
      }))
    }
  }

  // Today's timetable (for the overview card)
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay() // 1=Mon..7=Sun
  const todayRows = timetableRows
    .filter((r) => r.day_of_week === todayDow)
    .map((r) => ({ ...r, period: timetablePeriods.find((p) => p.id === r.period_id) }))
    .filter((r) => r.period)
    .sort((a, b) => (a.period!.start_time > b.period!.start_time ? 1 : -1))

  // Fees
  let feeItems: { id: string; name: string; amount: number; paid: number; balance: number }[] = []
  let totalBilled = 0
  let totalPaid = 0

  if (selectedChild && currentSessionId) {
    let feeQuery = admin
      .from('fee_structures')
      .select('id, name, amount, class_id, term_id')
      .eq('school_id', selectedChild.school_id)
      .eq('session_id', currentSessionId)

    if (enrolment?.class_id) {
      feeQuery = feeQuery.or(`class_id.is.null,class_id.eq.${enrolment.class_id}`)
    } else {
      feeQuery = feeQuery.is('class_id', null)
    }

    const { data: structures } = await feeQuery
    const structureIds = (structures ?? []).map((s) => s.id)

    let paymentsByStructure = new Map<string, number>()
    if (structureIds.length > 0) {
      const { data: payments } = await admin
        .from('payments')
        .select('amount_paid, fee_structure_id')
        .eq('student_id', selectedChild.id)
        .in('fee_structure_id', structureIds)

      for (const p of payments ?? []) {
        const key = p.fee_structure_id as string
        paymentsByStructure.set(key, (paymentsByStructure.get(key) ?? 0) + Number(p.amount_paid))
      }
    }

    feeItems = (structures ?? []).map((s) => {
      const paid = paymentsByStructure.get(s.id) ?? 0
      return { id: s.id, name: s.name, amount: Number(s.amount), paid, balance: Number(s.amount) - paid }
    })

    totalBilled = feeItems.reduce((sum, i) => sum + i.amount, 0)
    totalPaid = feeItems.reduce((sum, i) => sum + i.paid, 0)
  }

  const totalBalance = totalBilled - totalPaid

  // Announcements (RLS already filters by guardian audience)
  const { data: announcementRows } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .order('updated_at', { ascending: false })
    .limit(5)

  function buildUrl(next: { tab?: string; attScope?: string }) {
    const p = new URLSearchParams()
    if (selectedChild) p.set('child', selectedChild.id)
    if (selectedTermId) p.set('term', selectedTermId)
    const t = next.tab ?? activeTab
    if (t && t !== 'all') p.set('tab', t)
    const scope = next.attScope ?? attScope
    if (scope && scope !== 'term') p.set('attScope', scope)
    const str = p.toString()
    return str ? `/dashboard?${str}` : '/dashboard'
  }

  if (myChildren.length === 0) {
    return (
      <div className="px-6 py-6 max-w-5xl space-y-6">
        <h1 className="text-xl font-semibold text-text-primary">Welcome, {guardianRow.first_name}</h1>
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-text-secondary">
          No children are linked to your account yet. Contact your school administrator to link your child's profile.
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Welcome, {guardianRow.first_name}</h1>
      </div>

      {/* Child Profile Header */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-base">
                {selectedChild?.first_name?.[0]}{selectedChild?.last_name?.[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {selectedChild?.first_name} {selectedChild?.last_name}
                </h2>
                <p className="text-xs text-text-secondary font-mono">
                  Admission No: {selectedChild?.admission_no}
                </p>
              </div>
            </div>
            {rank && (
              <p className="text-xs text-text-secondary mt-2 inline-flex items-center gap-1.5 bg-surface-muted px-2.5 py-1 rounded-md">
                <span>Academic Position:</span>
                <span className="font-semibold text-text-primary">{rank.rank}</span>
                <span>of {rank.out_of}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ChildSelect children={myChildren} selectedStudentId={selectedChild?.id ?? ''} />
            {terms && selectedTermId && (
              <ChildrenTermSelect terms={terms} selectedTermId={selectedTermId} />
            )}
            {selectedChild && selectedTermId && (
              <Link
                href={`/dashboard/students/${selectedChild.id}/report-card?term_id=${selectedTermId}`}
                className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors shadow-xs"
              >
                Report Card
              </Link>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-border mt-5 pt-1 overflow-x-auto">
          <Link
            href={buildUrl({ tab: 'all' })}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'all' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Overview
          </Link>
          <Link
            href={buildUrl({ tab: 'attendance' })}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'attendance' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>Attendance</span>
            {attendanceRate !== null && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                attendanceRate >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                attendanceRate >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {attendanceRate}%
              </span>
            )}
          </Link>
          <Link
            href={buildUrl({ tab: 'results' })}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'results' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Results ({subjectRows.length})
          </Link>
          <Link
            href={buildUrl({ tab: 'fees' })}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'fees' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>Fees</span>
            {totalBalance > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                Owing
              </span>
            )}
          </Link>
          <Link
            href={buildUrl({ tab: 'timetable' })}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'timetable' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Timetable
          </Link>
        </div>
      </div>

      {/* OVERVIEW: quick-glance cards + announcements */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href={buildUrl({ tab: 'attendance' })} className="border border-border rounded-xl p-4 bg-surface hover:bg-surface-muted/30 transition-colors">
              <div className="text-xs text-text-secondary font-medium">Attendance Rate</div>
              <div className="text-xl font-bold text-text-primary mt-1">
                {attendanceRate !== null ? `${attendanceRate}%` : '—'}
              </div>
              <div className="text-[11px] text-text-secondary mt-1">{currentTerm?.name ?? 'This term'}</div>
            </Link>

            <Link href={buildUrl({ tab: 'fees' })} className="border border-border rounded-xl p-4 bg-surface hover:bg-surface-muted/30 transition-colors">
              <div className="text-xs text-text-secondary font-medium">Fees Balance</div>
              <div className={`text-xl font-bold mt-1 ${totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(totalBalance)}
              </div>
              <div className="text-[11px] text-text-secondary mt-1">
                {totalBalance > 0 ? 'Outstanding' : 'Fully paid'}
              </div>
            </Link>

            <Link href={buildUrl({ tab: 'timetable' })} className="border border-border rounded-xl p-4 bg-surface hover:bg-surface-muted/30 transition-colors">
              <div className="text-xs text-text-secondary font-medium">Today's Classes</div>
              <div className="text-xl font-bold text-text-primary mt-1">{todayRows.length}</div>
              <div className="text-[11px] text-text-secondary mt-1">
                {todayRows[0]?.subject_name ? `Starts with ${todayRows[0].subject_name}` : 'No classes today'}
              </div>
            </Link>

            <Link href={buildUrl({ tab: 'results' })} className="border border-border rounded-xl p-4 bg-surface hover:bg-surface-muted/30 transition-colors">
              <div className="text-xs text-text-secondary font-medium">Academic Position</div>
              <div className="text-xl font-bold text-text-primary mt-1">
                {rank ? `${rank.rank} / ${rank.out_of}` : '—'}
              </div>
              <div className="text-[11px] text-text-secondary mt-1">{currentTerm?.name ?? 'This term'}</div>
            </Link>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">Latest Announcements</h2>
              <Link href="/dashboard/announcements" className="text-xs text-primary hover:underline font-semibold">
                View all →
              </Link>
            </div>
            {!announcementRows || announcementRows.length === 0 ? (
              <p className="text-sm text-text-secondary">No announcements yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {announcementRows.map((a) => (
                  <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-text-primary">{a.title}</h3>
                      <span className="text-[11px] text-text-secondary whitespace-nowrap">
                        {a.published_at ? new Date(a.published_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1 line-clamp-2">{a.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">My Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-xs text-text-secondary mb-0.5">Phone</span>
                <span className="text-text-primary font-medium">{guardianRow.phone || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-text-secondary mb-0.5">Email</span>
                <span className="text-text-primary font-medium">{guardianRow.email || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Attendance Records
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {attScope === 'all'
                  ? 'Showing all recorded attendance sessions across all terms'
                  : `Showing attendance for ${currentTerm?.name ?? 'current term'}${currentTerm?.start_date ? ` (${currentTerm.start_date} to ${currentTerm.end_date})` : ''}`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-surface-muted p-1 rounded-lg text-xs font-medium border border-border">
              <Link
                href={buildUrl({ attScope: 'term' })}
                className={`px-3 py-1 rounded-md transition-colors ${
                  attScope !== 'all' ? 'bg-surface text-primary shadow-xs font-semibold' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {currentTerm?.name ?? 'This Term'}
              </Link>
              <Link
                href={buildUrl({ attScope: 'all' })}
                className={`px-3 py-1 rounded-md transition-colors ${
                  attScope === 'all' ? 'bg-surface text-primary shadow-xs font-semibold' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All Records ({rawAttendance.length})
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
              <div className="text-xs text-text-secondary font-medium">Attendance Rate</div>
              <div className="text-xl font-bold text-text-primary mt-1 flex items-baseline gap-2">
                {attendanceRate !== null ? `${attendanceRate}%` : '—'}
                {attendanceRate !== null && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    attendanceRate >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    attendanceRate >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {attendanceRate >= 90 ? 'Excellent' : attendanceRate >= 75 ? 'Good' : 'Low'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-secondary mt-1">
                {attendedCount} of {totalMarked} marked present
              </div>
            </div>

            <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
              <div className="text-xs text-text-secondary font-medium">Present</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{presentCount}</div>
              <div className="text-[11px] text-text-secondary mt-1">Sessions attended</div>
            </div>

            <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
              <div className="text-xs text-text-secondary font-medium">Late</div>
              <div className="text-xl font-bold text-amber-600 mt-1">{lateCount}</div>
              <div className="text-[11px] text-text-secondary mt-1">Late arrivals</div>
            </div>

            <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
              <div className="text-xs text-text-secondary font-medium">Absent</div>
              <div className="text-xl font-bold text-red-600 mt-1">{absentCount}</div>
              <div className="text-[11px] text-text-secondary mt-1">Sessions missed</div>
            </div>
          </div>

          {displayedAttendance.length === 0 ? (
            <div className="text-center py-10 text-sm text-text-secondary border border-dashed border-border rounded-xl p-6">
              <p className="font-medium text-text-primary">
                No attendance records found for {selectedChild?.first_name} {attScope === 'all' ? 'yet' : `in ${currentTerm?.name ?? 'this term'}`}.
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Daily attendance marked by subject teachers or form teachers will appear here.
              </p>
              {attScope !== 'all' && rawAttendance.length > 0 && (
                <div className="mt-3">
                  <Link href={buildUrl({ attScope: 'all' })} className="text-xs text-primary hover:underline font-semibold">
                    View all {rawAttendance.length} records across other terms →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/40 text-text-secondary text-xs">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium">Time</th>
                    <th className="text-left px-4 py-2.5 font-medium">Subject</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Marked By</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAttendance.map((row) => {
                    const time = row.marked_at
                      ? new Date(row.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'
                    const markerName = row.marker ? `${row.marker.first_name} ${row.marker.last_name}` : '—'
                    const subjectName = row.subjects?.name ?? 'General'
                    const statusLabel = row.attendance_statuses?.label ?? 'Marked'

                    return (
                      <tr key={row.id} className="border-t border-border hover:bg-surface-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                          {new Date(row.date + 'T00:00:00').toLocaleDateString(undefined, {
                            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-text-secondary font-mono text-xs whitespace-nowrap">{time}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                            row.subjects ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-secondary bg-surface-muted border border-border'
                          }`}>
                            {subjectName}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getAttendanceStatusBadge(statusLabel)}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-xs">{markerName}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Academic Results ({currentTerm?.name ?? 'This Term'})
          </h2>

          {subjectRows.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-text-secondary">
              No published results for {currentTerm?.name ?? 'this term'} yet.
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-text-secondary text-xs">
                  <tr>
                    <th className="text-left px-4 py-2.5">Subject</th>
                    <th className="text-left px-4 py-2.5">Breakdown</th>
                    <th className="text-right px-4 py-2.5">Total</th>
                    <th className="text-right px-4 py-2.5">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((row) => (
                    <tr key={row.subject} className="border-t border-border hover:bg-surface-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-text-primary">{row.subject}</td>
                      <td className="px-4 py-2.5 text-text-secondary text-xs">
                        {row.scores.map((s) => `${s.label}: ${s.score}`).join('  ·  ')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-text-primary">{row.total}</td>
                      <td className="px-4 py-2.5 text-right">
                        {row.grade ? `${row.grade.grade}${row.grade.remark ? ` (${row.grade.remark})` : ''}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {remark && (remark.class_teacher_remark || remark.principal_remark) && (
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
              <h3 className="text-sm font-semibold text-text-primary">Report Card Remarks</h3>
              {remark.class_teacher_remark && (
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">Class Teacher: </span>
                  {remark.class_teacher_remark}
                </p>
              )}
              {remark.principal_remark && (
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">Principal: </span>
                  {remark.principal_remark}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* FEES */}
      {activeTab === 'fees' && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Fees — {currentTerm?.academic_sessions?.name ?? 'Current Session'}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
              <div className="text-xs text-text-secondary font-medium">Total Billed</div>
              <div className="text-xl font-bold text-text-primary mt-1">{formatCurrency(totalBilled)}</div>
            </div>
            <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
              <div className="text-xs text-text-secondary font-medium">Total Paid</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPaid)}</div>
            </div>
            <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
              <div className="text-xs text-text-secondary font-medium">Balance</div>
              <div className={`text-xl font-bold mt-1 ${totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(totalBalance)}
              </div>
            </div>
          </div>

          {feeItems.length === 0 ? (
            <div className="text-center py-10 text-sm text-text-secondary border border-dashed border-border rounded-xl p-6">
              No fee structure has been set up for {selectedChild?.first_name}'s class this session yet.
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/40 text-text-secondary text-xs">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Fee Component</th>
                    <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                    <th className="text-right px-4 py-2.5 font-medium">Paid</th>
                    <th className="text-right px-4 py-2.5 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {feeItems.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-surface-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(item.paid)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${item.balance > 0 ? 'text-red-600' : 'text-text-secondary'}`}>
                        {formatCurrency(item.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <Link href="/dashboard/payments" className="text-xs text-primary hover:underline font-semibold">
              View full payment history →
            </Link>
          </div>
        </div>
      )}

      {/* TIMETABLE */}
      {activeTab === 'timetable' && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-3">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 1118 0z" />
            </svg>
            Class Timetable
          </h2>
          <TimetableGridView periods={timetablePeriods} rows={timetableRows} mode="student" />
        </div>
      )}
    </div>
  )
}