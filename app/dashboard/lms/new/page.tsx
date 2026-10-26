import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createLesson } from '../actions'
import { getLmsAccess } from '@/lib/lms/access'

export const dynamic = 'force-dynamic'

export default async function NewLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const access = await getLmsAccess()
  if (!access.isManager) {
    notFound()
  }
  const { supabase } = access

  const [{ data: classes }, { data: subjects }, { data: terms }] = await Promise.all([
    supabase.from('classes').select('id, name').order('name'),
    supabase.from('subjects').select('id, name').order('name'),
    supabase.from('terms').select('id, name').order('name'),
  ])

  // Load school staff for the "recorded by" picker
  const { data: staffRows } = await supabase
    .from('staff')
    .select('profile_id, first_name, last_name')
    .eq('status', 'active')
    .order('first_name')

  const staff = (staffRows ?? []).filter((s) => s.profile_id)

  return (
    <div className="px-8 py-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/lms" className="hover:text-primary">Lessons</Link> / New Lesson
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-6">New Lesson</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form action={createLesson} className="space-y-6">
        <section className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Lesson Details</h2>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              Title <span className="text-danger-text">*</span>
            </label>
            <input
              name="title"
              required
              placeholder="e.g. Introduction to Photosynthesis"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Topic / Sub-topic</label>
            <input
              name="topic"
              placeholder="e.g. Light-dependent reactions"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Class <span className="text-danger-text">*</span>
              </label>
              <select
                name="class_id"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select class</option>
                {(classes ?? []).map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Subject <span className="text-danger-text">*</span>
              </label>
              <select
                name="subject_id"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select subject</option>
                {(subjects ?? []).map((s: { id: string; name: string }) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Term (optional)</label>
              <select
                name="term_id"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Any term</option>
                {(terms ?? []).map((t: { id: string; name: string }) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Week (1–20, optional)</label>
              <input
                name="week_no"
                type="number"
                min={1}
                max={20}
                placeholder="e.g. 3"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {staff.length > 0 && (
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Recorded by (optional)</label>
              <select
                name="recorded_by"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select teacher</option>
                {staff.map((s) => (
                  <option key={s.profile_id} value={s.profile_id!}>
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
                defaultChecked={true}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="font-medium">Enable AI Tutor (Lumi) for this lesson</span>
            </label>
            <p className="text-xs text-text-secondary ml-6 mt-0.5">
              Allows students and classroom facilitators to ask questions grounded in this lesson's notes.
            </p>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">Fields marked * are required</p>
          <div className="flex gap-3">
            <Link
              href="/dashboard/lms"
              className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors"
            >
              Create Lesson
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
