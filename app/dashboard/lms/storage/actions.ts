/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logSchoolAction } from '@/lib/audit/log-school-actions'

export type DeleteOrphansResult = {
  ok: boolean
  deletedCount: number
  failedCount: number
  error?: string
}

export async function deleteOrphans(names: string[]): Promise<DeleteOrphansResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check permissions: lms.manage or lms.upload
  const [{ data: canManage }, { data: canUpload }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.upload' }),
  ])

  if (!canManage && !canUpload) {
    return { ok: false, deletedCount: 0, failedCount: names.length, error: 'Access denied.' }
  }

  if (!Array.isArray(names) || names.length === 0) {
    return { ok: true, deletedCount: 0, failedCount: 0 }
  }

  // 1. Re-fetch the orphan list through the user-session RPC
  const { data: freshOrphans, error: orphanErr } = await (supabase as any).rpc('lms_orphan_objects')
  if (orphanErr || !freshOrphans || !Array.isArray(freshOrphans)) {
    return {
      ok: false,
      deletedCount: 0,
      failedCount: names.length,
      error: 'Failed to query fresh list of orphan objects.',
    }
  }

  // 2. Only remove names present in that fresh list
  const freshMap = new Map<string, { bucket_id: string; name: string }>()
  for (const item of freshOrphans) {
    if (item && item.name && item.bucket_id) {
      freshMap.set(item.name, { bucket_id: item.bucket_id, name: item.name })
    }
  }

  const toRemoveByBucket: Record<string, string[]> = {}
  for (const name of names) {
    const item = freshMap.get(name)
    if (item) {
      if (!toRemoveByBucket[item.bucket_id]) {
        toRemoveByBucket[item.bucket_id] = []
      }
      toRemoveByBucket[item.bucket_id].push(item.name)
    }
  }

  if (Object.keys(toRemoveByBucket).length === 0) {
    return {
      ok: true,
      deletedCount: 0,
      failedCount: 0,
      error: 'None of the requested files were found in the current orphan list.',
    }
  }

  // 3. Remove them with the admin client
  const admin = createAdminClient()
  let totalDeleted = 0
  let totalFailed = 0
  const errorMessages: string[] = []

  for (const [bucketId, bucketNames] of Object.entries(toRemoveByBucket)) {
    const { data: removeData, error: removeErr } = await admin.storage
      .from(bucketId)
      .remove(bucketNames)

    if (removeErr) {
      totalFailed += bucketNames.length
      errorMessages.push(removeErr.message)
    } else if (Array.isArray(removeData)) {
      const removedCount = removeData.length
      totalDeleted += removedCount
      if (removedCount < bucketNames.length) {
        totalFailed += bucketNames.length - removedCount
      }
    } else {
      totalDeleted += bucketNames.length
    }
  }

  // 4. Audit-log
  await logSchoolAction('lms_orphans_deleted', {
    metadata: {
      requestedCount: names.length,
      deletedCount: totalDeleted,
      failedCount: totalFailed,
      errors: errorMessages,
    },
  })

  revalidatePath('/dashboard/lms/storage')

  return {
    ok: totalFailed === 0,
    deletedCount: totalDeleted,
    failedCount: totalFailed,
    error: errorMessages.length > 0 ? errorMessages.join('; ') : undefined,
  }
}
