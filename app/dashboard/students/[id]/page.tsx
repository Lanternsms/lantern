import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TabView } from '@/components/tab-view'
import { makePrimaryContact } from '@/app/dashboard/guardians/actions'
import { buildReportCard } from '@/lib/report-card'
import {
  inviteStudentPortalAccess,
  linkStudentProfile,
  revokeStudentPortalAccess,
} from './actions'
import { getLinkableProfiles } from '@/lib/staff'

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string; guardianId?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const { from, guardianId } = resolvedSearchParams
  const supabase = await createClient()

  const { data: student, error } = await supabase
    .from('students')
    .select('id, admission_no, first_name, last_name, date_of_birth, gender, status, profile_id, school_id')
    .eq('id', id)
    .single()

  if (error || !student) notFound()

  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('id, class_id, arm_id, academic_sessions(name, start_date), classes(name), arms(name)')
    .eq('student_id', id)

  const sortedEnrolments = (enrolments ?? []).sort(
    (a, b) =>
      new Date(b.academic_sessions?.start_date ?? 0).getTime() -
      new Date(a.academic_sessions?.start_date ?? 0).getTime()
  )
  const currentEnrolment = sortedEnrolments[0]

  const { data: guardianLinks } = await supabase
    .from('student_guardians')
    .select('is_primary_contact, guardians(id, first_name, last_name, phone, email, relationship)')
    .eq('student_id', id)

  const { data: fieldDefs } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, label')
    .eq('entity_type', 'student')
    .order('sort_order')

  const { data: fieldValues } = await supabase
    .from('custom_field_values')
    .select('definition_id, value')
    .eq('entity_id', id)

  const valueByDefId = new Map((fieldValues ?? []).map((v) => [v.definition_id, v.value]))

  const initials = `${student.first_name[0]}${student.last_name[0]}`
  const isActive = student.status === 'active'

  // Portal Access
  let linkedProfile: { id: string; first_name: string; last_name: string } | null = null
  if (student.profile_id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('id', student.profile_id)
      .single()
    linkedProfile = data
  }
  const linkableProfiles = student.profile_id
    ? []
    : await getLinkableProfiles(supabase, student.school_id)

  const { data: assignableRoles } = student.profile_id
    ? { data: [] }
    : await supabase
        .from('roles')
        .select('id, name')
        .eq('school_id', student.school_id)
        .order('name')

  const portalAccessContent = (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-text-primary mb-3">Portal Access</h3>

      {linkedProfile ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Linked to{' '}
            <span className="text-text-primary font-medium">
              {linkedProfile.first_name} {linkedProfile.last_name}
            </span>
            's login.
          </p>
          <form action={revokeStudentPortalAccess.bind(null, student.id)}>
            <button type="submit" className="text-xs text-red-600 hover:text-red-700">
              Revoke
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <form action={inviteStudentPortalAccess.bind(null, student.id)} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                name="email"
                required
                placeholder="student's email address"
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <select name="roleId" required className="flex-1 rounded-lg border border-border px-3 py-2 text-sm">
                <option value="">Select a role…</option>
                {assignableRoles?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover"
              >
                Invite
              </button>
            </div>
          </form>

          {linkableProfiles.length > 0 && (
            <form action={linkStudentProfile.bind(null, student.id)} className="flex gap-2">
              <select
                name="profileId"
                required
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">Or link an existing login…</option>
                {linkableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-background"
              >
                Link
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )

  const overviewContent = (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Personal Information</h3>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Full Name</p>
            <p className="text-text-primary">{student.first_name} {student.last_name}</p>
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Date of Birth</p>
            <p className="text-text-primary">{student.date_of_birth ?? 'Not provided'}</p>
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Gender</p>
            <p className="text-text-primary capitalize">{student.gender ?? 'Not provided'}</p>
          </div>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">Guardian Information</h3>
          <Link href={`/dashboard/guardians/new?student_id=${id}`} className="text-xs text-primary hover:text-primary-hover">
            + Add guardian
          </Link>
        </div>
        {guardianLinks && guardianLinks.length > 0 ? (
          <div className="space-y-3">
            {guardianLinks.map((link, i) => (
              <div key={i} className="text-sm flex items-center justify-between">
                <div>
                  <p className="text-text-primary">
                    {link.guardians?.first_name} {link.guardians?.last_name}
                    {link.is_primary_contact && (
                      <span className="ml-2 text-xs bg-success-bg text-success-text rounded-full px-2 py-0.5">Primary</span>
                    )}
                  </p>
                  <p className="text-text-secondary text-xs">
                    {link.guardians?.relationship} · {link.guardians?.phone ?? 'No phone'}
                  </p>
                </div>
                {!link.is_primary_contact && (
                  <form action={makePrimaryContact}>
                    <input type="hidden" name="student_id" value={id} />
                    <input type="hidden" name="guardian_id" value={link.guardians?.id} />
                    <button type="submit" className="text-xs text-primary hover:text-primary-hover">
                      Make primary
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No guardian information recorded.</p>
        )}
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Enrolment History</h3>
        {sortedEnrolments.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary text-xs uppercase tracking-wide">
                <th className="pb-2 font-medium">Academic Session</th>
                <th className="pb-2 font-medium">Class</th>
                <th className="pb-2 font-medium">Arm</th>
              </tr>
            </thead>
            <tbody>
              {sortedEnrolments.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-2 text-text-primary">{e.academic_sessions?.name}</td>
                  <td className="py-2 text-text-secondary">{e.classes?.name}</td>
                  <td className="py-2 text-text-secondary">{e.arms?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-secondary">No enrolment history.</p>
        )}
      </section>

      {fieldDefs && fieldDefs.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">Custom Fields</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            {fieldDefs.map((def) => (
              <div key={def.id}>
                <p className="text-text-secondary text-xs mb-0.5">{def.label}</p>
                <p className="text-text-primary">
                  {(valueByDefId.get(def.id) as string) ?? 'Not provided'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {portalAccessContent}
    </div>
  )

  // Results tab — now wired to real published data instead of a placeholder
  let resultsContent: React.ReactNode
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user!.id).single()

  if (!profile) {
    resultsContent = <p className="text-sm text-text-secondary">Unable to load results right now.</p>
  } else {
    const { data: currentTerm } = await supabase
      .from('terms')
      .select('id')
      .eq('school_id', profile.school_id)
      .eq('is_current', true)
      .maybeSingle()

    if (!currentTerm) {
      resultsContent = <p className="text-sm text-text-secondary">No current term is set for your school.</p>
    } else {
      const card = await buildReportCard(supabase, profile.school_id, id, currentTerm.id, false)

      resultsContent = !card || card.subjects.length === 0 ? (
        <p className="text-sm text-text-secondary">No published results for the current term yet.</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-primary">{card.term.name} Summary</h3>
            <Link href={`/dashboard/students/${id}/report-card`} className="text-xs text-primary hover:text-primary-hover">
              View full report card →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-y-3 text-sm">
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Overall Average</p>
              <p className="text-text-primary font-medium">{card.overallAverage}</p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Overall Total</p>
              <p className="text-text-primary font-medium">{card.overallTotal}</p>
            </div>
            {card.rankingEnabled && card.rank && (
              <div>
                <p className="text-text-secondary text-xs mb-0.5">Class Position</p>
                <p className="text-text-primary font-medium">{card.rank} of {card.classSize}</p>
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  // Attendance Tab
  let attendanceContent: React.ReactNode
  const admin = createAdminClient()
  const { data: attendanceRecords } = await admin
    .from('attendance')
    .select('id, date, marked_at, status_id, attendance_statuses(label, code, counts_as_present), subjects(name), marker:profiles!marked_by(first_name, last_name)')
    .eq('student_id', id)
    .order('date', { ascending: false })
    .order('marked_at', { ascending: false })

  const attRecords = attendanceRecords ?? []
  const totalSessions = attRecords.length
  const presentCount = attRecords.filter((r) => r.attendance_statuses?.counts_as_present).length
  const lateCount = attRecords.filter((r) => {
    const c = (r.attendance_statuses?.code || '').toLowerCase()
    const l = (r.attendance_statuses?.label || '').toLowerCase()
    return c === 'late' || l.includes('late')
  }).length
  const absentCount = attRecords.filter((r) => {
    const c = (r.attendance_statuses?.code || '').toLowerCase()
    const l = (r.attendance_statuses?.label || '').toLowerCase()
    return c === 'absent' || l.includes('absent')
  }).length
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null

  function getAttendanceStatusBadge(label: string) {
    const l = (label || '').toLowerCase()
    if (l.includes('present')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (l.includes('absent')) return 'bg-red-50 text-red-700 border-red-200'
    if (l.includes('late')) return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }

  attendanceContent = (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Attendance Summary
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Historical record of attendance sessions for this student.
            </p>
          </div>
          {currentEnrolment?.class_id && (
            <Link
              href={`/dashboard/attendance?classId=${currentEnrolment.class_id}${currentEnrolment.arm_id ? `&armId=${currentEnrolment.arm_id}` : ''}`}
              className="text-xs bg-primary text-white hover:bg-primary-hover px-3 py-1.5 rounded-lg transition-colors font-medium shadow-xs"
            >
              Mark Class Attendance →
            </Link>
          )}
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
              {presentCount} of {totalSessions} present
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

        {attRecords.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-secondary border border-dashed border-border rounded-xl">
            No attendance records recorded for this student yet.
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
                {attRecords.map((row) => {
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
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-mono text-xs whitespace-nowrap">
                        {time}
                      </td>
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
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-xs">
                        {markerName}
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
  )

  // Fees Tab
  let feesContent: React.ReactNode
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id, name')
    .eq('is_current', true)
    .maybeSingle()

  const { data: currentTerm } = await supabase
    .from('terms')
    .select('id, name')
    .eq('is_current', true)
    .maybeSingle()

  let applicableFees: any[] = []
  if (currentSession) {
    let feeQuery = supabase
      .from('fee_structures')
      .select('id, name, amount, session_id, term_id, class_id, terms(name), classes(name)')
      .eq('session_id', currentSession.id)

    if (currentEnrolment?.class_id) {
      feeQuery = feeQuery.or(`class_id.is.null,class_id.eq.${currentEnrolment.class_id}`)
    } else {
      feeQuery = feeQuery.is('class_id', null)
    }

    const { data: feesData } = await feeQuery
    applicableFees = feesData ?? []
  }

  const currentTermFees = applicableFees.filter((f) => !f.term_id || f.term_id === currentTerm?.id)

  const { data: studentPayments } = await supabase
    .from('payments')
    .select('id, amount_paid, payment_method, reference, paid_at, fee_structure_id, fee_structures(name, amount)')
    .eq('student_id', id)
    .order('paid_at', { ascending: false })

  const paymentsList = studentPayments ?? []
  const paidFeeSet = new Set(paymentsList.map((p) => p.fee_structure_id))

  const totalTermDue = currentTermFees.reduce((acc, f) => acc + Number(f.amount || 0), 0)
  const totalPaidAllTime = paymentsList.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0)
  const termPaidAmount = currentTermFees
    .filter((f) => paidFeeSet.has(f.id))
    .reduce((acc, f) => acc + Number(f.amount || 0), 0)
  const outstandingBalance = Math.max(0, totalTermDue - termPaidAmount)

  const METHOD_LABELS: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    pos: 'POS',
    online: 'Online',
  }

  feesContent = (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Fee Structure & Payment Status
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Current Session: {currentSession?.name ?? '—'} · Current Term: {currentTerm?.name ?? '—'}
            </p>
          </div>
          <Link
            href={`/dashboard/fees/record?studentId=${id}`}
            className="text-xs bg-primary text-white hover:bg-primary-hover px-3 py-1.5 rounded-lg transition-colors font-medium shadow-xs"
          >
            + Record Payment
          </Link>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
            <div className="text-xs text-text-secondary font-medium">Term Fee Total</div>
            <div className="text-xl font-bold text-text-primary mt-1">
              ₦{totalTermDue.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-secondary mt-1">
              {currentTermFees.length} component(s) applicable
            </div>
          </div>

          <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
            <div className="text-xs text-text-secondary font-medium">Amount Paid (This Term)</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              ₦{termPaidAmount.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-secondary mt-1">
              ₦{totalPaidAllTime.toLocaleString()} total lifetime paid
            </div>
          </div>

          <div className="border border-border rounded-xl p-3.5 bg-surface-muted/30">
            <div className="text-xs text-text-secondary font-medium">Outstanding Balance</div>
            <div className="text-xl font-bold text-text-primary mt-1 flex items-baseline gap-2">
              <span className={outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                ₦{outstandingBalance.toLocaleString()}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                outstandingBalance === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {outstandingBalance === 0 ? 'Cleared ✓' : 'Pending'}
              </span>
            </div>
            <div className="text-[11px] text-text-secondary mt-1">
              {outstandingBalance === 0 ? 'All fees settled' : 'Payment required'}
            </div>
          </div>
        </div>

        {/* Term Fee Components Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Fee Components ({currentTerm?.name ?? 'Current Term'})
          </h4>
          {currentTermFees.length === 0 ? (
            <p className="text-xs text-text-secondary italic">
              No fee structure configured for this student's class and term yet.
            </p>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {currentTermFees.map((f) => {
                const isPaid = paidFeeSet.has(f.id)
                return (
                  <div key={f.id} className="p-3.5 flex items-center justify-between text-sm hover:bg-surface-muted/20 transition-colors">
                    <div>
                      <p className="font-medium text-text-primary">{f.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {f.classes?.name ? f.classes.name : 'All classes'} · {f.terms?.name ? f.terms.name : 'All terms'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-text-primary">₦{Number(f.amount).toLocaleString()}</span>
                      {isPaid ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid ✓
                        </span>
                      ) : (
                        <Link
                          href={`/dashboard/fees/record?studentId=${id}`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          Unpaid (Pay)
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payment History Table */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Payment History & Receipts
          </h4>
          {paymentsList.length === 0 ? (
            <div className="text-center py-6 text-sm text-text-secondary border border-dashed border-border rounded-xl">
              No payments recorded for this student yet.
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/40 text-text-secondary text-xs">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Receipt No.</th>
                    <th className="text-left px-4 py-2.5 font-medium">Fee Item</th>
                    <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                    <th className="text-left px-4 py-2.5 font-medium">Method</th>
                    <th className="text-left px-4 py-2.5 font-medium">Reference</th>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-right px-4 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.map((p) => {
                    const feeName = p.fee_structures?.name ?? 'Fee Payment'
                    const dateStr = p.paid_at ? new Date(p.paid_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
                    const methodLabel = METHOD_LABELS[p.payment_method ?? ''] ?? p.payment_method ?? '—'

                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-surface-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">
                          #{p.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                          {feeName}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 whitespace-nowrap">
                          ₦{Number(p.amount_paid).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                          {methodLabel}
                        </td>
                        <td className="px-4 py-3 text-text-secondary font-mono text-xs whitespace-nowrap">
                          {p.reference || '—'}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            href={`/dashboard/fees/receipt/${p.id}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            View Receipt →
                          </Link>
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
    </div>
  )

  return (
    <div className="px-8 py-8">
      <Link
        href={
          from === 'my-class'
            ? '/dashboard/my-class'
            : from === 'guardian' && guardianId
            ? `/dashboard/guardians/${guardianId}`
            : '/dashboard/students'
        }
        className="text-sm text-primary hover:text-primary-hover"
      >
        {from === 'my-class'
          ? '← Back to my class'
          : from === 'guardian' && guardianId
          ? '← Back to guardian'
          : '← Back to students'}
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-medium">
            {initials}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-text-primary">
                {student.first_name} {student.last_name}
              </h1>
              <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${isActive ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
                {isActive ? 'Active' : student.status}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {student.admission_no} · {currentEnrolment?.classes?.name}
              {currentEnrolment?.arms?.name ? ` · Arm ${currentEnrolment.arms.name}` : ''}
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/students/${id}/edit${from ? `?from=${from}` : ''}`}
          className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
        >
          Edit Student
        </Link>
      </div>

      <TabView
        tabs={[
          { id: 'overview', label: 'Overview', content: overviewContent },
          { id: 'results', label: 'Results', content: resultsContent },
          { id: 'attendance', label: 'Attendance', content: attendanceContent },
          { id: 'fees', label: 'Fees', content: feesContent },
        ]}
      />
    </div>
  )
}