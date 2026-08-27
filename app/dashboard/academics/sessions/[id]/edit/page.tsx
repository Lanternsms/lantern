import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateSession } from '@/app/dashboard/academics/actions'
import Link from 'next/link'

export default async function EditSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: session, error: fetchError } = await supabase
    .from('academic_sessions')
    .select('id, name, start_date, end_date')
    .eq('id', id)
    .single()

  if (fetchError || !session) notFound()

  const updateSessionWithId = updateSession.bind(null, id)

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link href="/dashboard/academics/sessions" className="text-sm text-primary hover:text-primary-hover">
        ← Back to sessions
      </Link>
      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-6">Edit Session</h1>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <form action={updateSessionWithId} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Session Name *</label>
          <input name="name" defaultValue={session.name} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Start Date *</label>
            <input name="start_date" type="date" defaultValue={session.start_date} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">End Date *</label>
            <input name="end_date" type="date" defaultValue={session.end_date} required className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  )
}