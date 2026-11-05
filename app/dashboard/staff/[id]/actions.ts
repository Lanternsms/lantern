'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function assignStaffRole(staffId: string, roleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: canManage } = await supabase.rpc('has_permission', { perm_code: 'users.manage_roles' })
  if (!canManage) return { error: 'Permission denied. You do not have permission to manage roles.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, profile_id, school_id, first_name, last_name, phone, email')
    .eq('id', staffId)
    .single()
  if (!staff) return { error: 'Staff member not found.' }

  const admin = createAdminClient()
  let profileId = staff.profile_id

  if (!profileId) {
    if (staff.email) {
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const match = existingUsers?.users?.find((u) => u.email?.toLowerCase() === staff.email?.toLowerCase())
      if (match) {
        profileId = match.id
        await admin.from('profiles').upsert({
          id: profileId,
          school_id: staff.school_id,
          first_name: staff.first_name,
          last_name: staff.last_name,
          phone: staff.phone || null,
        })
      }
    }

    if (!profileId) {
      const candidateId = crypto.randomUUID()
      const { error: profileError } = await admin.from('profiles').insert({
        id: candidateId,
        school_id: staff.school_id,
        first_name: staff.first_name,
        last_name: staff.last_name,
        phone: staff.phone || null,
      })

      if (!profileError) {
        profileId = candidateId
      } else {
        const silentEmail = staff.email || `staff_${candidateId}@lantern.internal`
        const { data: newUser } = await admin.auth.admin.createUser({
          email: silentEmail,
          email_confirm: true,
          user_metadata: { first_name: staff.first_name, last_name: staff.last_name },
        })
        if (newUser?.user) {
          profileId = newUser.user.id
          await admin.from('profiles').upsert({
            id: profileId,
            school_id: staff.school_id,
            first_name: staff.first_name,
            last_name: staff.last_name,
            phone: staff.phone || null,
          })
        } else {
          return { error: 'Failed to create profile for role assignment.' }
        }
      }
    }

    await admin.from('staff').update({ profile_id: profileId }).eq('id', staffId)
  }

  const { error: insertErr } = await admin.from('user_roles').insert({
    user_id: profileId,
    role_id: roleId,
    school_id: staff.school_id,
  })

  if (insertErr && !insertErr.message?.includes('duplicate key') && insertErr.code !== '23505') {
    return { error: insertErr.message }
  }

  revalidatePath(`/dashboard/staff/${staffId}`)
  return { success: true }
}

export async function removeStaffRole(staffId: string, roleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: canManage } = await supabase.rpc('has_permission', { perm_code: 'users.manage_roles' })
  if (!canManage) return { error: 'Permission denied. You do not have permission to manage roles.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, profile_id, school_id')
    .eq('id', staffId)
    .single()
  if (!staff || !staff.profile_id) return { error: 'Staff member has no assigned roles.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', staff.profile_id)
    .eq('role_id', roleId)
    .eq('school_id', staff.school_id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/staff/${staffId}`)
  return { success: true }
}

export async function inviteStaffPortalAccess(staffId: string, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) throw new Error('Email is required')

  const supabase = await createClient()
  const { data: staff } = await supabase
    .from('staff')
    .select('school_id, first_name, last_name, profile_id')
    .eq('id', staffId)
    .single()
  if (!staff) throw new Error('Staff record not found')
  if (staff.profile_id) throw new Error('This staff member already has a portal login')

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/invite/accept`,
  })

  let newUserId = invited?.user?.id
  if (inviteError || !newUserId) {
    const { data: existingUser } = await admin.auth.admin.listUsers()
    const match = existingUser?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) {
      newUserId = match.id
      await admin.from('profiles').upsert({
        id: newUserId,
        school_id: staff.school_id,
        first_name: staff.first_name,
        last_name: staff.last_name,
      })
    } else {
      throw new Error('Could not send invite: ' + (inviteError?.message ?? 'unknown error'))
    }
  } else {
    const { error: profileError } = await admin.from('profiles').insert({
      id: newUserId,
      school_id: staff.school_id,
      first_name: staff.first_name,
      last_name: staff.last_name,
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId)
      throw new Error('Could not create profile: ' + profileError.message)
    }
  }

  const roleId = (formData.get('roleId') as string)?.trim()
  if (roleId) {
    await admin.from('user_roles').insert({
      user_id: newUserId,
      role_id: roleId,
      school_id: staff.school_id,
    })
  }

  const { error: linkError } = await admin
    .from('staff')
    .update({ profile_id: newUserId, email })
    .eq('id', staffId)
  if (linkError) throw new Error('Could not link login to staff: ' + linkError.message)

  revalidatePath(`/dashboard/staff/${staffId}`)
}

export async function linkStaffProfile(staffId: string, formData: FormData) {
  const profileId = formData.get('profileId') as string
  const roleId = (formData.get('roleId') as string)?.trim()
  if (!profileId) return

  const supabase = await createClient()

  const { data: staffRow } = await supabase
    .from('staff')
    .select('school_id')
    .eq('id', staffId)
    .single()
  if (!staffRow) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', profileId)
    .single()
  if (!profile || profile.school_id !== staffRow.school_id) {
    throw new Error('That login does not belong to this school.')
  }

  const { error } = await supabase
    .from('staff')
    .update({ profile_id: profileId })
    .eq('id', staffId)

  if (error) {
    // unique violation = that login is already linked to another staff record
    throw new Error(
      error.code === '23505'
        ? 'That login is already linked to another staff record.'
        : 'Could not link this login: ' + error.message
    )
  }

  if (roleId) {
    const admin = createAdminClient()
    await admin.from('user_roles').insert({
      user_id: profileId,
      role_id: roleId,
      school_id: staffRow.school_id,
    })
  }

  revalidatePath(`/dashboard/staff/${staffId}`)
}

export async function unlinkStaffProfile(staffId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update({ profile_id: null })
    .eq('id', staffId)

  if (error) throw new Error('Could not unlink this login: ' + error.message)

  revalidatePath(`/dashboard/staff/${staffId}`)
}

import { assignRole as assignRoleFromUsers, removeRole as removeRoleFromUsers } from '@/app/dashboard/users/actions'

export async function assignRole(...args: Parameters<typeof assignRoleFromUsers>) {
  return await assignRoleFromUsers(...args)
}

export async function removeRole(...args: Parameters<typeof removeRoleFromUsers>) {
  return await removeRoleFromUsers(...args)
}
