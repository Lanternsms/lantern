'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function dismissSetupChecklist() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return

  await supabase
    .from('schools')
    .update({ setup_checklist_dismissed_at: new Date().toISOString() })
    .eq('id', profile.school_id)

  revalidatePath('/dashboard')
}

export async function reopenSetupChecklist() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return

  await supabase
    .from('schools')
    .update({ setup_checklist_dismissed_at: null })
    .eq('id', profile.school_id)

  revalidatePath('/dashboard')
}