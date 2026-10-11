import Link from 'next/link'
import { Award, Calendar, CreditCard, Bell, FileText, Sparkles, CheckCircle2 } from 'lucide-react'

type EnrolmentData = {
  class_id: string
  arm_id: string | null
  enrolment_date: string | null
  classes: { name: string } | null
  arms: { name: string } | null
  academic_sessions: { name: string; is_current: boolean } | null
}

export type StudentDashboardProps = {
  student: {
    id: string
    school_id: string
    first_name: string
    last_name: string
    admission_no: string
    photo_url: string | null
    status: string
    date_of_birth: string | null
    gender: string | null
    enrolments?: EnrolmentData[]
  }
}

export function StudentDashboard({ student }: StudentDashboardProps) {
  const currentEnrolment = student.enrolments?.find(
    (e) => e.academic_sessions?.is_current
  ) ?? student.enrolments?.[0]

  const className = currentEnrolment?.classes?.name ?? 'Not assigned'
  const armName = currentEnrolment?.arms?.name ?? null
  const classLabel = className + (armName ? ` · Arm ${armName}` : '')
  const sessionName = currentEnrolment?.academic_sessions?.name ?? 'Current Session'
  const initials = `${student.first_name[0] ?? ''}${student.last_name[0] ?? ''}`.toUpperCase()
  const isActive = student.status === 'active'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Student Hero Profile Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Student Photo */}
          <div className="relative shrink-0">
            {student.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.photo_url}
                alt={`${student.first_name} ${student.last_name}`}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-border shadow-sm ring-4 ring-primary/5"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-amber-100 text-amber-700 flex flex-col items-center justify-center font-bold text-2xl sm:text-3xl border-2 border-amber-200 ring-4 ring-amber-50">
                {initials}
                <span className="text-[10px] font-normal text-amber-600/80 mt-1">No photo</span>
              </div>
            )}
            <span
              className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center ${
                isActive ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
              }`}
              title={isActive ? 'Active Student' : student.status}
            >
              <CheckCircle2 size={14} />
            </span>
          </div>

          {/* Student Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {student.first_name} {student.last_name}
              </h1>
              <span
                className={`text-xs font-semibold rounded-full px-2.5 py-0.5 capitalize ${
                  isActive ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'
                }`}
              >
                {student.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs sm:text-sm text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">Admission No:</span>
                <strong className="text-text-primary font-semibold font-mono">{student.admission_no}</strong>
              </span>
              <span className="text-border hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">Class:</span>
                <strong className="text-text-primary font-medium">{classLabel}</strong>
              </span>
              <span className="text-border hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">Session:</span>
                <strong className="text-text-primary font-medium">{sessionName}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Hub */}
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-4">Your Portal Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card: My Results */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-xs group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                <Award size={24} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">My Results</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Check published term grades, test scores, subject totals, class position, and full report cards.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/dashboard/my-results"
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
              >
                View Academic Results →
              </Link>
            </div>
          </div>

          {/* Card: My Timetable */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-xs group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                <Calendar size={24} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">My Timetable</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Access your weekly class schedule, subject period times, and daily classroom routines.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/dashboard/my-timetable"
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
              >
                View Class Timetable →
              </Link>
            </div>
          </div>

          {/* Card: My Payments */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-xs group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                <CreditCard size={24} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">My Payments</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Review fee payment history, term bills, settled invoices, and download transaction receipts.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/dashboard/payments"
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
              >
                View Fee Payments →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* School Resources & Announcements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/announcements"
          className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-surface-muted text-text-secondary flex items-center justify-center shrink-0 group-hover:text-primary transition-colors">
              <Bell size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">School Announcements</p>
              <p className="text-xs text-text-muted mt-0.5">Stay updated on events, circulars, and notices</p>
            </div>
          </div>
          <span className="text-xs font-medium text-primary">Browse →</span>
        </Link>

        <Link
          href="/dashboard/documents"
          className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-surface-muted text-text-secondary flex items-center justify-center shrink-0 group-hover:text-primary transition-colors">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">School Documents</p>
              <p className="text-xs text-text-muted mt-0.5">Forms, syllabus, and study materials</p>
            </div>
          </div>
          <span className="text-xs font-medium text-primary">Browse →</span>
        </Link>
      </div>
    </div>
  )
}
