import { createClient } from '@/lib/supabase/server'

export async function logSchoolAction(action: string, opts: { metadata?: Record<string, unknown> } = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, first_name, last_name')
    .eq('id', user.id)
    .single()
  if (!profile) return

  const { error } = await supabase.from('school_audit_log').insert({
    school_id: profile.school_id,
    actor_id: user.id,
    actor_name: `${profile.first_name} ${profile.last_name}`.trim(),
    action,
    metadata: opts.metadata ?? {},
  })
  // Best-effort — never let a logging failure block the real action.
  if (error) {
    console.error('Failed to write school audit log entry:', action, error)
  }
}