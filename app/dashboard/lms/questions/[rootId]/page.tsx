// app/dashboard/lms/questions/[rootId]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getThread } from '../actions'
import { ThreadClient } from './thread-client'

export const dynamic = 'force-dynamic'

export default async function QuestionThreadPage({
  params,
}: {
  params: Promise<{ rootId: string }>
}) {
  const { rootId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const res = await getThread(rootId)

  if (res.error || !res.root) {
    notFound()
  }

  return (
    <ThreadClient
      root={res.root}
      replies={res.replies}
      canManage={Boolean(res.canManage)}
      currentUserId={user.id}
      rootId={rootId}
    />
  )
}
