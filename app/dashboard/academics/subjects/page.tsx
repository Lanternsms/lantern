import { createClient } from '@/lib/supabase/server'
import { deleteSubject } from '@/app/dashboard/academics/subjects/actions'
import Link from 'next/link'
import { Pencil, Trash2 } from '@/components/icons'

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: subjects, error: fetchError } = await supabase
    .from('subjects')
    .select('id, name, code')
    .order('name')

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Subjects
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Subjects</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Manage subjects offered at your school.</p>
        </div>
        <Link href="/dashboard/academics/subjects/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">Add Subject
        </Link>
      </div>

      {(error || fetchError) && (
        <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2 mb-4">
          {error ?? fetchError?.message}
        </p>
      )}

      {!fetchError && subjects?.length === 0 && <p className="text-sm text-text-secondary">No subjects added yet.</p>}

      {subjects && subjects.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Subject</th>
                <th className="text-left font-medium text-text-secondary px-5 py-3.5 text-[13px]">Code</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-school-soft/40">
                  <td className="px-5 py-3.5 text-text-primary font-medium">{s.name}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{s.code ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/dashboard/academics/subjects/${s.id}/edit`} className="text-text-secondary hover:text-primary inline-flex">
                        <Pencil size={14} />
                      </Link>
                      <form action={deleteSubject}>
                        <input type="hidden" name="subject_id" value={s.id} />
                        <button type="submit" className="text-text-secondary hover:text-danger-text inline-flex">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}