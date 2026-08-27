'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getSchoolId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  return profile.school_id
}

export async function updateResultComputationRules(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const values = {
    school_id: schoolId,
    ranking_enabled: formData.get('ranking_enabled') === 'on',
    rank_by: formData.get('rank_by') as string,
    exclude_electives_from_rank: formData.get('exclude_electives_from_rank') === 'on',
    show_rank_to_students: formData.get('show_rank_to_students') === 'on',
    show_rank_to_parents: formData.get('show_rank_to_parents') === 'on',
  }

  // There's no unique constraint on school_id alone in the schema (a
  // school could technically have zero or multiple rows), so check
  // explicitly rather than relying on upsert's default conflict target.
  const { data: existing } = await supabase
    .from('result_computation_rules')
    .select('id')
    .eq('school_id', schoolId)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('result_computation_rules').update(values).eq('id', existing.id)
    : await supabase.from('result_computation_rules').insert(values)

  if (error) {
    redirect(`/dashboard/academics/results-config?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/results-config')
  redirect('/dashboard/academics/results-config?success=1')
}