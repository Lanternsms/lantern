import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// In-memory memoized cache: userId -> confirmed email (or null if non-deliverable)
const emailCache = new Map<string, { email: string | null; cachedAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Concurrency runner: executes an array of async tasks with a max concurrency limit.
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      results[idx] = await fn(items[idx])
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

/**
 * Resolves user email addresses in batches with memoized cache and bounded concurrency (10).
 * Returns a Map of userId -> email (or null if not found/unconfirmed).
 */
export async function resolveUserEmails(
  userIds: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  const missingIds: string[] = []
  const now = Date.now()

  for (const id of userIds) {
    const cached = emailCache.get(id)
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      result.set(id, cached.email)
    } else {
      missingIds.push(id)
    }
  }

  if (missingIds.length === 0) {
    return result
  }

  const admin = createAdminClient()

  // Concurrency bounded to 10
  await mapConcurrent(missingIds, 10, async (userId) => {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error || !data?.user?.email) {
        emailCache.set(userId, { email: null, cachedAt: now })
        result.set(userId, null)
        return
      }

      // We accept user.email (must have an email address)
      const email = data.user.email.trim().toLowerCase()
      emailCache.set(userId, { email, cachedAt: now })
      result.set(userId, email)
    } catch {
      emailCache.set(userId, { email: null, cachedAt: now })
      result.set(userId, null)
    }
  })

  return result
}
