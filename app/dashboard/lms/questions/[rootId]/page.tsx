// app/dashboard/lms/questions/[rootId]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-danger-bg text-danger-text flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-text-primary">Unable to load question</h1>
        <p className="text-sm text-text-secondary">
          {res.error || 'This question could not be found or you do not have permission to view it.'}
        </p>
        <div>
          <Link
            href="/dashboard/lms/questions"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            ← Back to Questions Inbox
          </Link>
        </div>
      </div>
    )
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
