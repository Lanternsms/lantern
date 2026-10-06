import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

export const metadata = {
  title: 'Class Results | Lantern',
  description: 'View a full result summary for any class you teach.',
}

export default async function ClassResultsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const { term: termId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // All terms so the teacher can pick a historical one
  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, is_current, session_id, start_date, academic_sessions(name)')
    .order('start_date', { ascending: false })

  const selectedTermId = termId ?? terms?.find((t) => t.is_current)?.id ?? terms?.[0]?.id ?? null

  // Class-subject assignments for this teacher in the selected term's session
  const selectedTerm = terms?.find((t) => t.id === selectedTermId)
  const sessionId = selectedTerm?.session_id ?? null

  const { data: assignments } = sessionId
    ? await supabase
        .from('class_subjects')
        .select('id, classes(name), arms(name), subjects(name)')
        .eq('teacher_id', user.id)
        .eq('session_id', sessionId)
    : { data: null }

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary mb-1">Class Results</h1>
          <p className="text-sm text-text-secondary">
            Full result summary for your assigned classes — scores, averages, rankings, and grade distributions.
          </p>
        </div>

        {/* Term selector */}
        {terms && terms.length > 0 && (
          <form method="GET" className="flex items-center gap-2">
            <label htmlFor="term" className="text-sm text-text-secondary whitespace-nowrap">
              Term:
            </label>
            <select
              id="term"
              name="term"
              defaultValue={selectedTermId ?? ''}
              onChange={undefined}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {terms.map((t) => {
                const session = t.academic_sessions as { name: string } | null
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}{session ? ` — ${session.name}` : ''}
                    {t.is_current ? ' (Current)' : ''}
                  </option>
                )
              })}
            </select>
            <button
              type="submit"
              className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-3 py-1.5 transition-colors"
            >
              Go
            </button>
          </form>
        )}
      </div>

      {!selectedTermId && (
        <p className="text-sm text-text-secondary">No term is set. Ask an admin to configure the current term.</p>
      )}

      {selectedTermId && (!assignments || assignments.length === 0) && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <BarChart3 size={36} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            You are not assigned to teach any subjects in this term.
          </p>
        </div>
      )}

      {assignments && assignments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/class-results/${a.id}${selectedTermId ? `?term=${selectedTermId}` : ''}`}
              className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {a.subjects?.name}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {a.classes?.name}
                    {a.arms?.name ? ` ${a.arms.name}` : ''}
                  </p>
                </div>
                <BarChart3 size={16} className="text-text-muted group-hover:text-primary transition-colors mt-0.5" />
              </div>
              <p className="text-xs text-primary mt-4 font-medium">View summary →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
