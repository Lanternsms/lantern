/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLmsAccess, todayInSchoolTz } from '@/lib/lms/access'
import { FacilitatorPeriodCard, LessonOption, DeliveryInfo } from './facilitator-period-card'
import { getTodayAttendanceChips } from '../attendance/actions'

export const dynamic = 'force-dynamic'

export default async function FacilitatorTodayPage() {
  const access = await getLmsAccess()

  // Only facilitators and managers may view this page
  if (!access.isFacilitator && !access.isManager) {
    notFound()
  }

  const { supabase, user, schoolId, schoolTimezone } = access

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  // 1. Current session
  const { data: session } = await (supabase as any)
    .from('academic_sessions')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()

  // 2. Compute "today" in school timezone (never new Date().toISOString().slice(0, 10))
  const { dateStr, dayOfWeek } = todayInSchoolTz(schoolTimezone)
  const todayDateObj = new Date()
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: schoolTimezone || 'Africa/Lagos',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(todayDateObj)

  // 3. Load timetable entries for today where teacher_id = user, delivery_mode = 'lms'
  let entries: any[] = []
  if (session) {
    const { data: rawEntries } = await (supabase as any)
      .from('timetable_entries')
      .select(`
        id, class_id, arm_id, subject_id, day_of_week, delivery_mode,
        period:timetable_periods ( id, name, start_time, end_time, sort_order ),
        class:classes ( id, name ),
        arm:arms ( id, name ),
        subject:subjects ( id, name )
      `)
      .eq('session_id', session.id)
      .eq('school_id', schoolId)
      .eq('teacher_id', user.id)
      .eq('delivery_mode', 'lms')
      .eq('day_of_week', dayOfWeek)

    entries = (rawEntries ?? []).sort((a: any, b: any) => {
      const aTime = a.period?.start_time ?? ''
      const bTime = b.period?.start_time ?? ''
      return aTime.localeCompare(bTime)
    })
  }

  // 4. For each entry, load published lessons and past deliveries to identify suggested lesson
  const entryCardsData = await Promise.all(
    entries.map(async (entry: any) => {
      // Load published lessons for this class & subject
      const { data: rawLessons } = await (supabase as any)
        .from('lms_lessons')
        .select('id, title, topic, week_no, duration_seconds, created_at, notes_path, notes_size_bytes, ai_tutor_enabled')
        .eq('school_id', schoolId)
        .eq('class_id', entry.class_id)
        .eq('subject_id', entry.subject_id)
        .eq('status', 'published')
        .not('video_path', 'is', null)
        .order('week_no', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      // Load all deliveries for this class & arm
      let deliveryQuery = (supabase as any)
        .from('lms_lesson_deliveries')
        .select('id, lesson_id, delivered_on, delivered_by, timetable_entry_id')
        .eq('school_id', schoolId)
        .eq('class_id', entry.class_id)

      if (entry.arm_id) {
        deliveryQuery = deliveryQuery.eq('arm_id', entry.arm_id)
      } else {
        deliveryQuery = deliveryQuery.is('arm_id', null)
      }

      const { data: classDeliveries } = await deliveryQuery

      const deliveredLessonIds = new Set<string>(
        (classDeliveries ?? []).map((d: any) => d.lesson_id)
      )

      // Today's delivery for this entry
      const todayDel = (classDeliveries ?? []).find(
        (d: any) =>
          d.delivered_on === dateStr &&
          (d.timetable_entry_id === entry.id || d.delivered_by === user.id)
      )

      let todayDeliveryInfo: DeliveryInfo | null = null
      if (todayDel) {
        const matchingLesson = (rawLessons ?? []).find((l: any) => l.id === todayDel.lesson_id)
        todayDeliveryInfo = {
          id: todayDel.id,
          lesson_id: todayDel.lesson_id,
          delivered_by: todayDel.delivered_by,
          lesson_title: matchingLesson?.title ?? 'Delivered Lesson',
        }
      }

      // Load open questions count for lessons of this subject & class
      const lessonIds = (rawLessons ?? []).map((l: any) => l.id)
      const openQuestionCounts: Record<string, number> = {}
      if (lessonIds.length > 0) {
        const { data: openMsg } = await (supabase as any)
          .from('lms_lesson_messages')
          .select('lesson_id')
          .eq('school_id', schoolId)
          .in('lesson_id', lessonIds)
          .is('parent_id', null)
          .eq('status', 'open')

        for (const m of openMsg ?? []) {
          openQuestionCounts[m.lesson_id] = (openQuestionCounts[m.lesson_id] || 0) + 1
        }
      }

      const lessonOptions: LessonOption[] = (rawLessons ?? []).map((l: any) => ({
        id: l.id,
        title: l.title,
        topic: l.topic,
        week_no: l.week_no,
        duration_seconds: l.duration_seconds,
        isDeliveredForClassArm: deliveredLessonIds.has(l.id),
        openQuestionsCount: openQuestionCounts[l.id] || 0,
        notes_path: l.notes_path,
        notes_size_bytes: l.notes_size_bytes,
      }))

      // "Suggested" lesson = first one with NO lms_lesson_deliveries row for this class & arm
      const suggestedLesson = lessonOptions.find((l) => !l.isDeliveredForClassArm)
      const suggestedLessonId = suggestedLesson?.id ?? lessonOptions[0]?.id ?? null

      return {
        entry,
        lessonOptions,
        suggestedLessonId,
        todayDeliveryInfo,
      }
    })
  )

  // 5. Fetch attendance chips for all entries (server-side, no RLS bypass needed for counts)
  const entryIds = entryCardsData.map(({ entry }) => entry.id)
  const { chips: attendanceChips } = await getTodayAttendanceChips({
    entryIds,
    date: dateStr,
  })

  // 6. Read-only "Recently delivered" list (last 10) for this facilitator
  const { data: recentDeliveries } = await (supabase as any)
    .from('lms_lesson_deliveries')
    .select(`
      id, delivered_on, created_at,
      lesson:lms_lessons ( id, title, week_no, topic ),
      class:classes ( name ),
      arm:arms ( name )
    `)
    .eq('school_id', schoolId)
    .eq('delivered_by', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
            Facilitator Screen
          </p>
          <h1 className="text-2xl font-bold text-text-primary mt-0.5">Today&apos;s Lessons</h1>
          <p className="text-sm text-text-secondary mt-1">
            {formattedDate} {session && `· ${session.name}`}
          </p>
        </div>
        {access.isManager && (
          <Link
            href="/dashboard/lms"
            className="text-sm text-primary hover:text-primary-hover font-medium self-center"
          >
            View Lesson Library →
          </Link>
        )}
      </div>

      {/* Period Cards Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Scheduled LMS Periods</h2>
          <span className="text-xs text-text-secondary">
            {entryCardsData.length} period{entryCardsData.length === 1 ? '' : 's'} today
          </span>
        </div>

        {!session ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-text-secondary">
            No active academic session found for this school.
          </div>
        ) : entryCardsData.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-10 text-center space-y-2">
            <p className="text-sm font-medium text-text-primary">No lessons scheduled for you today</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              You do not have any recorded lesson (LMS) timetable entries scheduled for today.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {entryCardsData.map(({ entry, lessonOptions, suggestedLessonId, todayDeliveryInfo }) => (
              <FacilitatorPeriodCard
                key={entry.id}
                timetableEntryId={entry.id}
                periodName={entry.period?.name ?? 'Period'}
                startTime={entry.period?.start_time ?? ''}
                endTime={entry.period?.end_time ?? ''}
                className={entry.class?.name ?? 'Class'}
                armName={entry.arm?.name ?? null}
                subjectName={entry.subject?.name ?? 'Subject'}
                publishedLessons={lessonOptions}
                suggestedLessonId={suggestedLessonId}
                todayDelivery={todayDeliveryInfo}
                currentUserId={user.id}
                canManage={access.isManager}
                attendanceChip={attendanceChips[entry.id] ?? null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recently Delivered Section (last 10) */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h2 className="text-base font-semibold text-text-primary">Recently Delivered</h2>
        <p className="text-xs text-text-secondary">Your last 10 delivered lessons</p>

        {!recentDeliveries || recentDeliveries.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center text-xs text-text-muted">
            You haven&apos;t marked any lessons as delivered yet.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
            {recentDeliveries.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {item.lesson?.week_no != null && (
                      <span className="text-text-muted mr-1.5 font-normal">Wk {item.lesson.week_no}:</span>
                    )}
                    {item.lesson?.title ?? 'Lesson'}
                  </p>
                  <p className="text-text-muted mt-0.5 truncate">
                    {item.class?.name ?? 'Class'} {item.arm?.name ? `(${item.arm.name})` : ''}
                    {item.lesson?.topic ? ` · ${item.lesson.topic}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-text-secondary font-mono">{item.delivered_on}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
