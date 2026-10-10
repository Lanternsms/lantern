import { createAdminClient } from '@/lib/supabase/admin'

export async function logPlatformAction(
  action: string,
  opts: { schoolId?: string | null; metadata?: Record<string, unknown> } = {}
) {
  const admin = createAdminClient()
  const { error } = await admin.from('platform_audit_log').insert({
    school_id: opts.schoolId ?? null,
    action,
    metadata: opts.metadata ?? {},
  })
  // Best-effort — a logging failure should never block the real action.
  if (error) {
    console.error('Failed to write platform audit log entry:', action, error)
  }
}