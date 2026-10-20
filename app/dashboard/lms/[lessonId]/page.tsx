/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { updateLesson, setLessonStatus } from '../actions'
import { DeleteLessonButton } from '../delete-lesson-button'
import { LessonPlayerModal } from '../lesson-player-modal'
import { LessonVideoUpload } from '../lesson-video-upload'
import { canManageActivities, canViewActivityResults } from '../access'
import { ActivityManager } from '../activities/activity-manager'

export const dynamic = 'force-dynamic'

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'Unknown'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { lessonId } = await params
  const { error: errorMsg, success: successMsg } = await searchParams
  const supabase = await createClient()

  // Get current user and profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  const schoolId = profile?.school_id ?? ''

  // Permission checks
  const [{ data: canManage }, { data: canUpload }, { data: canFacilitate }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.upload' }),
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' }),
  ])

  const { data: lesson, error: fetchErr } = await (supabase as any)
    .from('lms_lessons')
    .select(`
      id, title, topic, week_no, status, duration_seconds, created_at,
      video_path, class_id, subject_id, term_id, recorded_by,
      classes:class_id ( name ),
      subjects:subject_id ( name ),
      terms:term_id ( name ),
      recorder:recorded_by ( first_name, last_name ),
      uploader:uploaded_by ( first_name, last_name )
    `)
    .eq('id', lessonId)
    .single()

  if (fetchErr || !lesson) notFound()

  const isRecorder = lesson.recorded_by === user.id
  const hasLmsPerms = !!(canManage || canUpload || canFacilitate)

  // Recorders without lms.* perms are allowed to access and manage activities
  if (!hasLmsPerms && !isRecorder) {
    redirect('/dashboard?error=' + encodeURIComponent('You do not have access to this lesson.'))
  }

  const [canManageAct, canViewActResults] = await Promise.all([
    canManageActivities(user.id, lesson),
    canViewActivityResults(user.id, lesson)
  ])

  // Get enrolled count for the class in current session
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()

  let totalEnrolled = 0
  if (currentSession && lesson.class_id) {
    const { count } = await supabase
      .from('enrolments')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('session_id', currentSession.id)
      .eq('class_id', lesson.class_id)
    totalEnrolled = count ?? 0
  }

  // Load activities for this lesson
  const { data: activitiesRaw } = await (supabase as any)
    .from('lms_activities')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true })

  // Submissions count
  const { data: subRows } = await (supabase as any)
    .from('lms_submissions')
    .select('activity_id, student_id')
    .eq('school_id', schoolId)

  const subsCountByAct: Record<string, Set<string>> = {}
  for (const s of (subRows || [])) {
    if (!subsCountByAct[s.activity_id]) subsCountByAct[s.activity_id] = new Set()
    subsCountByAct[s.activity_id].add(s.student_id)
  }

  const activities = (activitiesRaw || []).map((a: any) => ({
    ...a,
    submissions_count: subsCountByAct[a.id]?.size || 0
  }))

  // Recorders without lms.* perms see ONLY the Activities section per spec
  if (!hasLmsPerms && isRecorder) {
    return (
      <div className="px-8 py-8 max-w-4xl space-y-8">
        <div>
          <p className="text-sm text-text-secondary mb-1">
            <Link href="/dashboard/lms/my-lessons" className="hover:text-primary">My Lessons</Link> / {lesson.title}
          </p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-xl font-semibold text-text-primary">{lesson.title}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              lesson.status === 'published'
                ? 'bg-success-bg text-success-text'
                : 'bg-surface-muted text-text-secondary border border-border'
            }`}>
              {lesson.status}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {lesson.classes?.name} &bull; {lesson.subjects?.name} &bull; Recorded by you
          </p>
        </div>

        {errorMsg && (
          <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="text-sm text-success-text bg-success-bg rounded-lg px-3 py-2">
            {successMsg}
          </p>
        )}

        <ActivityManager
          lessonId={lessonId}
          activities={activities}
          canManage={canManageAct}
          canViewResults={canViewActResults}
          isSchoolManager={!!canManage}
          totalEnrolled={totalEnrolled}
        />
      </div>
    )
  }

  // Data for the edit form
  const [{ data: classes }, { data: subjects }, { data: terms }] = await Promise.all([
    supabase.from('classes').select('id, name').order('name'),
    supabase.from('subjects').select('id, name').order('name'),
    supabase.from('terms').select('id, name').order('name'),
  ])

  const { data: staffRows } = await supabase
    .from('staff')
    .select('profile_id, first_name, last_name')
    .eq('status', 'active')
    .order('first_name')

  const staff = (staffRows ?? []).filter((s: any) => s.profile_id)

  const updateWithId = updateLesson.bind(null, lessonId)
  const setPublished = setLessonStatus.bind(null, lessonId, 'published')
  const setDraft = setLessonStatus.bind(null, lessonId, 'draft')

  return (
    <div className="px-8 py-8 max-w-4xl space-y-8">
      {/* Breadcrumb + title */}
      <div>
        <p className="text-sm text-text-secondary mb-1">
          <Link href="/dashboard/lms" className="hover:text-primary">Lessons</Link> / {lesson.title}
        </p>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary">{lesson.title}</h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            lesson.status === 'published'
              ? 'bg-success-bg text-success-text'
              : 'bg-surface-muted text-text-secondary border border-border'
          }`}>
            {lesson.status}
          </span>
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p className="text-sm text-success-text bg-success-bg rounded-lg px-3 py-2">
          {successMsg}
        </p>
      )}

      {/* ── Video section ── */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Video</h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Status</p>
            <p className="text-text-primary">
              {lesson.video_path ? 'Video uploaded' : 'No video yet'}
            </p>
          </div>
          {lesson.duration_seconds && (
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Duration</p>
              <p className="text-text-primary">{formatDuration(lesson.duration_seconds)}</p>
            </div>
          )}
          {lesson.uploader && (
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Uploaded by</p>
              <p className="text-text-primary">{lesson.uploader.first_name} {lesson.uploader.last_name}</p>
            </div>
          )}
          {lesson.recorder && (
            <div>
              <p className="text-text-secondary text-xs mb-0.5">Recorded by</p>
              <p className="text-text-primary">{lesson.recorder.first_name} {lesson.recorder.last_name}</p>
            </div>
          )}
        </div>

        {lesson.video_path && (
          <div>
            <LessonPlayerModal
              lessonId={lessonId}
              videoPath={lesson.video_path}
              title={lesson.title}
              schoolId={schoolId}
            />
          </div>
        )}

        {(canManage || canUpload) && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-text-secondary mb-3">
              {lesson.video_path ? 'Replace existing video:' : 'Upload video for this lesson:'}
            </p>
            <LessonVideoUpload
              lessonId={lessonId}
              schoolId={schoolId}
              hasExistingVideo={!!lesson.video_path}
            />
          </div>
        )}
      </section>

      {/* ── Activities section ── */}
      <ActivityManager
        lessonId={lessonId}
        activities={activities}
        canManage={canManageAct}
        canViewResults={canViewActResults}
        isSchoolManager={!!canManage}
        totalEnrolled={totalEnrolled}
      />

      {/* ── Edit metadata form (canManage only) ── */}
      {canManage && (
        <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Lesson details</h2>

          <form action={updateWithId} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Title</label>
              <input
                name="title"
                type="text"
                required
                defaultValue={lesson.title}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Topic</label>
              <input
                name="topic"
                type="text"
                defaultValue={lesson.topic ?? ''}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Class</label>
                <select
                  name="class_id"
                  defaultValue={lesson.class_id}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {(classes ?? []).map((c: { id: string; name: string }) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Subject</label>
                <select
                  name="subject_id"
                  defaultValue={lesson.subject_id}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {(subjects ?? []).map((s: { id: string; name: string }) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Term</label>
                <select
                  name="term_id"
                  defaultValue={lesson.term_id ?? ''}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Any term</option>
                  {(terms ?? []).map((t: { id: string; name: string }) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Week</label>
                <input
                  name="week_no"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={lesson.week_no ?? ''}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {staff.length > 0 && (
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Recorded by</label>
                <select
                  name="recorded_by"
                  defaultValue={lesson.recorded_by ?? ''}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select teacher</option>
                  {staff.map((s: any) => (
                    <option key={s.profile_id} value={s.profile_id}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="pt-2">
              <button
                type="submit"
                className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
              >
                Save changes
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Status & delete ── */}
      {canManage && (
        <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {lesson.status === 'draft' ? (
              <form action={setPublished}>
                <button
                  type="submit"
                  className="text-sm text-white bg-success-text hover:opacity-90 rounded-lg px-4 py-2 transition-opacity"
                  title={!lesson.video_path ? 'Upload a video first' : undefined}
                >
                  Publish lesson
                </button>
              </form>
            ) : (
              <form action={setDraft}>
                <button
                  type="submit"
                  className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors"
                >
                  Unpublish
                </button>
              </form>
            )}
            <DeleteLessonButton lessonId={lessonId} />
          </div>
        </section>
      )}
    </div>
  )
}
