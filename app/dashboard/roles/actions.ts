'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getSchoolId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  return profile.school_id
}

export async function createRole(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { data: role, error } = await supabase
    .from('roles')
    .insert({
      school_id: schoolId,
      name: (formData.get('name') as string).trim(),
      description: (formData.get('description') as string)?.trim() || null,
      is_system: false,
    })
    .select('id')
    .single()

  if (error || !role) {
    // 23505 = unique(school_id, name) violation from one_role_name_per_school
    const message = error?.code === '23505' ? 'A role with this name already exists.' : error?.message ?? 'Failed to create role'
    redirect(`/dashboard/roles/new?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/dashboard/roles')
  redirect(`/dashboard/roles/${role.id}`)
}

export async function updateRole(roleId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('roles')
    .update({
      name: (formData.get('name') as string).trim(),
      description: (formData.get('description') as string)?.trim() || null,
    })
    .eq('id', roleId)

  if (error) {
    redirect(`/dashboard/roles/${roleId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/roles')
  revalidatePath(`/dashboard/roles/${roleId}`)
}

export async function deleteRole(formData: FormData) {
  const supabase = await createClient()
  const roleId = formData.get('role_id') as string

  // user_roles.role_id cascades on delete — meaning deleting a role
  // silently strips it from everyone holding it, with no error at all.
  // Guard against that explicitly rather than letting it happen quietly.
  const { count } = await supabase
    .from('user_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role_id', roleId)

  if (count && count > 0) {
    redirect(`/dashboard/roles/${roleId}?error=${encodeURIComponent(`This role is currently assigned to ${count} user(s). Reassign them before deleting it.`)}`)
  }

  const { error } = await supabase.from('roles').delete().eq('id', roleId)

  if (error) {
    redirect(`/dashboard/roles/${roleId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/roles')
  redirect('/dashboard/roles')
}

export async function grantPermission(formData: FormData) {
  const supabase = await createClient()
  const roleId = formData.get('role_id') as string
  const permissionId = formData.get('permission_id') as string

  await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId })
  revalidatePath(`/dashboard/roles/${roleId}`)
}

export async function revokePermission(formData: FormData) {
  const supabase = await createClient()
  const roleId = formData.get('role_id') as string
  const permissionId = formData.get('permission_id') as string

  await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId)
  revalidatePath(`/dashboard/roles/${roleId}`)
}