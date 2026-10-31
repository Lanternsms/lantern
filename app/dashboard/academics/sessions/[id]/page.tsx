import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { setCurrentTerm } from '@/app/dashboard/academics/actions'
import Link from 'next/link'
import { Pencil } from '@/components/icons'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('academic_sessions')
    .select('id, name, start_date, end_date, is_current')
    .eq('id', id)
    .single()

  if (error || !session) notFound()

  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, start_date, end_date, is_current')
    .eq('session_id', id)
    .order('start_date')

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics/sessions" className="hover:text-primary">Sessions</Link> / {session.name}
      </p>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">{session.name}</h1>
        {session.is_current && (
          <span className="text-xs font-medium bg-success-bg text-success-text rounded-full px-2.5 py-0.5">Current Session</span>
        )}
      </div>

      <section className="card p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div>
            <p className="text-text-secondary text-xs mb-0.5">Start Date</p>
            <p className="text-text-primary">{session.start_date}</p>
          </div>
          <div>
            <p className="text-text-secondary text-xs mb-0.5">End Date</p>
            <p className="text-text-primary">{session.end_date}</p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Terms</h2>
        <Link href={`/dashboard/academics/sessions/${id}/terms/new`} className="text-sm text-primary hover:text-primary-hover">Add Term
        </Link>
      </div>

      {terms && terms.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Term</th>
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Start Date</th>
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">End Date</th>
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5 text-text-primary font-medium">{t.name}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{t.start_date}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{t.end_date}</td>
                  <td className="px-5 py-3.5">
                    {t.is_current ? (
                      <span className="text-xs font-medium bg-success-bg text-success-text rounded-full px-2.5 py-1">Current</span>
                    ) : (
                      <form action={setCurrentTerm}>
                        <input type="hidden" name="term_id" value={t.id} />
                        <input type="hidden" name="session_id" value={id} />
                        <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium">
                          Set as Current
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/dashboard/academics/sessions/${id}/terms/${t.id}/edit`} className="text-text-secondary hover:text-primary inline-flex">
                      <Pencil size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card border-dashed p-8 text-center">
          <p className="text-sm text-text-secondary mb-3">No terms added yet for this session.</p>
          <Link
            href={`/dashboard/academics/sessions/${id}/terms/new`}
            className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-xl transition-colors"
          >Add First Term
          </Link>
        </div>
      )}
    </div>
  )
}