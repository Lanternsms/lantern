import 'server-only'
import crypto from 'crypto'

/**
 * Mask an email address for safe logging: e.g. "john.doe@example.com" -> "j***@example.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '[no-email]'
  const [local, domain] = email.trim().toLowerCase().split('@')
  if (!domain) return '***'
  const firstChar = local.charAt(0) || '*'
  return `${firstChar}***@${domain}`
}

/**
 * Mask a push endpoint URL for safe logging: keeps domain and last 6 chars
 */
export function maskEndpoint(endpoint: string | null | undefined): string {
  if (!endpoint) return '[no-endpoint]'
  try {
    const url = new URL(endpoint)
    const last6 = endpoint.slice(-6)
    return `${url.origin}/...***${last6}`
  } catch {
    return 'https://...***' + endpoint.slice(-6)
  }
}

/**
 * Safe timing-safe comparison
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Sign an unsubscribe payload
 */
export function signUnsubscribeToken(payload: {
  userId: string
  category: string
  schoolId: string
}): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || 'lantern-unsubscribe-secret-fallback'
  const data = `${payload.userId}:${payload.category}:${payload.schoolId}`
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ ...payload, hmac })).toString('base64url')
}

/**
 * Verify and decode an unsubscribe token
 */
export function verifyUnsubscribeToken(token: string): {
  userId: string
  category: string
  schoolId: string
} | null {
  try {
    const jsonStr = Buffer.from(token, 'base64url').toString('utf8')
    const parsed = JSON.parse(jsonStr) as {
      userId: string
      category: string
      schoolId: string
      hmac: string
    }
    if (!parsed.userId || !parsed.category || !parsed.schoolId || !parsed.hmac) {
      return null
    }

    const secret = process.env.UNSUBSCRIBE_SECRET || 'lantern-unsubscribe-secret-fallback'
    const data = `${parsed.userId}:${parsed.category}:${parsed.schoolId}`
    const expected = crypto.createHmac('sha256', secret).update(data).digest('hex')

    if (!timingSafeEqualStr(parsed.hmac, expected)) {
      return null
    }

    return {
      userId: parsed.userId,
      category: parsed.category,
      schoolId: parsed.schoolId,
    }
  } catch {
    return null
  }
}
