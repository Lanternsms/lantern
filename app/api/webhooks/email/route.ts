import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Webhook] RESEND_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing Svix signature headers' }, { status: 400 })
  }

  const rawBody = await request.text()
  const wh = new Webhook(secret)

  let event: {
    type: string
    data: {
      email_id?: string
      to?: string[] | string
      created_at?: string
    }
  }

  try {
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event
  } catch (err) {
    console.warn('[Webhook] Invalid Resend webhook signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()
  const eventType = event.type
  const providerMessageId = event.data?.email_id

  // Handle bounces and complaints -> insert into email_suppressions
  if (eventType === 'email.bounced' || eventType === 'email.complained') {
    const rawTo = event.data?.to
    const recipients: string[] = Array.isArray(rawTo) ? rawTo : rawTo ? [rawTo] : []

    for (const recipient of recipients) {
      const email = recipient.trim().toLowerCase()
      if (email) {
        await admin.from('email_suppressions').upsert({
          email,
          reason: eventType === 'email.complained' ? 'complaint' : 'bounce',
          created_at: new Date().toISOString(),
        })
        console.log(`[Webhook] Added email suppression for ${email} (${eventType})`)
      }
    }

    if (providerMessageId) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error: eventType === 'email.complained' ? 'Recipient reported spam' : 'Email bounced',
        })
        .eq('provider_message_id', providerMessageId)
    }
  } else if (eventType === 'email.delivered' && providerMessageId) {
    // Update delivered_at
    await admin
      .from('notification_deliveries')
      .update({
        delivered_at: new Date().toISOString(),
      })
      .eq('provider_message_id', providerMessageId)
  }

  return NextResponse.json({ received: true })
}
