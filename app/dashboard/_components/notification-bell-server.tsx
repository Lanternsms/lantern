import { createClient } from '@/lib/supabase/server'
import { NotificationBell } from '@/components/notification-bell'

/**
 * Server component — fetches the initial unread count for the signed-in user
 * and passes it to the <NotificationBell> client component.
 * Rendered inside the DashboardShell header (via layout.tsx).
 */
export async function NotificationBellServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null)

  return <NotificationBell initialUnreadCount={count ?? 0} />
}
