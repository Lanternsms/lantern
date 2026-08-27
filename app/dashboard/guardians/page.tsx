import { createClient } from '@/lib/supabase/server'
import { linkExistingGuardian } from '@/app/dashboard/guardians/actions'
import Link from 'next/link'

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; student_id?: string; error?: string }>
}) {
  const { q = '', student_id, error } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('guardians')
    .select('id, first_name, last_name, phone, email, relationship')
    .order('last_name')

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data: guardians, error: fetchError } = await query

  return (
    <div className="px-8 py-8">
      {student_id && (
        <Link href={`/dashboard/students/${student_id}`} className="text-sm text-primary hover:text-primary-hover">
          ← Back to student
        </Link>
      )}

      <div className="flex items-start justify-between mt-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Guardians</h1>
          <p className="text-sm text-text-secondary mt-1">
            {student_id
              ? 'Find an existing guardian to link to this student.'
              : 'All guardians on record across your school.'}
          </p>
        </div>
        {!student_id && (
          <Link href="/dashboard/guardians/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
            + Add Guardian
          </Link>
        )}
      </div>

      <form method="get" className="flex gap-3 mb-5">
        {student_id && <input type="hidden" name="student_id" value={student_id} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or phone"
          className="flex-1 max-w-sm rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          Search
        </button>
      </form>

      {(error || fetchError) && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error ?? fetchError?.message}
        </p>
      )}

      {guardians && guardians.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Relationship</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Phone</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Email</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {guardians.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3 text-text-primary">{g.first_name} {g.last_name}</td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{g.relationship ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{g.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{g.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {student_id ? (
                      <form action={linkExistingGuardian}>
                        <input type="hidden" name="student_id" value={student_id} />
                        <input type="hidden" name="guardian_id" value={g.id} />
                        <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium">
                          Link to student
                        </button>
                      </form>
                    ) : (
                      <Link href={`/dashboard/guardians/${g.id}`} className="text-xs text-primary hover:text-primary-hover font-medium">
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">No guardians found.</p>
      )}
    </div>
  )
}