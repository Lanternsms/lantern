import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const PAGE_SIZE = 20
const avatarColors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700']
function avatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q ?? ''
  const departmentFilter = params.department ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const supabase = await createClient()
  const { data: departments } = await supabase.from('departments').select('id, name').order('name')

  let query = supabase
    .from('staff')
    .select('id, staff_no, first_name, last_name, status, qualification, departments(name)', { count: 'exact' })

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,staff_no.ilike.%${q}%`)
  }
  if (departmentFilter) query = query.eq('department_id', departmentFilter)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data: staff, count, error } = await query.order('last_name').range(from, to)
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  function pageHref(targetPage: number) {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (departmentFilter) sp.set('department', departmentFilter)
    sp.set('page', String(targetPage))
    return `/dashboard/staff?${sp.toString()}`
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Staff</h1>
          <p className="text-sm text-text-secondary mt-1">Manage staff records across your school.</p>
        </div>
        <Link href="/dashboard/staff/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          + Add Staff
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or staff number"
          className="flex-1 min-w-[220px] rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select name="department" defaultValue={departmentFilter} className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="">All Departments</option>
          {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          Filter
        </button>
      </form>

      {error && <p className="text-sm text-danger-text">Error: {error.message}</p>}
      {!error && staff?.length === 0 && <p className="text-sm text-text-secondary">No staff found.</p>}

      {staff && staff.length > 0 && (
        <>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Staff</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Staff No.</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Department</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const initials = `${s.first_name?.[0] ?? ''}${s.last_name?.[0] ?? ''}`
                  const isActive = s.status === 'active'
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/staff/${s.id}`} className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${avatarColor(s.first_name ?? '?')}`}>
                            {initials}
                          </span>
                          <span className="text-text-primary font-medium">{s.first_name} {s.last_name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{s.staff_no}</td>
                      <td className="px-4 py-3 text-text-secondary">{s.departments?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${isActive ? 'bg-success-bg text-success-text' : 'bg-secondary/10 text-secondary'}`}>
                          {isActive ? 'Active' : s.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-text-secondary">
            <span>{from + 1}–{Math.min(to + 1, count ?? 0)} of {count} staff</span>
            <div className="flex gap-2">
              <Link href={pageHref(page - 1)} aria-disabled={page <= 1} className={`px-3 py-1.5 rounded-lg border border-border ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-surface-muted'}`}>
                Previous
              </Link>
              <Link href={pageHref(page + 1)} aria-disabled={page >= totalPages} className={`px-3 py-1.5 rounded-lg border border-border ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-surface-muted'}`}>
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}