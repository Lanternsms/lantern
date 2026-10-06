import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DeleteButton from './delete-button'

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, body, audience, created_by, created_at, author:profiles(first_name, last_name)')
    .order('created_at', { ascending: false })

  const { data: canCreate } = await supabase.rpc('has_permission', { perm_code: 'announcements.create' })
  const { data: canManageAll } = await supabase.rpc('has_permission', { perm_code: 'announcements.manage_all' })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Announcements</h1>
        {canCreate && (
          <Link
            href="/dashboard/announcements/new"
            className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            New Announcement
          </Link>
        )}
      </div>

      {(!announcements || announcements.length === 0) && (
        <p className="text-sm text-text-secondary">No announcements yet.</p>
      )}

      <div className="space-y-4">
        {(announcements ?? []).map((a: any) => {
          const canManage = a.created_by === user.id || canManageAll
          return (
            <div key={a.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">{a.title}</h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {a.author?.first_name} {a.author?.last_name} ·{' '}
                    {new Date(a.created_at).toLocaleDateString()} ·{' '}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-3 shrink-0">
                    <Link href={`/dashboard/announcements/${a.id}/edit`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                    <DeleteButton id={a.id} />
                  </div>
                )}
              </div>
              <p className="text-sm text-text-primary mt-3 whitespace-pre-wrap">{a.body}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}