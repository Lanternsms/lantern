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

// One-click standard set: 2 CAs + 1 Exam, matching what you asked for as
// the default. Only runs if the school has no assessment types at all —
// won't silently overwrite a school's own custom setup.
export async function seedDefaultAssessmentTypes() {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { count } = await supabase
    .from('assessment_types')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  if (count && count > 0) return

  await supabase.from('assessment_types').insert([
    { school_id: schoolId, name: 'CA1', weight: 10 },
    { school_id: schoolId, name: 'CA2', weight: 10 },
    { school_id: schoolId, name: 'Exam', weight: 80 },
  ])

  revalidatePath('/dashboard/academics/assessments')
}

export async function createAssessmentType(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { error } = await supabase.from('assessment_types').insert({
    school_id: schoolId,
    name: (formData.get('name') as string).trim(),
    weight: parseFloat(formData.get('weight') as string),
  })

  if (error) {
    redirect(`/dashboard/academics/assessments?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/assessments')
}

export async function updateAssessmentType(formData: FormData) {
  const supabase = await createClient()
  const typeId = formData.get('type_id') as string

  const { error } = await supabase
    .from('assessment_types')
    .update({
      name: (formData.get('name') as string).trim(),
      weight: parseFloat(formData.get('weight') as string),
    })
    .eq('id', typeId)

  if (error) {
    redirect(`/dashboard/academics/assessments?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/assessments')
}

export async function deleteAssessmentType(formData: FormData) {
  const supabase = await createClient()
  const typeId = formData.get('type_id') as string

  const { error } = await supabase.from('assessment_types').delete().eq('id', typeId)

  if (error) {
    // 23503 = foreign-key violation — results already recorded against
    // this assessment type (e.g. real CA1 scores entered) block deletion,
    // since removing it would orphan those score rows.
    const message =
      error.code === '23503'
        ? 'Scores have already been recorded against this assessment type, so it can\'t be deleted.'
        : error.message
    redirect(`/dashboard/academics/assessments?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/dashboard/academics/assessments')
}