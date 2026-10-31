import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Add01Icon, Search01Icon, Upload01Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'
import { Avatar, ButtonLink, EmptyState, PageHeader, PageShell, StatusPill, buttonClass, field, safeSearch } from '@/components/ui/page'

const PAGE_SIZE = 20


export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; arm?: string; page?: string }>
}) {
  const params = await searchParams
  const q = safeSearch(params.q ?? '')
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
      <PageShell>
        <PageHeader title="Students" />
        <EmptyState title="No current session yet" body="Students are listed by their enrolment in the current session. Set one up under Academics first." action={<ButtonLink href="/dashboard/academics/sessions">Set up a session</ButtonLink>} />
      </PageShell>
    )
  }

  let query = supabase
    .from('students')
    .select(
      `id, admission_no, first_name, last_name, status, photo_url,
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
    <PageShell>
      <PageHeader
        title="Students"
        subtitle={count != null ? `${count.toLocaleString('en-NG')} enrolled this session${q || classFilter || armFilter ? ' match these filters' : ''}` : undefined}
        actions={<>
          <ButtonLink href="/dashboard/students/import" kind="secondary" icon={Upload01Icon}>Import</ButtonLink>
          <ButtonLink href="/dashboard/students/new" icon={Add01Icon}>Add student</ButtonLink>
        </>}
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <label className={`${field} flex min-w-[240px] flex-1 items-center gap-2 sm:max-w-sm`}>
          <Icon icon={Search01Icon} size={17} className="text-text-secondary" />
          <span className="sr-only">Search</span>
          <input type="search" name="q" defaultValue={q} placeholder="Name or admission number" className="min-w-0 flex-1 bg-transparent focus:outline-none" />
        </label>
        <select name="class" defaultValue={classFilter} aria-label="Class" className={field}>
          <option value="">All classes</option>
          {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="arm" defaultValue={armFilter} aria-label="Arm" className={field}>
          <option value="">All arms</option>
          {arms?.filter((a) => !classFilter || a.class_id === classFilter).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button type="submit" className={buttonClass('quiet')}>Apply</button>
        {(q || classFilter || armFilter) && <Link href="/dashboard/students" className="px-2 text-sm text-text-secondary hover:text-text-primary">Clear</Link>}
      </form>

      {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">Couldn’t load students: {error.message}</p>}

      {!error && students?.length === 0 && (
        <EmptyState
          title={q || classFilter || armFilter ? 'No students match' : 'No students yet'}
          body={q || classFilter || armFilter ? 'Try a different name, admission number or class.' : 'Add students one by one, or import your class lists from a spreadsheet.'}
          action={!(q || classFilter || armFilter) ? <ButtonLink href="/dashboard/students/import" icon={Upload01Icon}>Import from a spreadsheet</ButtonLink> : undefined}
        />
      )}

      {students && students.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-[13px] text-text-secondary">
                  <th className="px-5 py-3.5 text-left font-medium">Student</th>
                  <th className="px-5 py-3.5 text-left font-medium">Admission no.</th>
                  <th className="px-5 py-3.5 text-left font-medium">Class</th>
                  <th className="px-5 py-3.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const enrolment = s.enrolments?.[0]
                  const isActive = s.status === 'active'
                  return (
                    <tr key={s.id} className="border-t border-rule transition-colors hover:bg-school-soft/40">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                          <Avatar first={s.first_name} last={s.last_name} photo={s.photo_url} />
                          {s.first_name} {s.last_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-[#374151]">{s.admission_no}</td>
                      <td className="px-5 py-3">{enrolment?.classes?.name}{enrolment?.arms?.name ?? ''}</td>
                      <td className="px-5 py-3"><StatusPill tone={isActive ? 'success' : 'danger'}>{isActive ? 'Active' : s.status}</StatusPill></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3 text-sm text-text-secondary">
            <span className="tabular-nums">{from + 1}–{Math.min(to + 1, count ?? 0)} of {count?.toLocaleString('en-NG')}</span>
            <div className="flex gap-2">
              <Link href={pageHref(page - 1)} aria-disabled={page <= 1} className={`${buttonClass('quiet')} h-9 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>Previous</Link>
              <Link href={pageHref(page + 1)} aria-disabled={page >= totalPages} className={`${buttonClass('quiet')} h-9 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>Next</Link>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
