import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 50

export default async function SchoolAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('school_audit_log')
    .select('id, action, actor_name, metadata, created_at', { count: 'exact' })
    .eq('school_id', profile.school_id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.action) query = query.eq('action', params.action)

  const { data: logs, count } = await query
  const rows = logs ?? []

  const { data: actionOptions } = await supabase
    .from('school_audit_log')
    .select('action')
    .eq('school_id', profile.school_id)
    .limit(2000)
  const distinctActions = Array.from(new Set((actionOptions ?? []).map((r) => r.action))).sort()

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const qs = (p: number) => {
    const sp = new URLSearchParams()
    if (params.action) sp.set('action', params.action)
    sp.set('page', String(p))
    return `?${sp.toString()}`
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Audit Log</h1>
        <p className="text-sm text-text-secondary mt-1">A record of changes made by your staff and admins.</p>
      </div>

      <form className="flex items-center gap-3" method="get">
        <select name="action" defaultValue={params.action ?? ''} className="border border-border rounded-lg px-3 py-2 text-sm bg-surface text-text-primary">
          <option value="">All actions</option>
          {distinctActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button type="submit" className="text-sm font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg px-3 py-2">
          Filter
        </button>
      </form>

      <div className="border border-border rounded-xl divide-y divide-border">
        {rows.map((row) => (
          <details key={row.id} className="px-4 py-3">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-muted text-text-primary">{row.action}</span>
                {row.actor_name && <span className="text-sm text-text-secondary">{row.actor_name}</span>}
              </div>
              <span className="text-xs text-text-secondary">{new Date(row.created_at).toLocaleString()}</span>
            </summary>
            <pre className="mt-2 text-xs bg-surface-muted rounded-lg p-3 overflow-x-auto text-text-secondary">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          </details>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-text-secondary text-sm">No activity logged yet.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-text-secondary">
          {page > 1 && <a href={qs(page - 1)} className="hover:text-text-primary">← Prev</a>}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && <a href={qs(page + 1)} className="hover:text-text-primary">Next →</a>}
        </div>
      )}
    </div>
  )
}