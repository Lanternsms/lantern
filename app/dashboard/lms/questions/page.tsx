// app/dashboard/lms/questions/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLmsAccess, getAnswerableLessonIds } from '@/lib/lms/access'
import { listInboxThreads } from './actions'

export const dynamic = 'force-dynamic'

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return iso
  }
}

function StatusChip({ status }: { status: 'open' | 'answered' | 'closed' }) {
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Open
        </span>
      )
    case 'answered':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Answered
        </span>
      )
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-muted text-text-secondary border border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
          Closed
        </span>
      )
    default:
      return null
  }
}

export default async function QuestionsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; lessonId?: string }>
}) {
  const params = await searchParams
  const tabParam = (params.tab ?? 'open').toLowerCase()
  const validTabs = ['open', 'answered', 'closed', 'all'] as const
  const activeTab: (typeof validTabs)[number] = validTabs.includes(tabParam as any)
    ? (tabParam as any)
    : 'open'

  const lessonIdFilter = params.lessonId || undefined

  const access = await getLmsAccess()
  const answerableIds = await getAnswerableLessonIds(access)

  // Access check: must be manager OR have at least one answerable lesson
  if (!access.isManager && answerableIds.length === 0) {
    notFound()
  }

  // Load threads
  const { threads = [], error } = await listInboxThreads({
    filter: activeTab,
    lessonId: lessonIdFilter,
  })

  // If filtered by lessonId, get lesson title for the banner
  let filteredLessonTitle: string | null = null
  if (lessonIdFilter) {
    const { data: lesson } = await (access.supabase as any)
      .from('lms_lessons')
      .select('title')
      .eq('id', lessonIdFilter)
      .maybeSingle()
    if (lesson) filteredLessonTitle = lesson.title
  }

  const tabs: { key: (typeof validTabs)[number]; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'answered', label: 'Answered' },
    { key: 'closed', label: 'Closed' },
    { key: 'all', label: 'All' },
  ]

  function tabHref(tabKey: string) {
    const sp = new URLSearchParams()
    if (tabKey !== 'open') sp.set('tab', tabKey)
    if (lessonIdFilter) sp.set('lessonId', lessonIdFilter)
    const qs = sp.toString()
    return `/dashboard/lms/questions${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
            LMS Questions
          </p>
          <h1 className="text-2xl font-bold text-text-primary mt-0.5">Questions Inbox</h1>
          <p className="text-sm text-text-secondary mt-1">
            Review and respond to questions asked by students and parents about lessons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {access.isManager && (
            <Link
              href="/dashboard/lms"
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-primary bg-surface hover:bg-surface-muted transition-colors"
            >
              Lesson Library
            </Link>
          )}
          {(access.isFacilitator || access.isManager) && (
            <Link
              href="/dashboard/lms/today"
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-primary bg-surface hover:bg-surface-muted transition-colors"
            >
              Today&apos;s Lessons
            </Link>
          )}
        </div>
      </div>

      {/* Lesson Filter Banner (if filtered) */}
      {lessonIdFilter && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-muted border border-border text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-text-primary shrink-0">Filtering by lesson:</span>
            <span className="text-text-secondary truncate font-medium">
              {filteredLessonTitle || lessonIdFilter}
            </span>
          </div>
          <Link
            href={tabHref(activeTab).replace(/([?&])lessonId=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')}
            className="text-primary hover:underline font-medium shrink-0"
          >
            Clear filter
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => {
          const isActive = activeTab === t.key
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Inbox List */}
      {threads.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center mx-auto text-text-muted">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm0-9a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1zm0 7a1 1 0 100-2 1 1 0 000 2z"
                fill="currentColor"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary">
            No {activeTab !== 'all' ? activeTab : ''} questions found
          </p>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            {activeTab === 'open'
              ? 'All questions for your lessons have been answered or closed.'
              : 'There are no questions matching this filter at this time.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/dashboard/lms/questions/${thread.id}`}
              className="flex items-start justify-between gap-4 p-5 hover:bg-surface-muted transition-colors group"
            >
              <div className="min-w-0 space-y-1.5 flex-1">
                {/* Meta line: Class + Subject & Lesson Title */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {thread.classSubject && (
                    <span className="font-semibold px-2 py-0.5 rounded bg-surface-muted text-text-secondary border border-border">
                      {thread.classSubject}
                    </span>
                  )}
                  <span className="font-medium text-text-primary truncate">
                    {thread.lessonTitle}
                  </span>
                </div>

                {/* Question snippet */}
                <p className="text-sm font-medium text-text-primary line-clamp-2">
                  &ldquo;{thread.snippet}&rdquo;
                </p>

                {/* Asker info and timestamp */}
                <div className="flex items-center gap-2 text-xs text-text-secondary pt-0.5">
                  <span className="font-medium text-text-muted">
                    {thread.askerDisplay}
                  </span>
                  <span>·</span>
                  <span className="text-text-muted">
                    {formatDateTime(thread.createdAt)}
                  </span>
                </div>
              </div>

              {/* Status and Action */}
              <div className="flex items-center gap-3 shrink-0 self-center">
                <StatusChip status={thread.status} />
                <span className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-transform">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M7.5 15l5-5-5-5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
