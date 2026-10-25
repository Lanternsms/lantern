import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Sparkles, Users, CheckSquare, MessageSquare, ArrowRight } from 'lucide-react'

export async function FormTeacherWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch form teacher assignment details
  const { data: assignment } = await supabase
    .from('form_teachers')
    .select('class_id, arm_id, classes(name), arms(name)')
    .eq('teacher_id', user.id)
    .maybeSingle()

  const className = (assignment?.classes as { name: string } | null)?.name ?? 'Assigned Class'
  const armName = (assignment?.arms as { name: string } | null)?.name ?? null
  const classLabel = `${className}${armName ? ` · Arm ${armName}` : ''}`

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Form Teacher Hub</h2>
              <p className="text-xs text-text-secondary mt-0.5">{classLabel}</p>
            </div>
          </div>
          <Link
            href="/dashboard/my-class"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            My Class →
          </Link>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            As the designated form teacher, you oversee daily pastoral care, homeroom roll calls, and end-of-term conduct remarks.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <Link
              href="/dashboard/my-class"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex flex-col gap-1.5"
            >
              <Users size={16} className="text-emerald-600" />
              <span className="font-semibold text-text-primary">Class Roster</span>
            </Link>
            <Link
              href="/dashboard/attendance"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex flex-col gap-1.5"
            >
              <CheckSquare size={16} className="text-blue-600" />
              <span className="font-semibold text-text-primary">Daily Register</span>
            </Link>
            <Link
              href="/dashboard/results/remarks"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex flex-col gap-1.5"
            >
              <MessageSquare size={16} className="text-pink-600" />
              <span className="font-semibold text-text-primary">Term Remarks</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Homeroom Operations</span>
        <Link href="/dashboard/my-class" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
          Open class overview <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}