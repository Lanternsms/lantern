'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveBranding(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found.' }

  const theme = {
    primary: String(formData.get('primary') || '#182350'),
    sidebar: String(formData.get('sidebar') || '#131c40'),
    accent: String(formData.get('accent') || '#b9915e'),
    text_on_primary: String(formData.get('text_on_primary') || '#ffffff'),
    text_on_sidebar: String(formData.get('text_on_sidebar') || '#ffffff'),
    text_on_accent: String(formData.get('text_on_accent') || '#182350'),
  }

  let logo_url: string | undefined

  const logoFile = formData.get('logo') as File | null
  if (logoFile && logoFile.size > 0) {
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(logoFile.type)) {
      return { error: 'Logo must be a PNG, JPG, SVG or WebP image.' }
    }
    if (logoFile.size > 2 * 1024 * 1024) {
      return { error: 'Logo must be under 2MB.' }
    }

    const ext = logoFile.name.split('.').pop() || 'png'
    const path = `${profile.school_id}/logo-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('school-logos')
      .upload(path, logoFile, { contentType: logoFile.type, upsert: true })

    if (uploadError) {
      return { error: `Logo upload failed: ${uploadError.message}` }
    }

    const { data: publicUrlData } = supabase.storage.from('school-logos').getPublicUrl(path)
    logo_url = publicUrlData.publicUrl
  }

  const { error: updateError } = await supabase
    .from('schools')
    .update({ theme, ...(logo_url ? { logo_url } : {}) })
    .eq('id', profile.school_id)
    .select()
    .single()

  if (updateError) {
    return { error: "Couldn't save — you may not have permission to edit school settings." }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}