import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLmsAccess } from '@/lib/lms/access'
import {
  GraduationCap,
  CheckSquare,
  FileSpreadsheet,
  Calendar,
  Award,
  MessageSquare,
  BookOpen,
  ChevronRight,
} from 'lucide-react'

const BASE_TEACHER_ACTIONS = [
  {
    label: 'Mark Attendance',
    description: 'Roll call for class & subject periods',
    href: '/dashboard/attendance',
    icon: CheckSquare,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/40',
  },
  {
    label: 'Gradebook',
    description: 'Input assessment & test scores',
    href: '/dashboard/gradebook',
    icon: FileSpreadsheet,
    color: 'text-blue-600 bg-blue-50 border-blue-200/60 dark:bg-blue-950/40',
  },
  {
    label: 'My Timetable',
    description: 'Weekly schedule & classroom venues',
    href: '/dashboard/my-timetable',
    icon: Calendar,
    color: 'text-amber-600 bg-amber-50 border-amber-200/60 dark:bg-amber-950/40',
  },
  {
    label: 'Class Results',
    description: 'Review student performance & totals',
    href: '/dashboard/class-results',
    icon: Award,
    color: 'text-violet-600 bg-violet-50 border-violet-200/60 dark:bg-violet-950/40',
  },
  {
    label: 'Result Remarks',
    description: 'Enter teacher observations & comments',
    href: '/dashboard/results/remarks',
    icon: MessageSquare,
    color: 'text-pink-600 bg-pink-50 border-pink-200/60 dark:bg-pink-950/40',
  },
]

export async function TeacherWidget() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const access = user ? await getLmsAccess(supabase, user) : null

  const actions = [...BASE_TEACHER_ACTIONS]

  if (access?.isManager) {
    actions.push({
      label: 'Recorded Lessons',
      description: 'LMS lessons & student activities',
      href: '/dashboard/lms',
      icon: BookOpen,
      color: 'text-sky-600 bg-sky-50 border-sky-200/60 dark:bg-sky-950/40',
    })
  } else if (access && access.recordedLessonCount > 0) {
    actions.push({
      label: 'My Lessons',
      description: 'Your recorded lessons & activities',
      href: '/dashboard/lms/my-lessons',
      icon: BookOpen,
      color: 'text-sky-600 bg-sky-50 border-sky-200/60 dark:bg-sky-950/40',
    })
  } else if (access?.isFacilitator) {
    actions.push({
      label: "Today's Lessons",
      description: 'Scheduled LMS periods for today',
      href: '/dashboard/lms/today',
      icon: BookOpen,
      color: 'text-sky-600 bg-sky-50 border-sky-200/60 dark:bg-sky-950/40',
    })
  }
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Teaching &amp; Classroom Hub</h2>
              <p className="text-xs text-text-secondary mt-0.5">Quick access to your academic workflows</p>
            </div>
          </div>
          <Link
            href="/dashboard/my-timetable"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Schedule →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-muted/60 hover:border-primary/40 transition-all duration-200 flex items-start gap-3 relative"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${action.color}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                      {action.label}
                    </p>
                    <ChevronRight size={14} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                    {action.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}