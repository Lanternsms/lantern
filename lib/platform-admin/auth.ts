import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'lantern_platform_admin'
const SESSION_HOURS = 12

function sign(value: string) {
  const secret = process.env.PLATFORM_ADMIN_COOKIE_SECRET
  if (!secret) throw new Error('PLATFORM_ADMIN_COOKIE_SECRET is not set')
  return crypto.createHmac('sha256', secret).update(value).digest('hex')
}

export async function createPlatformAdminSession() {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000
  const payload = `${expires}`
  const signature = sign(payload)
  const store = await cookies()
  store.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/platform-admin',
    maxAge: SESSION_HOURS * 60 * 60,
  })
}

export async function hasValidPlatformAdminSession(): Promise<boolean> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return false
  const [payload, signature] = raw.split('.')
  if (!payload || !signature) return false
  if (sign(payload) !== signature) return false
  return Number(payload) > Date.now()
}

export async function clearPlatformAdminSession() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}