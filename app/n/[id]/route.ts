import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const returnUrl = encodeURIComponent(`/n/${id}`)
    return NextResponse.redirect(new URL(`/login?returnUrl=${returnUrl}`, request.url))
  }

  const admin = createAdminClient()

  // Query notification
  const { data: notification } = await admin
    .from('user_notifications')
    .select('id, recipient_id, url, read_at')
    .eq('id', id)
    .maybeSingle()

  // Privacy rule: Never reveal whether another user's ID exists.
  // Foreign IDs and non-existent IDs produce the exact same fallback response.
  if (!notification || notification.recipient_id !== user.id) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Mark read if unread
  if (!notification.read_at) {
    await admin
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
  }

  const destination = notification.url || '/dashboard'
  return NextResponse.redirect(new URL(destination, request.url))
}
