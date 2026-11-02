'use server'

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

export type DemoState = { ok: boolean; error?: string; fields?: Record<string, string> }

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? '').trim().slice(0, max)

export async function requestDemo(_prev: DemoState, form: FormData): Promise<DemoState> {
  const fields = {
    name: clean(form.get('name'), 120),
    school: clean(form.get('school'), 160),
    role: clean(form.get('role'), 60),
    phone: clean(form.get('phone'), 30),
    email: clean(form.get('email'), 160),
    students: clean(form.get('students'), 30),
    preferred_time: clean(form.get('preferred_time'), 60),
    notes: clean(form.get('notes'), 1000),
  }

  // Bots fill every field, including this hidden one; people never see it.
  if (clean(form.get('website'))) return { ok: true }

  if (!fields.name || !fields.school || !fields.role || !fields.phone) {
    return { ok: false, error: 'Please fill in your name, school, role and phone number.', fields }
  }
  if (fields.phone.replace(/\D/g, '').length < 10) {
    return { ok: false, error: 'That phone number looks too short. Include the full number, e.g. 0803 123 4567.', fields }
  }
  if (fields.email && !/^\S+@\S+\.\S+$/.test(fields.email)) {
    return { ok: false, error: 'That email address doesn’t look right.', fields }
  }

  const row = { ...fields, email: fields.email || null, students: fields.students || null, preferred_time: fields.preferred_time || null, notes: fields.notes || null }

  let saved = false
  try {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from('demo_requests').insert(row)
    if (error) console.error('[book-demo] insert failed:', error.message)
    else saved = true
  } catch (e) {
    console.error('[book-demo] insert threw:', e)
  }

  let emailed = false
  const key = process.env.RESEND_API_KEY
  if (key) {
    try {
      const lines = [
        `Name: ${fields.name}`, `School: ${fields.school}`, `Role: ${fields.role}`, `Phone: ${fields.phone}`,
        fields.email && `Email: ${fields.email}`, fields.students && `Students: ${fields.students}`,
        fields.preferred_time && `Best time: ${fields.preferred_time}`, fields.notes && `Notes: ${fields.notes}`,
      ].filter(Boolean) as string[]
      const { error } = await new Resend(key).emails.send({
        from: process.env.EMAIL_FROM || 'Lantern <notifications@example.com>',
        to: process.env.DEMO_REQUEST_EMAIL || 'hello@lantern.ng',
        replyTo: fields.email || undefined,
        subject: `Demo request: ${fields.school}`,
        text: lines.join('\n'),
      })
      emailed = !error
      if (error) console.error('[book-demo] email failed:', error.message)
    } catch (e) {
      console.error('[book-demo] email threw:', e)
    }
  }

  if (!saved && !emailed) {
    return { ok: false, error: 'We couldn’t send your request just now. Please try again, or email hello@lantern.ng.', fields }
  }
  return { ok: true }
}
