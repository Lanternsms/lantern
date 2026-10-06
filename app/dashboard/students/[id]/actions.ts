'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function inviteStudentPortalAccess(studentId: string, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) throw new Error('Email is required')

  const supabase = await createClient()
  const { data: student } = await supabase
    .from('students')
    .select('school_id, first_name, last_name, profile_id')
    .eq('id', studentId)
    .single()
  if (!student) throw new Error('Student not found')
  if (student.profile_id) throw new Error('This student already has a portal login')

  const admin = createAdminClient()
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/invite/accept`,
  })
  if (inviteError || !invited.user) {
    throw new Error('Could not send invite: ' + (inviteError?.message ?? 'unknown error'))
  }
  const newUserId = invited.user.id

  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUserId,
    school_id: student.school_id,
    first_name: student.first_name,
    last_name: student.last_name,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId) // roll back the orphaned auth user
    throw new Error('Could not create profile: ' + profileError.message)
  }

  const roleId = formData.get('roleId') as string
  if (!roleId) throw new Error('Select a role for this login')

  const { data: role } = await supabase.from('roles').select('school_id, name').eq('id', roleId).single()
  if (!role || role.school_id !== student.school_id || role.name === 'admin') {
    throw new Error('Invalid role selection')
  }

  await supabase.from('user_roles').insert({ user_id: newUserId, role_id: roleId, school_id: student.school_id })

  const { error: linkError } = await supabase
    .from('students')
    .update({ profile_id: newUserId })
    .eq('id', studentId)
  if (linkError) throw new Error('Could not link login to student: ' + linkError.message)

  revalidatePath(`/dashboard/students/${studentId}`)
}

export async function linkStudentProfile(studentId: string, formData: FormData) {
  const profileId = formData.get('profileId') as string
  if (!profileId) return

  const supabase = await createClient()
  const { data: studentRow } = await supabase
    .from('students')
    .select('school_id')
    .eq('id', studentId)
    .single()
  if (!studentRow) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', profileId)
    .single()
  if (!profile || profile.school_id !== studentRow.school_id) {
    throw new Error('That login does not belong to this school.')
  }

  const { error } = await supabase.from('students').update({ profile_id: profileId }).eq('id', studentId)
  if (error) {
    throw new Error(
      error.code === '23505'
        ? 'That login is already linked to another record.'
        : 'Could not link this login: ' + error.message
    )
  }
  revalidatePath(`/dashboard/students/${studentId}`)
}

export async function revokeStudentPortalAccess(studentId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('students').update({ profile_id: null }).eq('id', studentId)
  if (error) throw new Error('Could not revoke access: ' + error.message)
  revalidatePath(`/dashboard/students/${studentId}`)
}
