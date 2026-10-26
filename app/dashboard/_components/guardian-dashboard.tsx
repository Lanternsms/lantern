/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ChildSelect, ChildrenTermSelect } from './child-select'
import TimetableGridView, { TimetableRow } from '../my-timetable/timetable-grid-view'
import { LessonPlayerModal } from '../lms/lesson-player-modal'
import { NotesDownloadButton } from '../lms/notes-download-button'
import GuardianAskButton from './guardian-ask-button';


function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

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
  guardianRow: { id: string; school_id: string; first_name: string; last_name: string; phone: string | null; email: string | null },
  searchParams: { child?: string; student?: string; term?: string; tab?: string; attScope?: string },
}) {
  const supabase = await createClient()
  const admin = createAdminClient();

  const { data: links } = await supabase
    .from('student_guardians')
    .select('students(id, first_name, last_name, admission_no, school_id, photo_url)')
    .eq('guardian_id', guardianRow.id)

  const myChildren = (links ?? [])
    .map((l) => l.students as { id: string; first_name: string; last_name: string; admission_no: string; school_id: string; photo_url: string | null } | null)
    .filter((s): s is NonNullable<typeof s> => s !== null)

  const { child: childParam, student: studentParam, term: termParam, tab: tabParam, attScope: attScopeParam } = searchParams

  // Validate tab against known list; ignore unknown tabs and fall back to default 'all'
  const VALID_TABS = new Set(['all', 'attendance', 'results', 'fees', 'timetable', 'lessons'])
  const normalizedTab = (tabParam || '').toLowerCase()
  const activeTab = VALID_TABS.has(normalizedTab) ? normalizedTab : 'all'
  const attScope = attScopeParam || 'term'

  // Validate that student belongs to the signed-in guardian; never trust param for authorization
  const requestedStudentId = studentParam || childParam
  const selectedChild = myChildren.find((c) => c.id === requestedStudentId) ?? myChildren[0]

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

  // LMS period attendance (separate — does NOT feed daily counters or rate)
  let lmsPeriodAttendance: any[] = []
  if (selectedChild) {
    const { data: lmsPeriodData } = await (admin as any)
      .from('lms_period_attendance')
      .select('id, date, status_id, attendance_statuses(label, code, counts_as_present), subjects(name), lms_lessons(title)')
      .eq('student_id', selectedChild.id)
      .eq('school_id', selectedChild.school_id)
      .order('date', { ascending: false })
      .limit(20)
    lmsPeriodAttendance = lmsPeriodData ?? []
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
        .select('day_of_week, period_id, delivery_mode, subjects(name), teacher:profiles(first_name, last_name)')
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
        delivery_mode: e.delivery_mode ?? null,
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

    const paymentsByStructure = new Map<string, number>()
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

  // Lessons count & list (fetched inside component before buildUrl)
  let lessonCount = 0
  let lessonsBySubject: { subjectName: string; lessons: any[] }[] = []
  const activityCountByLesson = new Map<string, number>()
  const lessonHasBrief = new Map<string, boolean>()

  if (selectedChild && enrolment?.class_id) {
    const { count } = await (admin as any)
      .from('lms_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', enrolment.class_id)
      .eq('status', 'published')
      .not('video_path', 'is', null)

    lessonCount = count ?? 0

    if (activeTab === 'lessons') {
      const { data: rawLessons } = await (admin as any)
        .from('lms_lessons')
        .select(`
          id, title, topic, week_no, duration_seconds, created_at,
          notes_name, notes_size_bytes, notes_downloadable,
          subjects:subject_id ( name )
        `)
        .eq('class_id', enrolment.class_id)
        .eq('status', 'published')
        .not('video_path', 'is', null)
        .order('week_no', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      const groups = new Map<string, any[]>()
      for (const l of rawLessons ?? []) {
        const subName = (l.subjects as any)?.name ?? 'General'
        if (!groups.has(subName)) groups.set(subName, [])
        groups.get(subName)!.push(l)
      }

      const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))
      lessonsBySubject = sortedKeys.map((k) => ({
        subjectName: k,
        lessons: groups.get(k)!,
      }))

      const lessonIds = (rawLessons ?? []).map((l: any) => l.id)
      if (lessonIds.length > 0) {
        const { data: actRows } = await (admin as any)
          .from('lms_activities')
          .select('lesson_id, attachment_path')
          .in('lesson_id', lessonIds)
          .eq('status', 'published')

        for (const a of (actRows ?? [])) {
          activityCountByLesson.set(a.lesson_id, (activityCountByLesson.get(a.lesson_id) ?? 0) + 1)
          if (a.attachment_path) {
            lessonHasBrief.set(a.lesson_id, true)
          }
        }
      }
    }
  }

  function buildUrl(next: { tab?: string; attScope?: string }) {
    const p = new URLSearchParams()
    if (selectedChild) {
      p.set('student', selectedChild.id)
      p.set('child', selectedChild.id)
    }
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
          No children are linked to your account yet. Contact your school administrator to link your child&apos;s profile.
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
            <div className="flex items-center gap-3.5">
              {selectedChild?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedChild.photo_url}
                  alt={`${selectedChild.first_name} ${selectedChild.last_name}`}
                  className="w-14 h-14 rounded-full object-cover border-2 border-border shadow-xs shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-lg shrink-0">
                  {selectedChild?.first_name?.[0]}{selectedChild?.last_name?.[0]}
                </div>
              )}
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
            {/* eslint-disable-next-line react/no-children-prop */}
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
          {(lessonCount > 0 || activeTab === 'lessons') && (
            <Link
              href={buildUrl({ tab: 'lessons' })}
              className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'lessons' ? 'border-primary text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Lessons {lessonCount > 0 && `(${lessonCount})`}
            </Link>
          )}
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
              <div className="text-xs text-text-secondary font-medium">Today&apos;s Classes</div>
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

          {/* Recorded-lesson attendance (separate from daily; does NOT affect rate/counters) */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4 mt-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                Recorded-lesson attendance
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">Attendance marked during LMS recorded-lesson periods (most recent 20)</p>
            </div>

            {lmsPeriodAttendance.length === 0 ? (
              <div className="text-center py-8 text-sm text-text-secondary border border-dashed border-border rounded-xl">
                <p className="font-medium text-text-primary">No recorded-lesson attendance yet.</p>
                <p className="text-xs text-text-secondary mt-1">Attendance for recorded (LMS) periods will appear here once marked by a teacher.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted/40 text-text-secondary text-xs border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Date</th>
                      <th className="text-left px-4 py-2.5 font-medium">Subject</th>
                      <th className="text-left px-4 py-2.5 font-medium">Lesson</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lmsPeriodAttendance.map((row: any) => {
                      const statusObj = Array.isArray(row.attendance_statuses) ? row.attendance_statuses[0] : row.attendance_statuses
                      const statusLabel = statusObj?.label ?? 'Marked'
                      const lessonObj = Array.isArray(row.lms_lessons) ? row.lms_lessons[0] : row.lms_lessons
                      const lessonTitle = lessonObj?.title ?? null
                      const subjectObj = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects
                      const subjectName = subjectObj?.name ?? null
                      return (
                        <tr key={row.id} className="hover:bg-surface-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                            {new Date(row.date + 'T00:00:00').toLocaleDateString(undefined, {
                              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {subjectName ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                {subjectName}
                              </span>
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-secondary text-xs max-w-xs truncate">
                            {lessonTitle ?? <span className="text-text-muted">—</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getAttendanceStatusBadge(statusLabel)}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
              No fee structure has been set up for {selectedChild?.first_name}&apos;s class this session yet.
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

      {/* LESSONS */}
      {activeTab === 'lessons' && (
        <div className="space-y-6">
          {lessonsBySubject.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-text-secondary">
              No lessons have been published for {selectedChild?.first_name}&apos;s class yet.
            </div>
          ) : (
            lessonsBySubject.map((group) => (
              <div key={group.subjectName} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-muted">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    {group.subjectName}
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {group.lessons.map((lesson: any) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {lesson.week_no != null && (
                            <span className="text-xs font-medium text-text-muted px-1.5 py-0.5 rounded bg-surface-muted border border-border">
                              Wk {lesson.week_no}
                            </span>
                          )}
                          <p className="text-sm font-medium text-text-primary truncate">{lesson.title}</p>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 truncate">
                          {lesson.topic ? `${lesson.topic} · ` : ''}
                          {formatDuration(lesson.duration_seconds)}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                        <Link
                          href={`/dashboard/lms/learn/${lesson.id}?student=${selectedChild.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors min-h-[44px]"
                        >
                          Activities
                          {(activityCountByLesson.get(lesson.id) ?? 0) > 0 && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">
                              {activityCountByLesson.get(lesson.id)}
                            </span>
                          )}
                          {lessonHasBrief.get(lesson.id) && (
                            <span className="flex items-center text-red-500" title="Has assignment PDF document">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </Link>
                        <LessonPlayerModal
                          lessonId={lesson.id}
                          title={lesson.title}
                          studentId={selectedChild.id}
                          notesName={lesson.notes_name}
                          notesSizeBytes={lesson.notes_size_bytes}
                          notesDownloadable={lesson.notes_downloadable}
                          label="Watch"
                        />
                        {lesson.notes_name && lesson.notes_downloadable && (
                          <NotesDownloadButton
                            lessonId={lesson.id}
                            notesSizeBytes={lesson.notes_size_bytes}
                            studentId={selectedChild.id}
                          />
                        )}
                        <GuardianAskButton lessonId={lesson.id} title={lesson.title} studentId={selectedChild.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
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