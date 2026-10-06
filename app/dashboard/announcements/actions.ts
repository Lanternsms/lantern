'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createAnnouncement(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found' }

  const title = (formData.get('title') as string).trim()
  const body = (formData.get('body') as string).trim()
  const audience = formData.getAll('audience') as string[]

  if (!title || !body || audience.length === 0) {
    return { error: 'Title, body, and at least one audience are required.' }
  }

  const { error } = await supabase.from('announcements').insert({
    school_id: profile.school_id,
    created_by: user.id,
    title,
    body,
    audience,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/announcements')
  redirect('/dashboard/announcements')
}

export async function updateAnnouncement(id: string, formData: FormData) {
  const supabase = await createClient()
  const title = (formData.get('title') as string).trim()
  const body = (formData.get('body') as string).trim()
  const audience = formData.getAll('audience') as string[]

  if (!title || !body || audience.length === 0) {
    return { error: 'Title, body, and at least one audience are required.' }
  }

  const { error } = await supabase
    .from('announcements')
    .update({ title, body, audience, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/announcements')
  redirect('/dashboard/announcements')
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/announcements')
  return { success: true }
}