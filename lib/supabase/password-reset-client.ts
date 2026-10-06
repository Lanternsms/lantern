import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// A plain (non-SSR) Supabase client used ONLY to trigger password-reset
// emails. @supabase/ssr's createBrowserClient forces/defaults to the PKCE
// flow, which ties the reset link to one specific browser/device — the
// opposite of what we want here. This client explicitly uses the implicit
// flow instead, producing a reset link that works from any device, and
// `persistSession: false` keeps it from ever touching localStorage, so it
// can't collide with the real app session managed by lib/supabase/client.ts.
export function createPasswordResetClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}