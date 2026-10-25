import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTodayInLagos } from '@/app/dashboard/lms/lagos-time'
import { getPeriodRoster } from '@/app/dashboard/lms/attendance/actions'
import RosterWidget from './roster-widget'

export const dynamic = 'force-dynamic'

export default async function PeriodAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { entryId } = await params
  const { date: dateParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check permissions
  const [{ data: canManage }, { data: canFacilitate }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' }),
  ])

  if (!canManage && !canFacilitate) {
    redirect('/dashboard?error=' + encodeURIComponent('Access denied.'))
  }

  // Resolve date: lms.manage may supply ?date=; facilitators are always forced to today
  const { dateStr: todayStr } = getTodayInLagos()
  const date = canManage && dateParam ? dateParam : todayStr

  // Get the roster data (authorization happens inside)
  const rosterData = await getPeriodRoster({ timetableEntryId: entryId, date })

  if (!rosterData.ok) {
    notFound()
  }

  const { className, armName, subjectName, statuses, roster } = rosterData

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date + 'T12:00:00'))

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-text-secondary mb-1">
          <Link href="/dashboard/lms/today" className="hover:text-primary">
            Today&apos;s Lessons
          </Link>{' '}
          / Take Attendance
        </p>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {subjectName} — Period Attendance
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {className}
              {armName ? ` · ${armName}` : ''} &bull;{' '}
              <span className="font-medium">{formattedDate}</span>
            </p>
          </div>
          {canManage && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              Admin view
            </span>
          )}
        </div>
      </div>

      {statuses.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          No attendance statuses have been configured for this school. Please ask an administrator to set them up under{' '}
          <Link href="/dashboard/attendance/settings" className="underline font-medium">
            Attendance Settings
          </Link>
          .
        </div>
      )}

      <RosterWidget
        timetableEntryId={entryId}
        date={date}
        roster={roster}
        statuses={statuses}
      />
    </div>
  )
}
