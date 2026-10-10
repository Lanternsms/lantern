import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getMyAccessContext } from '@/lib/permissions'
import { dismissSetupChecklist, reopenSetupChecklist } from './setup-checklist-actions'

const STEPS = [
  {
    key: 'branding',
    label: 'Customize your branding',
    description: 'Add your logo and pick your school colors.',
    href: '/dashboard/settings/branding',
  },
  {
    key: 'grading',
    label: 'Set up your grading scale',
    description: 'Define grade bands (A, B, C...) used on report cards.',
    href: '/dashboard/academics',
  },
  {
    key: 'classes',
    label: 'Add your classes',
    description: 'Create the classes and arms your school runs.',
    href: '/dashboard/academics',
  },
  {
    key: 'staff',
    label: 'Add your staff',
    description: 'Invite teachers and other staff members.',
    href: '/dashboard/staff',
  },
  {
    key: 'students',
    label: 'Add your students',
    description: 'Enroll your first students.',
    href: '/dashboard/students',
  },
  {
    key: 'fees',
    label: 'Set up fee structures',
    description: 'Define what each class is charged per term.',
    href: '/dashboard/fees/structures',
  },
] as const

export async function SetupChecklist() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const ctx = await getMyAccessContext(supabase)
  if (!ctx.permissions.has('school.manage')) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const { data: school } = await supabase
    .from('schools')
    .select('logo_url, setup_checklist_dismissed_at')
    .eq('id', profile.school_id)
    .single()
  if (!school) return null

  const schoolId = profile.school_id

  const [grading, classes, staff, students, fees] = await Promise.all([
    supabase.from('grading_scales').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('fee_structures').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
  ])

  const done: Record<string, boolean> = {
    branding: Boolean(school.logo_url),
    grading: (grading.count ?? 0) > 0,
    classes: (classes.count ?? 0) > 0,
    staff: (staff.count ?? 0) > 1, // more than just the invited admin
    students: (students.count ?? 0) > 0,
    fees: (fees.count ?? 0) > 0,
  }

  const remaining = STEPS.filter((s) => !done[s.key])

  // Setup is genuinely finished — nothing to show, collapsed or not.
  if (remaining.length === 0) return null

  const completedCount = STEPS.length - remaining.length

  // Collapsed state: a small reopenable bar, not nothing.
  if (school.setup_checklist_dismissed_at) {
    return (
      <div className="flex items-center justify-between border border-border rounded-xl px-4 py-2.5 mb-6 bg-surface">
        <span className="text-sm font-medium text-text-primary">Setup Checklist</span>
        <form action={reopenSetupChecklist}>
          <button type="submit" className="text-xs font-medium text-primary hover:underline">Open</button>
        </form>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-xl p-5 mb-6 bg-surface">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Finish setting up your school</h2>
          <p className="text-xs text-text-secondary mt-0.5">{completedCount} of {STEPS.length} steps done</p>
        </div>
        <form action={dismissSetupChecklist}>
          <button type="submit" className="text-xs text-text-secondary hover:text-text-primary">Hide</button>
        </form>
      </div>

      <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-2">
        {STEPS.map((step) => (
          <li key={step.key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full text-xs shrink-0 ${
                  done[step.key] ? 'bg-emerald-500 text-white' : 'border border-border text-transparent'
                }`}
              >
                ✓
              </span>
              <div>
                <p className={`text-sm ${done[step.key] ? 'text-text-secondary line-through' : 'text-text-primary font-medium'}`}>
                  {step.label}
                </p>
                {!done[step.key] && <p className="text-xs text-text-secondary">{step.description}</p>}
              </div>
            </div>
            {!done[step.key] && (
              <Link href={step.href} className="text-xs font-medium text-primary hover:underline shrink-0">
                Go →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}