import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationsPageClient } from './notifications-client'

export const metadata = {
  title: 'Notifications',
  description: 'View all your notifications',
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notifications } = await (supabase as any)
    .from('user_notifications')
    .select('id, title, body, url, category, created_at, read_at')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <NotificationsPageClient initialNotifications={notifications ?? []} />
}
