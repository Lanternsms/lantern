/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  return { supabase, user, schoolId: profile.school_id }
}

async function getSchoolId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  return profile.school_id
}

export async function inviteUser(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const admin = createAdminClient()

  const email = (formData.get('email') as string).trim()
  const firstName = (formData.get('first_name') as string).trim()
  const lastName = (formData.get('last_name') as string).trim()
  const roleId = formData.get('role_id') as string

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/invite/accept`,
  })

  if (inviteError || !invited.user) {
    redirect(`/dashboard/users/new?error=${encodeURIComponent(inviteError?.message ?? 'Failed to send invite')}`)
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: invited.user.id,
    school_id: schoolId,
    first_name: firstName,
    last_name: lastName,
  })

  if (profileError) {
    // Roll back the auth user so a failed invite doesn't leave an orphaned login
    await admin.auth.admin.deleteUser(invited.user.id)
    redirect(`/dashboard/users/new?error=${encodeURIComponent(profileError.message)}`)
  }

  await admin.from('user_roles').insert({ user_id: invited.user.id, role_id: roleId, school_id: schoolId })

  await logSchoolAction('user_invited', {
    metadata: {
      invitedUserId: invited.user.id,
      email,
      name: `${firstName} ${lastName}`.trim(),
      roleId,
    },
  })

  revalidatePath('/dashboard/users')
  redirect('/dashboard/users')
}

export async function assignRole(
  userIdOrFormData: string | FormData,
  maybeRoleId?: string
): Promise<{ success?: boolean; error?: string }> {
  let userId = ''
  let roleId = ''
  if (typeof userIdOrFormData === 'string') {
    userId = userIdOrFormData
    roleId = maybeRoleId ?? ''
  } else {
    userId = (userIdOrFormData.get('user_id') as string) ?? ''
    roleId = (userIdOrFormData.get('role_id') as string) ?? ''
  }

  if (!userId || !roleId) {
    return { error: 'User ID and Role ID are required.' }
  }

  const { supabase, schoolId } = await getContext()

  // 1. Check users.manage_roles permission via has_permission RPC
  const { data: canManage } = await supabase.rpc('has_permission', {
    perm_code: 'users.manage_roles',
  })
  if (!canManage) {
    return { error: 'Permission denied. You do not have permission to manage roles.' }
  }

  // 2. Target user must belong to the caller's school
  const { data: targetProfile, error: targetErr } = await (supabase as any)
    .from('profiles')
    .select('id, school_id, first_name, last_name')
    .eq('id', userId)
    .single()

  if (targetErr || !targetProfile || targetProfile.school_id !== schoolId) {
    return { error: 'Target user does not belong to your school.' }
  }

  // 3. The role must be a global system role or belong to the caller's school
  const { data: role, error: roleErr } = await (supabase as any)
    .from('roles')
    .select('id, name, school_id, is_system')
    .eq('id', roleId)
    .single()

  if (roleErr || !role) {
    return { error: 'Role not found.' }
  }

  const isGlobalSystemRole = role.school_id === null && role.is_system === true
  const isSchoolRole = role.school_id === schoolId
  if (!isGlobalSystemRole && !isSchoolRole) {
    return { error: 'This role cannot be assigned in your school.' }
  }

  // 4. Insert into user_roles with school_id = caller's school (idempotent)
  let writeSucceeded = false
  const { data: inserted, error: insertErr } = await (supabase as any)
    .from('user_roles')
    .insert({ user_id: userId, role_id: roleId, school_id: schoolId })
    .select()

  if (insertErr) {
    if (
      insertErr.code === '23505' ||
      insertErr.message?.includes('duplicate key') ||
      insertErr.message?.includes('unique')
    ) {
      // Idempotent: already assigned
      return { success: true }
    }
  } else if (inserted && inserted.length > 0) {
    writeSucceeded = true
  }

  // If RLS blocked the write (0 rows or error), use createAdminClient() AFTER the checks above
  if (!writeSucceeded) {
    const admin = createAdminClient()
    const { data: adminInserted, error: adminInsertErr } = await admin
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleId, school_id: schoolId })
      .select()

    if (adminInsertErr) {
      if (
        adminInsertErr.code === '23505' ||
        adminInsertErr.message?.includes('duplicate key') ||
        adminInsertErr.message?.includes('unique')
      ) {
        return { success: true }
      }
      return { error: adminInsertErr.message || 'Failed to assign role.' }
    }
    if (!adminInserted || adminInserted.length === 0) {
      return { error: 'Failed to assign role.' }
    }
  }

  // 5. Audit-log with logSchoolAction
  await logSchoolAction('role_assigned', {
    metadata: {
      targetUserId: userId,
      targetUserName: `${targetProfile.first_name} ${targetProfile.last_name}`.trim(),
      roleId,
      roleName: role.name,
    },
  })

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function removeRole(
  userIdOrFormData: string | FormData,
  maybeRoleId?: string
): Promise<{ success?: boolean; error?: string }> {
  let userId = ''
  let roleId = ''
  if (typeof userIdOrFormData === 'string') {
    userId = userIdOrFormData
    roleId = maybeRoleId ?? ''
  } else {
    userId = (userIdOrFormData.get('user_id') as string) ?? ''
    roleId = (userIdOrFormData.get('role_id') as string) ?? ''
  }

  if (!userId || !roleId) {
    return { error: 'User ID and Role ID are required.' }
  }

  const { supabase, user, schoolId } = await getContext()

  // 1. Check users.manage_roles permission via has_permission RPC
  const { data: canManage } = await supabase.rpc('has_permission', {
    perm_code: 'users.manage_roles',
  })
  if (!canManage) {
    return { error: 'Permission denied. You do not have permission to manage roles.' }
  }

  // 2. Target user must belong to caller's school
  const { data: targetProfile, error: targetErr } = await (supabase as any)
    .from('profiles')
    .select('id, school_id, first_name, last_name')
    .eq('id', userId)
    .single()

  if (targetErr || !targetProfile || targetProfile.school_id !== schoolId) {
    return { error: 'Target user does not belong to your school.' }
  }

  // 3. The role must exist
  const { data: role, error: roleErr } = await (supabase as any)
    .from('roles')
    .select('id, name, school_id, is_system')
    .eq('id', roleId)
    .single()

  if (roleErr || !role) {
    return { error: 'Role not found.' }
  }

  const isGlobalSystemRole = role.school_id === null && role.is_system === true
  const isSchoolRole = role.school_id === schoolId
  if (!isGlobalSystemRole && !isSchoolRole) {
    return { error: 'This role does not belong to your school.' }
  }

  // 4. Block removing your own admin role
  const isAdminRole = role.name.toLowerCase() === 'admin'
  if (userId === user.id && isAdminRole) {
    return { error: 'You cannot remove your own admin role.' }
  }

  // 5. Block removing the last admin of the school
  if (isAdminRole) {
    const admin = createAdminClient()
    const { data: adminUserRoles, error: adminCountErr } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role_id', roleId)
      .eq('school_id', schoolId)

    if (adminCountErr) {
      return { error: adminCountErr.message }
    }

    const adminUserIds = new Set((adminUserRoles ?? []).map((ur: any) => ur.user_id))
    if (adminUserIds.has(userId) && adminUserIds.size <= 1) {
      return { error: 'Cannot remove the last administrator of the school.' }
    }
  }

  // 6. Delete from user_roles
  let deleteSucceeded = false
  const { data: deleted, error: deleteErr } = await (supabase as any)
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .eq('school_id', schoolId)
    .select()

  if (!deleteErr && deleted && deleted.length > 0) {
    deleteSucceeded = true
  }

  if (!deleteSucceeded) {
    const admin = createAdminClient()
    const { data: adminDeleted, error: adminDeleteErr } = await admin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('school_id', schoolId)
      .select()

    if (adminDeleteErr) {
      return { error: adminDeleteErr.message || 'Failed to remove role.' }
    }
  }

  // 7. Audit-log with logSchoolAction
  await logSchoolAction('role_removed', {
    metadata: {
      targetUserId: userId,
      targetUserName: `${targetProfile.first_name} ${targetProfile.last_name}`.trim(),
      roleId,
      roleName: role.name,
    },
  })

  revalidatePath('/dashboard/staff')
  revalidatePath('/dashboard/users')
  return { success: true }
}