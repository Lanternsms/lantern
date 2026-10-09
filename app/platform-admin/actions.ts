'use server'

import { redirect } from 'next/navigation'
import { createPlatformAdminSession, clearPlatformAdminSession } from '@/lib/platform-admin/auth'

export async function unlockPlatformAdmin(formData: FormData) {
  const password = String(formData.get('password') || '')
  if (!process.env.PLATFORM_ADMIN_PASSWORD || password !== process.env.PLATFORM_ADMIN_PASSWORD) {
    redirect('/platform-admin?error=1')
  }
  await createPlatformAdminSession()
  redirect('/platform-admin/onboard')
}

export async function lockPlatformAdmin() {
  await clearPlatformAdminSession()
  redirect('/platform-admin')
}