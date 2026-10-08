import { createClient } from '@/lib/supabase/server'
import StructuresManager from './structures-manager'

export const dynamic = 'force-dynamic'

export default async function FeeStructuresPage() {
  const supabase = await createClient()

  const { data: sessions } = await supabase.from('academic_sessions').select('id, name, is_current').order('name', { ascending: false })
  const { data: terms } = await supabase.from('terms').select('id, name, session_id').order('name')
  const { data: classes } = await supabase.from('classes').select('id, name, level').order('level')
  const { data: structures } = await supabase
    .from('fee_structures')
    .select('id, name, amount, session_id, term_id, class_id, academic_sessions(name), terms(name), classes(name)')
    .order('name')

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Fee Structures</h1>
      <p className="text-sm text-text-secondary">
        Define each fee component (Tuition, PTA, Feeding, etc.) per class and term. A student's total fee for a term is the sum of all matching components.
      </p>
      <StructuresManager structures={structures ?? []} sessions={sessions ?? []} terms={terms ?? []} classes={classes ?? []} />
    </div>
  )
}