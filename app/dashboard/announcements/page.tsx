import Link from 'next/link'
import { Megaphone01Icon } from '@hugeicons/core-free-icons'
import { Avatar, ButtonLink, EmptyState, PageHeader, PageShell } from '@/components/ui/page'
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
    <PageShell>
      <PageHeader
        title="Announcements"
        subtitle="Notices sent to staff, students and guardians."
        actions={canCreate ? <ButtonLink href="/dashboard/announcements/new" icon={Megaphone01Icon}>New announcement</ButtonLink> : undefined}
      />

      {(!announcements || announcements.length === 0) && (
        <EmptyState title="No announcements yet" body="Announcements go to phones and email as soon as you send them." />
      )}

      <ul className="flex max-w-3xl flex-col gap-4">
        {(announcements ?? []).map((a: any) => {
          const canManage = a.created_by === user.id || canManageAll
          return (
            <li key={a.id} className="card flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar first={a.author?.first_name ?? '?'} last={a.author?.last_name ?? ''} />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{a.author?.first_name} {a.author?.last_name}</span>
                    <span className="text-xs text-text-secondary">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a.created_at))}</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    <Link href={`/dashboard/announcements/${a.id}/edit`} className="font-medium text-primary hover:underline">Edit</Link>
                    <DeleteButton id={a.id} />
                  </div>
                )}
              </div>
              <h2 className="font-display text-xl font-semibold leading-snug">{a.title}</h2>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#374151]">{a.body}</p>
            </li>
          )
        })}
      </ul>
    </PageShell>
  )
}
