import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/messaging/utils'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function performUnsubscribe(token: string | null) {
  if (!token) {
    return { ok: false, error: 'Missing unsubscribe token' }
  }

  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return { ok: false, error: 'Invalid or expired unsubscribe token' }
  }

  // Account and system categories cannot be unsubscribed
  if (payload.category === 'account' || payload.category === 'system') {
    return { ok: false, error: 'Account and system notices cannot be disabled' }
  }

  const admin = createAdminClient()

  // Set email = false in notification_preferences
  const { error } = await admin.from('notification_preferences').upsert(
    {
      user_id: payload.userId,
      category: payload.category,
      email: false,
    },
    { onConflict: 'user_id,category' }
  )

  if (error) {
    console.error('Error saving unsubscribe preference:', error)
    return { ok: false, error: 'Could not update preferences' }
  }

  return { ok: true, category: payload.category }
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const res = await performUnsubscribe(token)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }
  return NextResponse.json({ unsubscribed: true, category: res.category })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const res = await performUnsubscribe(token)

  if (!res.ok) {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head><title>Unsubscribe – Lantern</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, sans-serif; background: #f8f9fb; padding: 40px 16px; text-align: center; color: #1f2430;">
  <div style="max-width: 440px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
    <h2 style="color: #dc2626; margin-top: 0;">Unsubscribe Link Invalid</h2>
    <p style="color: #6b7280; font-size: 14px;">${res.error || 'This link is invalid or has expired.'}</p>
    <a href="/login" style="display: inline-block; margin-top: 16px; background: #182350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">Go to Lantern</a>
  </div>
</body>
</html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head><title>Unsubscribed – Lantern</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, sans-serif; background: #f8f9fb; padding: 40px 16px; text-align: center; color: #1f2430;">
  <div style="max-width: 440px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
    <h2 style="color: #182350; margin-top: 0;">Unsubscribed</h2>
    <p style="color: #4b5563; font-size: 14px;">You will no longer receive <strong>${res.category}</strong> email alerts from your school.</p>
    <p style="color: #6b7280; font-size: 13px;">You can update your notification settings anytime inside your account.</p>
    <a href="/dashboard/notifications/settings" style="display: inline-block; margin-top: 16px; background: #182350; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">Manage Notification Settings</a>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
