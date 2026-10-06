import { createClient } from '@/lib/supabase/server'
import { setCurrentSession } from '@/app/dashboard/academics/actions'
import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'

export default async function SessionsPage() {
  const supabase = await createClient()

  const { data: sessions, error } = await supabase
    .from('academic_sessions')
    .select(`
      id,
      name,
      start_date,
      end_date,
      is_current,
      terms (
        id,
        name,
        start_date,
        end_date,
        is_current
      )
    `)
    .order('start_date', { ascending: false })

  return (
    <div className="px-8 py-8">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Sessions &amp; Terms
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Academic Sessions &amp; Terms</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage sessions and terms, add new terms, and set which ones are currently active.
          </p>
        </div>
        <Link href="/dashboard/academics/sessions/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          + Add Session
        </Link>
      </div>

      {error && <p className="text-sm text-danger-text">Error: {error.message}</p>}
      {!error && sessions?.length === 0 && <p className="text-sm text-text-secondary">No academic sessions yet.</p>}

      {sessions && sessions.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Session</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Dates</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Terms</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const sortedTerms = [...(s.terms ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date))

                return (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-muted align-top">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/academics/sessions/${s.id}`} className="text-text-primary font-medium hover:text-primary">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                      {s.start_date} &rarr; {s.end_date}
                    </td>
                    <td className="px-4 py-3">
                      {s.is_current ? (
                        <span className="text-xs font-medium bg-success-bg text-success-text rounded-full px-2.5 py-1">Current</span>
                      ) : (
                        <form action={setCurrentSession}>
                          <input type="hidden" name="session_id" value={s.id} />
                          <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium">
                            Set as Current
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {sortedTerms.length > 0 ? (
                          sortedTerms.map((t) => (
                            <Link
                              key={t.id}
                              href={`/dashboard/academics/sessions/${s.id}/terms/${t.id}/edit`}
                              className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${
                                t.is_current
                                  ? 'bg-success-bg text-success-text border-success-border font-medium'
                                  : 'bg-surface-muted text-text-secondary border-border hover:border-primary/40 hover:text-primary'
                              }`}
                              title={`${t.name} (${t.start_date} to ${t.end_date}) - Click to edit`}
                            >
                              {t.name}
                              {t.is_current && ' (Current)'}
                            </Link>
                          ))
                        ) : (
                          <span className="text-xs text-text-tertiary italic">No terms</span>
                        )}
                        <Link
                          href={`/dashboard/academics/sessions/${s.id}/terms/new`}
                          className="inline-flex items-center gap-0.5 text-xs text-primary hover:text-primary-hover font-medium ml-1 px-2 py-0.5 rounded hover:bg-primary/10 transition-colors"
                        >
                          <Plus size={12} /> Add Term
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/academics/sessions/${s.id}/edit`} className="text-text-secondary hover:text-primary inline-flex p-1">
                        <Pencil size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}