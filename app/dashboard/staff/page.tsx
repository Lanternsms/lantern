import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { safeSearch } from '@/lib/safe-search'

const PAGE_SIZE = 20
const avatarColors = ['bg-success-bg text-success-text', 'bg-school-soft text-school-ink', 'bg-warning-bg text-warning-text', 'bg-school-soft text-school-ink', 'bg-pink-100 text-pink-700']
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
    query = query.or(`first_name.ilike.%${safeSearch(q)}%,last_name.ilike.%${safeSearch(q)}%,staff_no.ilike.%${safeSearch(q)}%`)
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
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Staff</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Manage staff records across your school.</p>
        </div>
        <Link href="/dashboard/staff/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">Add Staff
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or staff number"
          className="min-w-[220px] flex-1 sm:max-w-sm h-10 rounded-xl border border-control bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-school-soft"
        />
        <select name="department" defaultValue={departmentFilter} className="h-10 rounded-xl border border-control bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-school-soft">
          <option value="">All Departments</option>
          {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
          Filter
        </button>
      </form>

      {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">Couldn’t load this: {error.message}</p>}
      {!error && staff?.length === 0 && <p className="text-sm text-text-secondary">No staff found.</p>}

      {staff && staff.length > 0 && (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Staff</th>
                  <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Staff No.</th>
                  <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Department</th>
                  <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const initials = `${s.first_name?.[0] ?? ''}${s.last_name?.[0] ?? ''}`
                  const isActive = s.status === 'active'
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-school-soft/40">
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/staff/${s.id}`} className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${avatarColor(s.first_name ?? '?')}`}>
                            {initials}
                          </span>
                          <span className="text-text-primary font-medium">{s.first_name} {s.last_name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">{s.staff_no}</td>
                      <td className="px-5 py-3.5 text-text-secondary">{s.departments?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${isActive ? 'bg-success-bg text-success-text' : 'bg-raised text-[#374151]'}`}>
                          {isActive ? 'Active' : s.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
            <span>{from + 1}–{Math.min(to + 1, count ?? 0)} of {count} staff</span>
            <div className="flex gap-2">
              <Link href={pageHref(page - 1)} aria-disabled={page <= 1} className={`inline-flex h-9 items-center justify-center rounded-xl bg-raised px-3.5 text-sm font-medium text-text-primary hover:bg-school-soft hover:text-school-ink ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>
                Previous
              </Link>
              <Link href={pageHref(page + 1)} aria-disabled={page >= totalPages} className={`inline-flex h-9 items-center justify-center rounded-xl bg-raised px-3.5 text-sm font-medium text-text-primary hover:bg-school-soft hover:text-school-ink ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}