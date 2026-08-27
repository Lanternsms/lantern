import { createClient } from '@/lib/supabase/server'
import {
  seedDefaultAttendanceStatuses,
  createAttendanceStatus,
  updateAttendanceStatus,
  deleteAttendanceStatus,
} from '@/app/dashboard/academics/attendance-statuses/actions'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'

export default async function AttendanceStatusesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: statuses, error: fetchError } = await supabase
    .from('attendance_statuses')
    .select('id, code, label, counts_as_present')
    .order('label')

  return (
    <div className="px-8 py-8 max-w-2xl">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Attendance Categories
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Attendance Categories</h1>
      <p className="text-sm text-text-secondary mb-6">
        Define the options teachers can choose from when marking attendance, and whether each one
        counts toward a student&apos;s attendance rate.
      </p>

      {(error || fetchError) && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error ?? fetchError?.message}
        </p>
      )}

      {!fetchError && statuses?.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center mb-6">
          <p className="text-sm text-text-secondary mb-4">
            No attendance categories yet. Start with the standard set, or build your own.
          </p>
          <form action={seedDefaultAttendanceStatuses}>
            <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
              Create Standard Set (Present, Absent, Late, Excused)
            </button>
          </form>
        </div>
      )}

      {statuses && statuses.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Label</th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Counts as Present</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={3}>
                    <div className="flex items-center gap-3">
                      <form action={updateAttendanceStatus} className="flex items-center gap-3 flex-1">
                        <input type="hidden" name="status_id" value={s.id} />
                        <input
                          name="label"
                          defaultValue={s.label}
                          className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <label className="flex items-center gap-2 text-xs text-text-secondary whitespace-nowrap">
                          <input
                            type="checkbox"
                            name="counts_as_present"
                            defaultChecked={s.counts_as_present}
                            className="rounded border-border"
                          />
                          Counts as present
                        </label>
                        <button type="submit" className="text-xs text-primary hover:text-primary-hover font-medium whitespace-nowrap">
                          Save
                        </button>
                      </form>
                      <form action={deleteAttendanceStatus}>
                        <input type="hidden" name="status_id" value={s.id} />
                        <button type="submit" className="text-text-secondary hover:text-danger-text">
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

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-medium text-text-primary mb-4">Add Category</h3>
        <form action={createAttendanceStatus} className="flex items-center gap-3">
          <input
            name="label"
            required
            placeholder="e.g. Half Day"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary whitespace-nowrap">
            <input type="checkbox" name="counts_as_present" className="rounded border-border" />
            Counts as present
          </label>
          <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors whitespace-nowrap">
            Add
          </button>
        </form>
      </section>
    </div>
  )
}