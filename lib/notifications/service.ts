import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NotificationInput, EventKey, InsertedNotification } from './types'
import { getAudiences } from './audiences'
import { routeExternal } from '@/lib/messaging/router'
import type { NotificationRecord } from '@/lib/messaging/types'

/**
 * Insert notification records for given recipients.
 * Handles deduplication, external delivery routing, and returns newly inserted rows.
 * Guaranteed NEVER to throw errors back to callers.
 */
export async function createNotifications(
  inputs: NotificationInput | NotificationInput[]
): Promise<InsertedNotification[]> {
  try {
    const rawItems = Array.isArray(inputs) ? inputs : [inputs]
    const validItems = rawItems.filter((item) => Boolean(item.schoolId && item.recipientId))

    if (validItems.length === 0) {
      return []
    }

    const admin = createAdminClient()
    const newlyInsertedRecords: NotificationRecord[] = []

    // Partition items into with-dedupeKey and without-dedupeKey
    const itemsWithDedupe = validItems.filter((i) => Boolean(i.dedupeKey))
    const itemsWithoutDedupe = validItems.filter((i) => !i.dedupeKey)

    // 1. Process items without dedupeKey (all will be newly inserted)
    if (itemsWithoutDedupe.length > 0) {
      const rows = itemsWithoutDedupe.map((item) => ({
        school_id: item.schoolId,
        recipient_id: item.recipientId,
        type: item.type,
        category: item.category,
        title: item.title,
        body: item.body ?? null,
        url: item.url ?? null,
        student_id: item.studentId ?? null,
        actor_id: item.actorId ?? null,
        dedupe_key: null,
        created_at: new Date().toISOString(),
      }))

      const { data, error } = await admin
        .from('user_notifications')
        .insert(rows)
        .select('id, school_id, recipient_id, type, category, title, body, url, student_id, actor_id, dedupe_key, created_at')

      if (!error && data) {
        newlyInsertedRecords.push(...(data as NotificationRecord[]))
      } else if (error) {
        console.error('Error inserting notifications without dedupe:', error)
      }
    }

    // 2. Process items with dedupeKey
    if (itemsWithDedupe.length > 0) {
      // Find existing keys to distinguish new inserts from updates/ignores
      const dedupeKeys = itemsWithDedupe.map((i) => i.dedupeKey as string)
      const recipientIds = itemsWithDedupe.map((i) => i.recipientId)

      const { data: existingRows } = await admin
        .from('user_notifications')
        .select('dedupe_key, recipient_id')
        .in('dedupe_key', dedupeKeys)
        .in('recipient_id', recipientIds)

      const existingSet = new Set<string>()
      ;(existingRows ?? []).forEach((r) => {
        if (r.dedupe_key && r.recipient_id) {
          existingSet.add(`${r.dedupe_key}:${r.recipient_id}`)
        }
      })

      for (const item of itemsWithDedupe) {
        const key = `${item.dedupeKey}:${item.recipientId}`
        const exists = existingSet.has(key)

        const baseRow = {
          school_id: item.schoolId,
          recipient_id: item.recipientId,
          type: item.type,
          category: item.category,
          title: item.title,
          body: item.body ?? null,
          url: item.url ?? null,
          student_id: item.studentId ?? null,
          actor_id: item.actorId ?? null,
          dedupe_key: item.dedupeKey,
          created_at: new Date().toISOString(),
        }

        if (exists) {
          if (item.onDuplicate === 'refresh') {
            // Refreshes update existing row; external router is NOT notified
            await admin
              .from('user_notifications')
              .upsert(baseRow, { onConflict: 'dedupe_key,recipient_id' })
          }
          // If onDuplicate === 'ignore', do nothing
        } else {
          // Brand new row
          const { data, error } = await admin
            .from('user_notifications')
            .insert(baseRow)
            .select('id, school_id, recipient_id, type, category, title, body, url, student_id, actor_id, dedupe_key, created_at')
            .single()

          if (!error && data) {
            newlyInsertedRecords.push(data as NotificationRecord)
            existingSet.add(key)
          } else if (error) {
            console.error('Error inserting deduplicated notification:', error)
          }
        }
      }
    }

    // 3. Route external deliveries (push & email) for newly inserted rows ONLY
    if (newlyInsertedRecords.length > 0) {
      await routeExternal(newlyInsertedRecords)
    }

    return newlyInsertedRecords.map((r) => ({
      id: r.id,
      recipient: r.recipient_id,
      type: r.type,
      category: r.category,
      studentId: r.student_id,
    }))
  } catch (err) {
    console.error('createNotifications error (never thrown):', err)
    return []
  }
}

/**
 * Backward-compatible helper for single notification insert.
 */
export async function sendNotification(input: NotificationInput): Promise<InsertedNotification[]> {
  return createNotifications(input)
}

/**
 * Resolve an event key and payload into concrete notifications.
 * Emits notifications to all audiences based on resolvers.
 */
export async function emit(
  eventKey: EventKey,
  payload: Record<string, unknown>
): Promise<InsertedNotification[]> {
  try {
    const resolvers = getAudiences(eventKey)
    if (!resolvers || resolvers.length === 0) return []

    const notifications: NotificationInput[] = []
    for (const resolver of resolvers) {
      const result = await resolver(payload)
      notifications.push(...result)
    }

    if (notifications.length === 0) return []
    return await createNotifications(notifications)
  } catch (err) {
    console.error('emit error (never thrown):', err)
    return []
  }
}
