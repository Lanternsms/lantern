/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
/**
 * One-off maintenance script to fix existing rows in user_notifications table.
 * Note: Step 3 (app/n/[id]/route.ts) automatically self-heals URLs at click-through
 * time, but this script also updates the persistent database rows for cleanliness.
 */

import * as fs from 'fs'
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = (match[2] || '').trim()
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
      process.env[key] = value
    }
  })
}

// Polyfill WebSocket for supabase-js in Node environment
// @ts-ignore
if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-ignore
  globalThis.WebSocket = class {}
}

import { createAdminClient } from '../lib/supabase/admin'
import { notificationUrl, type RecipientKind, type NotificationUrlContext } from '../lib/notifications/urls'

async function run() {
  console.log('--- Starting Notification URLs Migration ---')
  const admin = createAdminClient()
  const { data: rows, error } = await (admin as any)
    .from('user_notifications')
    .select('id, school_id, recipient_id, type, url, student_id')

  if (error) {
    console.error('Failed to fetch user_notifications:', error)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log('No notification rows found.')
    return
  }

  console.log(`Analyzing ${rows.length} notification rows...`)
  let updatedCount = 0

  for (const row of rows) {
    // Determine recipient kind
    const [{ data: guardian }, { data: student }] = await Promise.all([
      admin
        .from('guardians')
        .select('id')
        .eq('profile_id', row.recipient_id)
        .eq('school_id', row.school_id)
        .maybeSingle(),
      admin
        .from('students')
        .select('id')
        .eq('profile_id', row.recipient_id)
        .eq('school_id', row.school_id)
        .maybeSingle(),
    ])

    let recipientKind: RecipientKind = 'staff'
    if (guardian) {
      recipientKind = 'guardian'
    } else if (student) {
      recipientKind = 'student'
    }

    const context: NotificationUrlContext = {
      studentId: row.student_id,
    }

    const newUrl = notificationUrl(row.type, context, recipientKind)

    if (row.url !== newUrl) {
      console.log(`Fixing [${row.id}] type=${row.type} kind=${recipientKind}:`)
      console.log(`  Old: ${row.url}`)
      console.log(`  New: ${newUrl}`)

      const { error: updateErr } = await (admin as any)
        .from('user_notifications')
        .update({ url: newUrl })
        .eq('id', row.id)

      if (updateErr) {
        console.error(`  Error updating row ${row.id}:`, updateErr.message)
      } else {
        updatedCount++
      }
    }
  }

  console.log(`--- Migration complete. Updated ${updatedCount} rows. ---`)
}

run().catch((err) => {
  console.error('Fatal error during migration:', err)
  process.exit(1)
})
