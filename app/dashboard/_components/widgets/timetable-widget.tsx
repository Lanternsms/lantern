import Link from 'next/link'
import { CalendarDays, Clock, Layers, ChevronRight } from 'lucide-react'

const TIMETABLE_LINKS = [
  {
    label: 'Timetable Builder',
    description: 'Master schedule & teacher periods',
    href: '/dashboard/academics/timetable',
    icon: CalendarDays,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200/60',
  },
  {
    label: 'Bell Schedule & Periods',
    description: 'Configure lesson timings and break hours',
    href: '/dashboard/academics/timetable',
    icon: Clock,
    color: 'text-blue-600 bg-blue-50 border-blue-200/60',
  },
  {
    label: 'Class Allocation',
    description: 'Subject assignments across arms',
    href: '/dashboard/academics/classes',
    icon: Layers,
    color: 'text-teal-600 bg-teal-50 border-teal-200/60',
  },
]

export async function TimetableWidget() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Master Timetable</h2>
              <p className="text-xs text-text-secondary mt-0.5">Schedules, bell times, and allocations</p>
            </div>
          </div>
          <Link
            href="/dashboard/academics/timetable"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Manage →
          </Link>
        </div>

        <div className="space-y-2.5">
          {TIMETABLE_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group p-3 rounded-xl border border-border bg-surface-muted/30 hover:bg-surface-muted hover:border-primary/40 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${item.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Routine &amp; Operations</span>
        <Link href="/dashboard/academics/timetable" className="font-semibold text-primary hover:underline">
          Go to Timetable →
        </Link>
      </div>
    </div>
  )
}