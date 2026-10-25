import Link from 'next/link'
import { School, Layers, Award, Calendar, ChevronRight } from 'lucide-react'

const ACADEMIC_LINKS = [
  {
    label: 'Classes & Arms',
    description: 'Grade levels and class sections',
    href: '/dashboard/academics/classes',
    icon: Layers,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200/60',
  },
  {
    label: 'Grading Scales',
    description: 'Grade bands, thresholds & remarks',
    href: '/dashboard/academics/grading',
    icon: Award,
    color: 'text-violet-600 bg-violet-50 border-violet-200/60',
  },
  {
    label: 'Sessions & Terms',
    description: 'Calendar dates and term cycles',
    href: '/dashboard/academics/sessions',
    icon: Calendar,
    color: 'text-amber-600 bg-amber-50 border-amber-200/60',
  },
]

export async function AcademicStructureWidget() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-200/60">
              <School size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Academic Structure</h2>
              <p className="text-xs text-text-secondary mt-0.5">Classes, grading systems, and terms</p>
            </div>
          </div>
          <Link
            href="/dashboard/academics"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Hub →
          </Link>
        </div>

        <div className="space-y-2.5">
          {ACADEMIC_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
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
        <span>Curriculum &amp; Policy</span>
        <Link href="/dashboard/academics" className="font-semibold text-primary hover:underline">
          Go to Academics →
        </Link>
      </div>
    </div>
  )
}