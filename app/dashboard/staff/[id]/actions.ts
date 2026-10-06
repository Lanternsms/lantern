'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function linkStaffProfile(staffId: string, formData: FormData) {
  const profileId = formData.get('profileId') as string
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
