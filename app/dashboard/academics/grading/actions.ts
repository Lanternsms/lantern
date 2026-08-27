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

// One-click default: gives a brand-new school a sensible starting scale
// (A-F) instead of an empty grading system. Only runs if the school has
// no scales at all yet — this is a convenience, not something meant to
// silently overwrite a school's own customized default.
export async function seedDefaultScale() {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { count } = await supabase
    .from('grading_scales')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  if (count && count > 0) return

  const { data: scale } = await supabase
    .from('grading_scales')
    .insert({ school_id: schoolId, name: 'Standard Scale', is_default: true })
    .select('id')
    .single()

  if (!scale) return

  await supabase.from('grade_bands').insert([
    { scale_id: scale.id, min_score: 70, max_score: 100, grade: 'A', remark: 'Excellent' },
    { scale_id: scale.id, min_score: 60, max_score: 69, grade: 'B', remark: 'Very Good' },
    { scale_id: scale.id, min_score: 50, max_score: 59, grade: 'C', remark: 'Good' },
    { scale_id: scale.id, min_score: 45, max_score: 49, grade: 'D', remark: 'Fair' },
    { scale_id: scale.id, min_score: 40, max_score: 44, grade: 'E', remark: 'Pass' },
    { scale_id: scale.id, min_score: 0, max_score: 39, grade: 'F', remark: 'Fail' },
  ])

  revalidatePath('/dashboard/academics/grading')
}

export async function createScale(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { data: scale, error } = await supabase
    .from('grading_scales')
    .insert({ school_id: schoolId, name: (formData.get('name') as string).trim(), is_default: false })
    .select('id')
    .single()

  if (error || !scale) {
    redirect(`/dashboard/academics/grading/new?error=${encodeURIComponent(error?.message ?? 'Failed to create scale')}`)
  }

  revalidatePath('/dashboard/academics/grading')
  redirect(`/dashboard/academics/grading/${scale.id}`)
}

export async function updateScale(scaleId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('grading_scales')
    .update({ name: (formData.get('name') as string).trim() })
    .eq('id', scaleId)

  if (error) {
    redirect(`/dashboard/academics/grading/${scaleId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/grading')
  revalidatePath(`/dashboard/academics/grading/${scaleId}`)
  redirect(`/dashboard/academics/grading/${scaleId}`)
}

// Same order-of-operations requirement as setCurrentSession/setCurrentTerm:
// the schema's one_default_scale_per_school unique index means the OLD
// default must be cleared before the NEW one is set, or the insert-order
// would momentarily try to have two defaults at once and get rejected.
export async function setDefaultScale(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const scaleId = formData.get('scale_id') as string

  await supabase.from('grading_scales').update({ is_default: false }).eq('school_id', schoolId).eq('is_default', true)
  await supabase.from('grading_scales').update({ is_default: true }).eq('id', scaleId)

  revalidatePath('/dashboard/academics/grading')
}

export async function deleteScale(formData: FormData) {
  const supabase = await createClient()
  const scaleId = formData.get('scale_id') as string
  const isDefault = formData.get('is_default') === 'true'

  // No foreign key stops this at the database level, so the guard has to
  // live here: deleting the school's only default scale would leave every
  // report card with no grading logic to fall back on.
  if (isDefault) {
    redirect(`/dashboard/academics/grading?error=${encodeURIComponent('Set a different scale as default before deleting this one.')}`)
  }

  await supabase.from('grading_scales').delete().eq('id', scaleId)
  revalidatePath('/dashboard/academics/grading')
}

export async function createGradeBand(formData: FormData) {
  const supabase = await createClient()
  const scaleId = formData.get('scale_id') as string
  const minScore = parseFloat(formData.get('min_score') as string)
  const maxScore = parseFloat(formData.get('max_score') as string)

  if (minScore >= maxScore) {
    redirect(`/dashboard/academics/grading/${scaleId}?error=${encodeURIComponent('Minimum score must be less than maximum score.')}`)
  }

  // Overlap check: the schema has no constraint preventing two bands from
  // covering the same score range, but silently allowing that would make
  // grade lookups ambiguous at report-card time — catch it here instead.
  const { data: existingBands } = await supabase
    .from('grade_bands')
    .select('min_score, max_score, grade')
    .eq('scale_id', scaleId)

  const overlapping = existingBands?.find((b) => minScore <= b.max_score && maxScore >= b.min_score)
  if (overlapping) {
    redirect(
      `/dashboard/academics/grading/${scaleId}?error=${encodeURIComponent(
        `This range overlaps with grade "${overlapping.grade}" (${overlapping.min_score}-${overlapping.max_score}).`
      )}`
    )
  }

  const { error } = await supabase.from('grade_bands').insert({
    scale_id: scaleId,
    min_score: minScore,
    max_score: maxScore,
    grade: (formData.get('grade') as string).trim().toUpperCase(),
    remark: (formData.get('remark') as string)?.trim() || null,
  })

  if (error) {
    redirect(`/dashboard/academics/grading/${scaleId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/dashboard/academics/grading/${scaleId}`)
}

export async function deleteGradeBand(formData: FormData) {
  const supabase = await createClient()
  const bandId = formData.get('band_id') as string
  const scaleId = formData.get('scale_id') as string

  await supabase.from('grade_bands').delete().eq('id', bandId)
  revalidatePath(`/dashboard/academics/grading/${scaleId}`)
}