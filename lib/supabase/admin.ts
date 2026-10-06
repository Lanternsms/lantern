import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// SERVICE ROLE - server-only. Never import this file from a Client
// Component, and never let SUPABASE_SERVICE_ROLE_KEY carry a
// NEXT_PUBLIC_ prefix. This client bypasses RLS entirely.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}