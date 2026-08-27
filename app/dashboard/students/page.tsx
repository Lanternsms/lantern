import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const PAGE_SIZE = 20

const avatarColors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700']
function avatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; arm?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q ?? ''
  const classFilter = params.class ?? ''
  const armFilter = params.arm ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const supabase = await createClient()

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('is_current', true)
    .single()

  // Classes/arms for the filter dropdowns — RLS already scopes this to
  // the logged-in user's own school, no manual filtering needed here.
  const { data: classes } = await supabase.from('classes').select('id, name').order('name')
  const { data: arms } = await supabase.from('arms').select('id, name, class_id').order('name')

  if (!session) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">No current academic session set.</p>
      </div>
    )
  }

  let query = supabase
    .from('students')
    .select(
      `id, admission_no, first_name, last_name, status,
       enrolments!inner ( class_id, arm_id, classes ( name ), arms ( name ) )`,
      { count: 'exact' }
    )
    .eq('enrolments.session_id', session.id)

  if (q) {
    // Search across name OR admission number — admission numbers matter
    // just as much as names to school staff, per the earlier context brief
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_no.ilike.%${q}%`)
  }
  if (classFilter) query = query.eq('enrolments.class_id', classFilter)
  if (armFilter) query = query.eq('enrolments.arm_id', armFilter)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: students, count, error } = await query
    .order('last_name')
    .range(from, to)

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  // Build a query string preserving existing filters, for pagination links
  function pageHref(targetPage: number) {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (classFilter) sp.set('class', classFilter)
    if (armFilter) sp.set('arm', armFilter)
    sp.set('page', String(targetPage))
    return `/dashboard/students?${sp.toString()}`
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Students</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage and view student records across your school.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/students/import" className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
            Import
          </Link>
          <Link href="/dashboard/students/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
            + Add Student
          </Link>
        </div>
      </div>

      {/* Filter bar — plain GET form, works without JS */}
      <form method="get" className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or admission number"
          className="flex-1 min-w-[220px] rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select name="class" defaultValue={classFilter} className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="">All Classes</option>
          {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="arm" defaultValue={armFilter} className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="">All Arms</option>
          {arms?.filter(a => !classFilter || a.class_id === classFilter).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          Filter
        </button>
      </form>

      {error && <p className="text-sm text-danger-text">Error: {error.message}</p>}

      {!error && students?.length === 0 && (
        <p className="text-sm text-text-secondary">No students match your search.</p>
      )}

      {students && students.length > 0 && (
        <>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Student</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Admission No.</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Class</th>
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const enrolment = s.enrolments?.[0]
                  const initials = `${s.first_name[0]}${s.last_name[0]}`
                  const isActive = s.status === 'active'
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${avatarColor(s.first_name)}`}>
                            {initials}
                          </span>
                          <span className="text-text-primary font-medium">{s.first_name} {s.last_name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{s.admission_no}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {enrolment?.classes?.name}{enrolment?.arms?.name ? ` ${enrolment.arms.name}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${isActive ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
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
            <span>{from + 1}–{Math.min(to + 1, count ?? 0)} of {count} students</span>
            <div className="flex gap-2">
              <Link
                href={pageHref(page - 1)}
                aria-disabled={page <= 1}
                className={`px-3 py-1.5 rounded-lg border border-border ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-surface-muted'}`}
              >
                Previous
              </Link>
              <Link
                href={pageHref(page + 1)}
                aria-disabled={page >= totalPages}
                className={`px-3 py-1.5 rounded-lg border border-border ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-surface-muted'}`}
              >
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}