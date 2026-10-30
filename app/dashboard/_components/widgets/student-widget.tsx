import Link from 'next/link'
import { GraduationCap, Award, Calendar, CreditCard, ChevronRight } from '@/components/icons'

const STUDENT_LINKS = [
  {
    label: 'My Results',
    description: 'Published report cards & test marks',
    href: '/dashboard/my-results',
    icon: Award,
    color: 'text-school-ink bg-school-soft border-school-track',
  },
  {
    label: 'My Timetable',
    description: 'Weekly schedule & class periods',
    href: '/dashboard/my-timetable',
    icon: Calendar,
    color: 'text-warning-text bg-warning-bg border-warning-bg',
  },
  {
    label: 'My Payments',
    description: 'Fee balances & transaction receipts',
    href: '/dashboard/payments',
    icon: CreditCard,
    color: 'text-success-text bg-success-bg border-success-bg',
  },
]

export async function StudentWidget() {
  return (
    <div className="card p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center shrink-0 text-text-secondary">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Student Academic Hub</h2>
              <p className="text-xs text-text-secondary mt-0.5">Your personal learning and portal records</p>
            </div>
          </div>
          <Link
            href="/dashboard/my-results"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Portal →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STUDENT_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group p-3.5 rounded-lg border border-border bg-surface-muted/30 hover:bg-surface-muted hover:border-primary/40 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center shrink-0 text-text-secondary">
                    <Icon size={16} />
                  </div>
                  <ChevronRight size={14} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {link.label}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                    {link.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Learning &amp; Scores</span>
        <Link href="/dashboard/my-results" className="font-semibold text-primary hover:underline">
          View full report &rarr;
        </Link>
      </div>
    </div>
  )
}