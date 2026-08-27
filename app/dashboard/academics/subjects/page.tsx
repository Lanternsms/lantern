import { createClient } from '@/lib/supabase/server'
import { deleteSubject } from '@/app/dashboard/academics/subjects/actions'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

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
    <div className="px-8 py-8">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Subjects
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Subjects</h1>
          <p className="text-sm text-text-secondary mt-1">Manage subjects offered at your school.</p>
        </div>
        <Link href="/dashboard/academics/subjects/new" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
          + Add Subject
        </Link>
      </div>

      {(error || fetchError) && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error ?? fetchError?.message}
        </p>
      )}

      {!fetchError && subjects?.length === 0 && <p className="text-sm text-text-secondary">No subjects added yet.</p>}

      {subjects && subjects.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Subject</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Code</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3 text-text-primary font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.code ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
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