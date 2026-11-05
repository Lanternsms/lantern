'use server'

import { revalidatePath } from 'next/cache'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logPlatformAction } from '@/lib/platform-admin/audit'

import { DEMO_STATUSES, type DemoStatus } from './shared'

export type SaveState = { ok?: boolean; error?: string; at?: number }

/** Update one demo request: status, demo date/time (Lagos), notes, lost reason. */
export async function saveDemo(_prev: SaveState, form: FormData): Promise<SaveState> {
  if (!(await hasValidPlatformAdminSession())) return { error: 'Your admin session has ended. Unlock again.' }

  const id = String(form.get('id') || '')
  const status = String(form.get('status') || '') as DemoStatus
  if (!id || !DEMO_STATUSES.includes(status)) return { error: 'Pick a status.' }

  const date = String(form.get('demo_date') || '')
  const time = String(form.get('demo_time') || '')
  // Inputs are Lagos wall-clock time (UTC+1, no daylight saving).
  const demo_at = date ? new Date(`${date}T${time || '10:00'}:00+01:00`).toISOString() : null
  if (status === 'scheduled' && !demo_at) return { error: 'Add the demo date so it shows in “Coming up”.' }

  const notes = String(form.get('admin_notes') ?? '').trim().slice(0, 4000)
  const lost_reason = status === 'lost' ? String(form.get('lost_reason') ?? '').trim().slice(0, 300) || null : null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  const { data: before } = await db.from('demo_requests').select('status, contacted_at, school').eq('id', id).maybeSingle()
  if (!before) return { error: 'That request no longer exists.' }

  const patch: Record<string, unknown> = { status, demo_at, admin_notes: notes || null, lost_reason, updated_at: new Date().toISOString() }
  if (status !== 'new' && !before.contacted_at) patch.contacted_at = new Date().toISOString()

  const { error } = await db.from('demo_requests').update(patch).eq('id', id)
  if (error) return { error: `Couldn’t save: ${error.message}` }

  if (before.status !== status) {
    await logPlatformAction('demo_status_changed', { metadata: { id, school: before.school, from: before.status, to: status } })
  }
  revalidatePath('/platform-admin/demos')
  return { ok: true, at: Date.now() }
}

/** One-tap "I called them": moves New to Contacted without opening the form. */
export async function markContacted(form: FormData) {
  if (!(await hasValidPlatformAdminSession())) return
  const id = String(form.get('id') || '')
  if (!id) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createAdminClient() as any).from('demo_requests')
    .update({ status: 'contacted', contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'new')
  revalidatePath('/platform-admin/demos')
}
