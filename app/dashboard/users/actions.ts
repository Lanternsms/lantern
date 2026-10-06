'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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

  revalidatePath('/dashboard/users')
  redirect('/dashboard/users')
}