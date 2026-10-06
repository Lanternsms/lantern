'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: canUpload } = await supabase.rpc('has_permission', { perm_code: 'documents.manage' })
  if (!canUpload) return { error: 'You do not have permission to upload documents.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profile not found' }

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const audience = formData.getAll('audience') as string[]
  const classId = (formData.get('class_id') as string) || null
  const armId = (formData.get('arm_id') as string) || null
  const file = formData.get('file') as File | null

  if (!title || audience.length === 0 || !file || file.size === 0) {
    return { error: 'Title, at least one audience, and a file are required.' }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Only PDF and image files (PNG, JPG, WEBP) are allowed.' }
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { error: 'File is too large. Maximum size is 10MB.' }
  }

  const admin = createAdminClient()
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const storagePath = `${profile.school_id}/${randomUUID()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('documents')
    .upload(storagePath, Buffer.from(arrayBuffer), { contentType: file.type })

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` }

  const { error: insertError } = await supabase.from('documents').insert({
    school_id: profile.school_id,
    created_by: user.id,
    title,
    description,
    storage_path: storagePath,
    file_type: file.type,
    file_size: file.size,
    audience,
    class_id: classId,
    arm_id: armId,
  })

  if (insertError) {
    await admin.storage.from('documents').remove([storagePath])
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/documents')
  return { success: true }
}

function getDownloadFilename(title: string, storagePath: string, fileType?: string): string {
  const lastDotIndex = storagePath.lastIndexOf('.')
  let ext = lastDotIndex !== -1 ? storagePath.slice(lastDotIndex) : ''

  if (!ext && fileType) {
    if (fileType === 'application/pdf') ext = '.pdf'
    else if (fileType === 'image/png') ext = '.png'
    else if (fileType === 'image/jpeg') ext = '.jpg'
    else if (fileType === 'image/webp') ext = '.webp'
  }

  const cleanTitle = title.trim().replace(/[/\\?%*:|"<>]/g, '_')

  if (ext && cleanTitle.toLowerCase().endsWith(ext.toLowerCase())) {
    return cleanTitle
  }

  return `${cleanTitle}${ext}`
}

export async function getDocumentUrl(documentId: string, download: boolean = false) {
  const supabase = await createClient()

  // The real access check: if this select returns nothing, RLS says the
  // viewer isn't authorized, and we never touch Storage.
  const { data: doc, error } = await supabase
    .from('documents')
    .select('storage_path, title, file_type')
    .eq('id', documentId)
    .single()

  if (error || !doc) return { error: 'Document not found or not accessible.' }

  const filename = getDownloadFilename(doc.title, doc.storage_path, doc.file_type)

  const admin = createAdminClient()
  const { data: signed, error: signError } = await admin.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 60, download ? { download: filename } : undefined)

  if (signError || !signed) return { error: 'Could not generate a link.' }

  return { url: signed.signedUrl, filename }
}

export async function getDownloadUrl(documentId: string) {
  return getDocumentUrl(documentId, true)
}

export async function getViewUrl(documentId: string) {
  return getDocumentUrl(documentId, false)
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: deleted, error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .select('storage_path')
    .single()

  if (error || !deleted) return { error: 'Not permitted, or document not found.' }

  await admin.storage.from('documents').remove([deleted.storage_path])

  revalidatePath('/dashboard/documents')
  return { success: true }
}