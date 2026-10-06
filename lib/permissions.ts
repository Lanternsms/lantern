import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type MyAccessContext = {
  permissions: Set<string>
  isTeacher: boolean
  isGuardian: boolean
  isStudent: boolean
  isApprover: boolean
  isFormTeacher: boolean
}

export async function getMyAccessContext(supabase: SupabaseClient): Promise<MyAccessContext> {
  const [perms, teacher, guardian, student, approver, formTeacher] = await Promise.all([
    supabase.rpc('get_my_permissions'),
    supabase.rpc('am_i_a_teacher'),
    supabase.rpc('am_i_a_guardian'),
    supabase.rpc('am_i_a_student'),
    supabase.rpc('am_i_an_approver'),
    supabase.rpc('am_i_a_form_teacher'),
  ])

  return {
    permissions: new Set((perms.data ?? []) as string[]),
    isTeacher: teacher.data === true,
    isGuardian: guardian.data === true,
    isStudent: student.data === true,
    isApprover: approver.data === true,
    isFormTeacher: formTeacher.data === true,
  }
}

export type NavGate = {
  permission?: string | string[]
  scope?: 'teacher' | 'guardian' | 'student' | 'approver' | 'formTeacher'
}

export function canSee(ctx: MyAccessContext, gate: NavGate): boolean {
  if (!gate.permission && !gate.scope) return true

  if (gate.permission) {
    const required = Array.isArray(gate.permission) ? gate.permission : [gate.permission]
    if (required.some((p) => ctx.permissions.has(p))) return true
  }

  if (gate.scope === 'teacher' && ctx.isTeacher) return true
  if (gate.scope === 'guardian' && ctx.isGuardian) return true
  if (gate.scope === 'student' && ctx.isStudent) return true
  if (gate.scope === 'approver' && ctx.isApprover) return true
  if (gate.scope === 'formTeacher' && ctx.isFormTeacher) return true
  return false
}
