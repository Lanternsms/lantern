import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type AssignableStaff = { value: string; label: string }

// The single source of truth for every "assign a teacher" dropdown in the
// app. Sourced from staff (not profiles+role), so ANY staff member with a
// linked portal login — teacher, HOD, vice principal, even the principal if
// they also teach a class — is assignable, not just users holding the
// literal "teacher" role.
export async function getAssignableStaff(
  supabase: SupabaseClient,
  schoolId: string
): Promise<AssignableStaff[]> {
  const { data } = await supabase
    .from('staff')
    .select('profile_id, first_name, last_name')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .not('profile_id', 'is', null)
    .order('first_name')

  return (data ?? []).map((s) => ({
    value: s.profile_id as string,
    label: `${s.first_name} ${s.last_name}`,
  }))
}

// Profiles in this school not yet linked to ANY staff/guardian/student
// record — the pool of logins available to attach to a staff record.
export async function getLinkableProfiles(
  supabase: SupabaseClient,
  schoolId: string
) {
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('school_id', schoolId)
    .order('first_name')

  const [{ data: linkedStaff }, { data: linkedGuardians }, { data: linkedStudents }] =
    await Promise.all([
      supabase.from('staff').select('profile_id').not('profile_id', 'is', null),
      supabase.from('guardians').select('profile_id').not('profile_id', 'is', null),
      supabase.from('students').select('profile_id').not('profile_id', 'is', null),
    ])

  const taken = new Set([
    ...(linkedStaff ?? []).map((r) => r.profile_id),
    ...(linkedGuardians ?? []).map((r) => r.profile_id),
    ...(linkedStudents ?? []).map((r) => r.profile_id),
  ])

  return (data ?? []).filter((p) => !taken.has(p.id))
}
