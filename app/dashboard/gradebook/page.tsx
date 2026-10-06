import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function GradebookListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: term } = await supabase.from('terms').select('id, session_id').eq('is_current', true).single()

  const { data: assignments } = term
    ? await supabase
        .from('class_subjects')
        .select('id, classes(name), arms(name), subjects(name)')
        .eq('teacher_id', user!.id)
        .eq('session_id', term.session_id)
    : { data: null }

  return (
    <div className="px-8 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Gradebook</h1>
      <p className="text-sm text-text-secondary mb-6">Your classes for the current term.</p>

      {!term && <p className="text-sm text-text-secondary">No current term is set for your school.</p>}
      {term && (!assignments || assignments.length === 0) && (
        <p className="text-sm text-text-secondary">You are not assigned to teach any subjects this term.</p>
      )}

      <div className="grid grid-cols-3 gap-4">
        {assignments?.map((a) => (
          <Link key={a.id} href={`/dashboard/gradebook/${a.id}`} className="bg-surface border border-border rounded-xl p-5 hover:border-primary/40 transition-colors">
            <h3 className="text-sm font-semibold text-text-primary">{a.subjects?.name}</h3>
            <p className="text-xs text-text-secondary mt-1">{a.classes?.name}{a.arms?.name ? ` ${a.arms.name}` : ''}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}