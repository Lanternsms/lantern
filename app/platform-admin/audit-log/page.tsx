import { redirect } from 'next/navigation'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlatformAdminNav } from '../_components/platform-admin-nav'
import { lockPlatformAdmin } from '../actions'

const PAGE_SIZE = 50

type LogRow = {
  id: string
  action: string
  metadata: Record<string, unknown>
  created_at: string
  schools: { name: string } | null
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>
}) {
  const valid = await hasValidPlatformAdminSession()
  if (!valid) redirect('/platform-admin')

  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const admin = createAdminClient()

  let query = admin
    .from('platform_audit_log')
    .select('id, action, metadata, created_at, schools(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.action) query = query.eq('action', params.action)

  const { data: logs, count } = await query
  const rows = (logs ?? []) as unknown as LogRow[]

  const { data: actionOptions } = await admin.from('platform_audit_log').select('action').limit(2000)
  const distinctActions = Array.from(new Set((actionOptions ?? []).map((r) => r.action))).sort()

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const qs = (p: number) => {
    const sp = new URLSearchParams()
    if (params.action) sp.set('action', params.action)
    sp.set('page', String(p))
    return `?${sp.toString()}`
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
        <form action={lockPlatformAdmin}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-800">Lock</button>
        </form>
      </div>
      <PlatformAdminNav active="audit-log" />

      <form className="flex items-center gap-3 mb-4" method="get">
        <select name="action" defaultValue={params.action ?? ''} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All actions</option>
          {distinctActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button type="submit" className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50">
          Filter
        </button>
      </form>

      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
        {rows.map((row) => (
          <details key={row.id} className="px-4 py-3">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700">{row.action}</span>
                {row.schools?.name && <span className="text-sm text-gray-700">{row.schools.name}</span>}
              </div>
              <span className="text-xs text-gray-400">{new Date(row.created_at).toLocaleString()}</span>
            </summary>
            <pre className="mt-2 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          </details>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">No log entries yet.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
          {page > 1 && <a href={qs(page - 1)} className="hover:text-gray-800">← Prev</a>}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && <a href={qs(page + 1)} className="hover:text-gray-800">Next →</a>}
        </div>
      )}
    </div>
  )
}