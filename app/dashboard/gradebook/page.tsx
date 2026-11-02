import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'

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
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] font-semibold leading-tight sm:text-[36px]">Gradebook</h1>
        <p className="text-[15px] text-text-secondary">The subjects you teach this term. Open one to enter scores.</p>
      </div>

      {!term && <p className="card p-6 text-text-secondary">No current term is set for your school yet.</p>}
      {term && (!assignments || assignments.length === 0) && (
        <p className="card p-6 text-text-secondary">You aren’t assigned to teach any subjects this term. Ask your school admin to add you under Classes and subjects.</p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assignments?.map((a) => (
          <li key={a.id}>
            <Link href={`/dashboard/gradebook/${a.id}`} className="card group flex items-center gap-4 p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-school-deep font-display text-lg font-semibold text-white">
                {(a.subjects?.name ?? '?').slice(0, 2)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-[17px] font-semibold">{a.subjects?.name}</span>
                <span className="text-sm text-text-secondary">{a.classes?.name}{a.arms?.name ?? ''}</span>
              </span>
              <Icon icon={ArrowRight01Icon} size={18} className="text-text-secondary transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
