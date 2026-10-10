import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SetupChecklist } from './setup-checklist'

function formatNaira(amount: number) {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(1)}K`
  return `₦${amount.toLocaleString()}`
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const ACTION_LABELS: Record<string, (metadata: Record<string, unknown>) => string> = {
  branding_updated: () => 'Branding and theme were updated',
  logo_removed: () => 'School logo was removed',
}

function describeActivity(action: string, metadata: Record<string, unknown>) {
  const known = ACTION_LABELS[action]
  if (known) return known(metadata)
  // Fallback for action names this dashboard doesn't have a tailored
  // sentence for yet — e.g. whatever you named results/fees/attendance/staff
  // audit entries when you wired those modules up.
  return action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, first_name')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const schoolId = profile.school_id

  const [{ data: currentSession }, { data: sessions }] = await Promise.all([
    supabase.from('academic_sessions').select('id, name, start_date').eq('school_id', schoolId).eq('is_current', true).maybeSingle(),
    supabase.from('academic_sessions').select('id, name, start_date').eq('school_id', schoolId).order('start_date', { ascending: false }).limit(2),
  ])

  if (!currentSession) {
    return (
      <div className="border border-border rounded-xl p-6 text-sm text-text-secondary">
        No current academic session is set up yet. Set one up under Academics before the dashboard can show school-wide data.
      </div>
    )
  }

  const previousSession = (sessions ?? []).find((s) => s.id !== currentSession.id) ?? null

  const { data: currentTerm } = await supabase
    .from('terms')
    .select('id, name, start_date, end_date')
    .eq('school_id', schoolId)
    .eq('session_id', currentSession.id)
    .eq('is_current', true)
    .maybeSingle()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ---- KPIs ----
  const [
    { count: totalStudents },
    { count: previousStudents },
    { data: staffRows },
    { data: classesRows },
  ] = await Promise.all([
    supabase.from('enrolments').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('session_id', currentSession.id),
    previousSession
      ? supabase.from('enrolments').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('session_id', previousSession.id)
      : Promise.resolve({ count: null as number | null }),
    supabase.from('staff').select('id, employment_date').eq('school_id', schoolId),
    supabase.from('classes').select('id, name, level').eq('school_id', schoolId).order('level'),
  ])

  const totalStaff = staffRows?.length ?? 0
  const newStaffThisSession = currentSession.start_date
    ? (staffRows ?? []).filter((s) => s.employment_date && s.employment_date >= currentSession.start_date).length
    : 0

  const { data: armsRows } = await supabase
    .from('arms')
    .select('id, class_id')
    .in('class_id', (classesRows ?? []).map((c) => c.id))

  const activeClassesCount = armsRows?.length ?? 0
  const classLabelRange =
    classesRows && classesRows.length > 0
      ? `Across ${classesRows[0].name} - ${classesRows[classesRows.length - 1].name}`
      : 'No classes set up yet'

  const studentTrend =
    previousStudents && previousStudents > 0 && totalStudents != null
      ? (((totalStudents - previousStudents) / previousStudents) * 100).toFixed(1)
      : null

  // ---- Student Overview: enrolment by class + gender ----
  const { data: enrolmentRows } = await supabase
    .from('enrolments')
    .select('class_id, students(gender)')
    .eq('school_id', schoolId)
    .eq('session_id', currentSession.id)

  const byClass = new Map<string, { male: number; female: number }>()
  for (const row of enrolmentRows ?? []) {
    const gender = (row as unknown as { students: { gender: string | null } | null }).students?.gender?.toLowerCase()
    const bucket = byClass.get(row.class_id) ?? { male: 0, female: 0 }
    if (gender === 'male') bucket.male += 1
    else if (gender === 'female') bucket.female += 1
    byClass.set(row.class_id, bucket)
  }
  const studentOverview = (classesRows ?? []).map((c) => ({
    name: c.name,
    male: byClass.get(c.id)?.male ?? 0,
    female: byClass.get(c.id)?.female ?? 0,
  }))
  const studentOverviewTotal = studentOverview.reduce((sum, c) => sum + c.male + c.female, 0)
  const studentOverviewMax = Math.max(...studentOverview.map((c) => c.male + c.female), 1)

  // ---- Attendance Overview (current term to date) ----
  const { data: statuses } = await supabase
    .from('attendance_statuses')
    .select('id, code, counts_as_present')
    .eq('school_id', schoolId)
  const statusById = new Map((statuses ?? []).map((s) => [s.id, s]))

  const termStart = currentTerm?.start_date ?? currentSession.start_date
  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('date, status_id')
    .eq('school_id', schoolId)
    .gte('date', termStart)

  let present = 0, absent = 0, late = 0, countsPresent = 0
  const byDay = new Map<string, { present: number; total: number }>()
  for (const row of attendanceRows ?? []) {
    const status = statusById.get(row.status_id)
    if (!status) continue
    if (status.code === 'present') present += 1
    else if (status.code === 'absent') absent += 1
    else if (status.code === 'late') late += 1
    if (status.counts_as_present) countsPresent += 1

    const day = byDay.get(row.date) ?? { present: 0, total: 0 }
    day.total += 1
    if (status.counts_as_present) day.present += 1
    byDay.set(row.date, day)
  }
  const attendanceTotal = attendanceRows?.length ?? 0
  const attendancePct = (n: number) => (attendanceTotal > 0 ? (n / attendanceTotal) * 100 : 0)

  const recentDays = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, d]) => ({ date, rate: d.total > 0 ? (d.present / d.total) * 100 : 0 }))

  // ---- Fees Overview (current term) ----
  const { data: feeStructures } = currentTerm
    ? await supabase
        .from('fee_structures')
        .select('id, class_id, amount')
        .eq('school_id', schoolId)
        .eq('session_id', currentSession.id)
        .eq('term_id', currentTerm.id)
    : { data: [] as { id: string; class_id: string | null; amount: number }[] }

  const enrolmentCountByClass = new Map<string, number>()
  for (const row of enrolmentRows ?? []) {
    enrolmentCountByClass.set(row.class_id, (enrolmentCountByClass.get(row.class_id) ?? 0) + 1)
  }
  const totalEnrolled = enrolmentRows?.length ?? 0

  let expectedFees = 0
  for (const fs of feeStructures ?? []) {
    const qualifying = fs.class_id ? (enrolmentCountByClass.get(fs.class_id) ?? 0) : totalEnrolled
    expectedFees += Number(fs.amount) * qualifying
  }

  const feeStructureIds = (feeStructures ?? []).map((fs) => fs.id)
  const { data: paymentRows } =
    feeStructureIds.length > 0
      ? await supabase.from('payments').select('amount_paid').eq('school_id', schoolId).in('fee_structure_id', feeStructureIds)
      : { data: [] as { amount_paid: number }[] }
  const collectedFees = (paymentRows ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const outstandingFees = Math.max(expectedFees - collectedFees, 0)
  const collectionRate = expectedFees > 0 ? (collectedFees / expectedFees) * 100 : 0

  // ---- Academic Snapshot (current term, by class + arm) ----
  const { data: armsWithNames } = await supabase
    .from('arms')
    .select('id, name, class_id, classes(name)')
    .eq('school_id', schoolId)

  const { data: resultBatches } = currentTerm
    ? await supabase.from('result_batches').select('class_id, arm_id, status').eq('school_id', schoolId).eq('term_id', currentTerm.id)
    : { data: [] as { class_id: string; arm_id: string; status: string }[] }

  const batchesByArm = new Map<string, string[]>()
  for (const rb of resultBatches ?? []) {
    const list = batchesByArm.get(rb.arm_id) ?? []
    list.push(rb.status)
    batchesByArm.set(rb.arm_id, list)
  }

  const academicSnapshot = (armsWithNames ?? [])
    .map((arm) => {
      const statusesForArm = batchesByArm.get(arm.id) ?? []
      const className = (arm as unknown as { classes: { name: string } | null }).classes?.name ?? ''
      const label = `${className} ${arm.name}`.trim()
      let status: 'published' | 'pending' | 'not_started'
      if (statusesForArm.length === 0) status = 'not_started'
      else if (statusesForArm.every((s) => s === 'published')) status = 'published'
      else status = 'pending'
      return { label, status, classId: arm.class_id }
    })
    .filter((row) => row.status !== 'not_started')
    .slice(0, 6)

  const classesWithPendingResults = new Set(
    academicSnapshot.filter((r) => r.status === 'pending').map((r) => r.classId)
  ).size

  // ---- Recent Activity (reuses the school_audit_log you already have) ----
  const { data: activityRows } = await supabase
    .from('school_audit_log')
    .select('id, action, actor_name, metadata, created_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(6)

  // ---- Incomplete student records ----
  const { count: incompleteStudents } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .or('date_of_birth.is.null,residential_address.is.null,gender.is.null')

  return (
    <div className="space-y-6 px-8 py-7">
      <SetupChecklist />

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{greeting}, {profile.first_name}</h1>
          <p className="text-sm text-text-secondary mt-0.5">Here&apos;s what&apos;s happening across your school.</p>
        </div>
        <span className="text-xs font-medium text-text-secondary border border-border rounded-full px-3 py-1.5">
          {currentSession.name} · {currentTerm?.name ?? 'No current term'}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/students" className="border border-border rounded-xl p-4 bg-surface hover:border-text-secondary transition-colors">
          <p className="text-xs text-text-secondary uppercase tracking-wide">Total Students</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{(totalStudents ?? 0).toLocaleString()}</p>
          {studentTrend && (
            <p className={`text-xs mt-1 ${Number(studentTrend) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {Number(studentTrend) >= 0 ? '+' : ''}{studentTrend}% from last session
            </p>
          )}
        </Link>

        <Link href="/dashboard/staff" className="border border-border rounded-xl p-4 bg-surface hover:border-text-secondary transition-colors">
          <p className="text-xs text-text-secondary uppercase tracking-wide">Total Staff</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{totalStaff.toLocaleString()}</p>
          {newStaffThisSession > 0 && (
            <p className="text-xs mt-1 text-emerald-600">+{newStaffThisSession} new this session</p>
          )}
        </Link>

        <Link href="/dashboard/academics" className="border border-border rounded-xl p-4 bg-surface hover:border-text-secondary transition-colors">
          <p className="text-xs text-text-secondary uppercase tracking-wide">Active Classes</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{activeClassesCount}</p>
          <p className="text-xs mt-1 text-text-secondary">{classLabelRange}</p>
        </Link>

        <div className="border border-border rounded-xl p-4 bg-surface">
          <p className="text-xs text-text-secondary uppercase tracking-wide">Current Term</p>
          <p className="text-lg font-semibold text-text-primary mt-1">{currentTerm?.name ?? '—'}</p>
          <p className="text-xs mt-1 text-text-secondary">{currentSession.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/students" className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-3 py-1.5 rounded-lg transition-colors">
          + Add Student
        </Link>
        <Link href="/dashboard/staff" className="inline-flex items-center text-sm font-medium text-text-primary border border-border hover:border-text-secondary px-3 py-1.5 rounded-lg transition-colors">
          + Add Staff
        </Link>
        <Link href="/dashboard/attendance" className="inline-flex items-center text-sm font-medium text-text-primary border border-border hover:border-text-secondary px-3 py-1.5 rounded-lg transition-colors">
          ✓ Record Attendance
        </Link>
        <Link href="/dashboard/results" className="inline-flex items-center text-sm font-medium text-text-primary border border-border hover:border-text-secondary px-3 py-1.5 rounded-lg transition-colors">
          ✎ Enter Results
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-text-primary">Student Overview</h2>
            <span className="text-xs text-text-secondary">{studentOverviewTotal} total</span>
          </div>
          <p className="text-xs text-text-secondary mb-4">Student population across classes</p>
          <div className="flex items-end gap-3 h-32">
            {studentOverview.map((c) => {
              const total = c.male + c.female
              return (
                <div key={c.name} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="w-full flex flex-col justify-end flex-1">
                    <div
                      className="w-full bg-primary rounded-t-sm"
                      style={{ height: `${(total / studentOverviewMax) * 100}%` }}
                      title={`${c.name}: ${total} (M ${c.male} / F ${c.female})`}
                    />
                  </div>
                  <span className="text-[10px] text-text-secondary">{c.name}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Male</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Female</span>
          </div>
        </div>

        <div className="border border-border rounded-xl p-5 bg-surface">
          <h2 className="text-sm font-semibold text-text-primary mb-1">Attendance Overview</h2>
          <p className="text-xs text-text-secondary mb-4">Summary for the current term</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div>
              <p className="text-base font-semibold text-emerald-600">{attendancePct(present).toFixed(1)}%</p>
              <p className="text-[10px] text-text-secondary">Present</p>
            </div>
            <div>
              <p className="text-base font-semibold text-red-600">{attendancePct(absent).toFixed(1)}%</p>
              <p className="text-[10px] text-text-secondary">Absent</p>
            </div>
            <div>
              <p className="text-base font-semibold text-amber-600">{attendancePct(late).toFixed(1)}%</p>
              <p className="text-[10px] text-text-secondary">Late</p>
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary">{attendancePct(countsPresent).toFixed(1)}%</p>
              <p className="text-[10px] text-text-secondary">Overall</p>
            </div>
          </div>
          <div className="flex items-end gap-2 h-16">
            {recentDays.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full">
                <div className="w-full flex flex-col justify-end flex-1">
                  <div className="w-full bg-accent rounded-t-sm" style={{ height: `${d.rate}%` }} title={`${d.date}: ${d.rate.toFixed(1)}%`} />
                </div>
                <span className="text-[9px] text-text-secondary">
                  {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
              </div>
            ))}
            {recentDays.length === 0 && <p className="text-xs text-text-secondary">No attendance recorded yet.</p>}
          </div>
        </div>

        <div className="border border-border rounded-xl p-5 bg-surface">
          <h2 className="text-sm font-semibold text-text-primary mb-1">Fees Overview</h2>
          <p className="text-xs text-text-secondary mb-4">Current term fee collection summary</p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-text-secondary">Expected</p>
              <p className="text-lg font-semibold text-text-primary">{formatNaira(expectedFees)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Collected</p>
              <p className="text-lg font-semibold text-emerald-600">{formatNaira(collectedFees)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Outstanding</p>
              <p className="text-lg font-semibold text-red-600">{formatNaira(outstandingFees)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Collection Rate</p>
              <p className="text-lg font-semibold text-text-primary">{collectionRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${Math.min(collectionRate, 100)}%` }} />
          </div>
        </div>

        <div className="border border-border rounded-xl p-5 bg-surface">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-text-primary">Academic Snapshot</h2>
            <Link href="/dashboard/results" className="text-xs font-medium text-primary hover:underline">View Results</Link>
          </div>
          <p className="text-xs text-text-secondary mb-4">Results status across classes</p>
          <div className="space-y-2">
            {academicSnapshot.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-text-primary">{row.label}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    row.status === 'published'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {row.status === 'published' ? 'Results Published' : 'Results Pending'}
                </span>
              </div>
            ))}
            {academicSnapshot.length === 0 && (
              <p className="text-xs text-text-secondary">No result batches started for this term yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-5 bg-surface">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Recent Activity</h2>
          <div className="space-y-3">
            {(activityRows ?? []).map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3">
                <p className="text-sm text-text-primary">{describeActivity(row.action, row.metadata as Record<string, unknown>)}</p>
                <span className="text-xs text-text-secondary whitespace-nowrap">{timeAgo(row.created_at)}</span>
              </div>
            ))}
            {(activityRows ?? []).length === 0 && (
              <p className="text-xs text-text-secondary">No activity logged yet.</p>
            )}
          </div>
        </div>

        <div className="border border-border rounded-xl p-5 bg-surface">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Needs Attention</h2>
          <div className="space-y-3">
            {classesWithPendingResults > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium">Results pending</p>
                <p className="text-xs text-amber-700 mb-1">{classesWithPendingResults} class{classesWithPendingResults === 1 ? '' : 'es'} have pending results.</p>
                <Link href="/dashboard/results" className="text-xs font-medium text-amber-800 hover:underline">View Results →</Link>
              </div>
            )}
            {outstandingFees > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium">Outstanding fees</p>
                <p className="text-xs text-red-700 mb-1">{formatNaira(outstandingFees)} remains outstanding for the current term.</p>
                <Link href="/dashboard/fees/structures" className="text-xs font-medium text-red-800 hover:underline">View Fees →</Link>
              </div>
            )}
            {(incompleteStudents ?? 0) > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 font-medium">Incomplete student records</p>
                <p className="text-xs text-blue-700 mb-1">{incompleteStudents} student profile{incompleteStudents === 1 ? '' : 's'} require additional information.</p>
                <Link href="/dashboard/students" className="text-xs font-medium text-blue-800 hover:underline">View Students →</Link>
              </div>
            )}
            {classesWithPendingResults === 0 && outstandingFees <= 0 && (incompleteStudents ?? 0) === 0 && (
              <p className="text-xs text-text-secondary">Nothing needs your attention right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}