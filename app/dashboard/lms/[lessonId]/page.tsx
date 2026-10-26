/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateLesson, setLessonStatus } from '../actions'
import { DeleteLessonButton } from '../delete-lesson-button'
import { LessonPlayerModal } from '../lesson-player-modal'
import { LessonVideoUpload } from '../lesson-video-upload'
import { LessonNotesUpload } from './lesson-notes-upload'
import { NotesDownloadButton } from '../notes-download-button'
import { LessonAiPanel } from '../lesson-ai-panel'
import { ActivityManager } from '../activities/activity-manager'
import { getLessonAttendanceSummary } from '../attendance/actions'
import {
  getLmsAccess,
  canViewLesson,
  canManageLesson,
  canManageActivities,
} from '@/lib/lms/access'

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

  const access = await getLmsAccess()
  const { user, schoolId, supabase } = access
  const admin = createAdminClient()

  const { data: lesson, error: fetchErr } = await (admin as any)
    .from('lms_lessons')
    .select(`
      id, title, topic, week_no, status, duration_seconds, created_at,
      video_path, class_id, subject_id, term_id, recorded_by, school_id,
      notes_path, notes_name, notes_size_bytes, notes_uploaded_at, notes_downloadable,
      ai_tutor_enabled,
      classes:class_id ( name ),
      subjects:subject_id ( name ),
      terms:term_id ( name ),
      recorder:recorded_by ( first_name, last_name ),
      uploader:uploaded_by ( first_name, last_name )
    `)
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (fetchErr || !lesson) notFound()

  // Verify caller is authorized to view this lesson
  const canView = await canViewLesson(lesson, access)
  if (!canView) notFound()

  const canManage = canManageLesson(lesson, access)
  const canUpload = access.isManager
  const canManageAct = canManageActivities(lesson, access)

  // Fetch notes extraction status (managers only — never expose to learners)
  let notesExtractionStatus: 'pending' | 'ready' | 'scanned' | 'too_long' | 'failed' | null = null
  let notesExtractionError: string | null = null
  if (canManage || canUpload) {
    const { data: notesText } = await (admin as any)
      .from('lms_lesson_notes_text')
      .select('status, error')
      .eq('lesson_id', lessonId)
      .eq('school_id', schoolId)
      .maybeSingle()
    notesExtractionStatus = notesText?.status ?? null
    notesExtractionError = notesText?.error ?? null
  }
  const canViewActResults = canManageAct // Only manager and recorder can view activity results/submissions
  const attendanceSummary = await getLessonAttendanceSummary({ lessonId })

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

  // Load the primary LMS timetable entry for this lesson (for attendance Edit link)
  let primaryLmsEntryId: string | null = null
  if (currentSession && lesson.class_id && lesson.subject_id) {
    const { data: entryRow } = await (supabase as any)
      .from('timetable_entries')
      .select('id')
      .eq('school_id', schoolId)
      .eq('session_id', currentSession.id)
      .eq('class_id', lesson.class_id)
      .eq('subject_id', lesson.subject_id)
      .eq('delivery_mode', 'lms')
      .limit(1)
      .maybeSingle()
    primaryLmsEntryId = entryRow?.id ?? null
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

  // Recorders without lms.* perms see ONLY the Activities section + notes download per spec
  const isRecorder = lesson.recorded_by === access.userId
  if (!access.isManager && isRecorder) {
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

        {lesson.notes_path && (
          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Lesson Notes</h2>
            <NotesDownloadButton
              lessonId={lessonId}
              notesSizeBytes={lesson.notes_size_bytes}
            />
          </section>
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

  let schoolStorageUsedStr: string | null = null
  if (canManage || canUpload) {
    const { data: usageData } = await (supabase as any).rpc('lms_storage_usage')
    if (usageData && Array.isArray(usageData)) {
      const totalBytes = usageData.reduce((acc: number, row: any) => acc + (Number(row.bytes) || 0), 0)
      const gb = totalBytes / (1024 * 1024 * 1024)
      schoolStorageUsedStr =
        gb >= 0.01
          ? `School storage used: ${gb.toFixed(2)} GB`
          : `School storage used: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
    }
  }

  return (
    <div className="px-8 py-8 max-w-4xl space-y-8">
      {/* Breadcrumb + title */}
      <div>
        <p className="text-sm text-text-secondary mb-1">
          {access.isManager ? (
            <Link href="/dashboard/lms" className="hover:text-primary">Lessons</Link>
          ) : lesson.recorded_by === access.userId ? (
            <Link href="/dashboard/lms/my-lessons" className="hover:text-primary">My Lessons</Link>
          ) : (
            <Link href="/dashboard/lms/today" className="hover:text-primary">Today&apos;s Lessons</Link>
          )} / {lesson.title}
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
              currentVideoPath={lesson.video_path}
              hasExistingVideo={!!lesson.video_path}
              schoolStorageUsed={schoolStorageUsedStr}
            />
          </div>
        )}
      </section>

      {/* ── Lesson Notes section ── */}
      <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Lesson Notes (PDF)</h2>
        <LessonNotesUpload
          lessonId={lessonId}
          notesPath={lesson.notes_path ?? null}
          notesName={lesson.notes_name ?? null}
          notesSizeBytes={lesson.notes_size_bytes ?? null}
          notesUploadedAt={lesson.notes_uploaded_at ?? null}
          notesDownloadable={lesson.notes_downloadable ?? false}
          extractionStatus={notesExtractionStatus}
          extractionError={notesExtractionError}
        />
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

      {/* ── Attendance section ── */}
      {attendanceSummary.ok && (
        <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Attendance</h2>
          {attendanceSummary.rows.length === 0 ? (
            <p className="text-sm text-text-secondary">No period attendance has been recorded for this lesson yet.</p>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/40 text-text-secondary text-xs border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-right px-4 py-2.5 font-medium">Present</th>
                    <th className="text-right px-4 py-2.5 font-medium">Late</th>
                    <th className="text-right px-4 py-2.5 font-medium">Absent</th>
                    <th className="text-right px-4 py-2.5 font-medium">Total</th>
                    {attendanceSummary.canManage && primaryLmsEntryId && (
                      <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendanceSummary.rows.map((row) => (
                    <tr key={row.date} className="hover:bg-surface-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                        {new Date(row.date + 'T12:00:00').toLocaleDateString(undefined, {
                          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{row.present}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{row.late}</td>
                      <td className="px-4 py-3 text-right text-red-600">{row.absent}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{row.total}</td>
                      {attendanceSummary.canManage && primaryLmsEntryId && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/dashboard/lms/today/attendance/${primaryLmsEntryId}?date=${row.date}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Edit
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── AI Tutor section ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">AI Lesson Tutor (Lumi)</h2>
          <span className="text-xs text-text-secondary">
            {lesson.ai_tutor_enabled ? 'Active on this lesson' : 'Disabled for this lesson'}
          </span>
        </div>
        <LessonAiPanel
          lessonId={lessonId}
          lessonTitle={lesson.title}
          mode="class"
          aiTutorEnabled={lesson.ai_tutor_enabled}
          notesReady={notesExtractionStatus === 'ready'}
        />
      </section>

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

            <div className="pt-2 border-t border-border">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
                <input
                  type="checkbox"
                  name="ai_tutor_enabled"
                  defaultChecked={lesson.ai_tutor_enabled}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="font-medium">Enable AI Tutor (Lumi) for this lesson</span>
              </label>
              <p className="text-xs text-text-secondary ml-6 mt-0.5">
                Students and classroom facilitators can ask questions grounded in this lesson's notes.
              </p>
            </div>

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
