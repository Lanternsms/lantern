import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserCog, UserPlus, ArrowUpRight } from 'lucide-react'

export async function UsersWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', profile.school_id)

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-200/60">
              <UserCog size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">User Accounts</h2>
              <p className="text-xs text-text-secondary mt-0.5">Portal access and logins</p>
            </div>
          </div>
          <Link
            href="/dashboard/users"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Accounts →
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {(count ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-text-secondary ml-2 font-medium">registered accounts</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-muted text-text-secondary border border-border">
              Portal Access
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <Link
              href="/dashboard/users/new"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-orange-600" />
                <span className="font-semibold text-text-primary">Invite User</span>
              </div>
              <ArrowUpRight size={13} className="text-text-muted group-hover:text-primary transition-colors" />
            </Link>
            <Link
              href="/dashboard/users"
              className="p-3 rounded-xl border border-border bg-surface-muted/40 hover:bg-surface-muted hover:border-primary/40 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <UserCog size={14} className="text-text-secondary" />
                <span className="font-semibold text-text-primary">All Accounts</span>
              </div>
              <ArrowUpRight size={13} className="text-text-muted group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Security &amp; Invites</span>
        <Link href="/dashboard/users" className="font-semibold text-primary hover:underline">
          Manage permissions →
        </Link>
      </div>
    </div>
  )
}