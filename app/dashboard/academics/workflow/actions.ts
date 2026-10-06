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

const LIST = '/dashboard/academics/workflow'

const PRESETS: Record<string, { name: string; stages: { name: string; role: string }[] }> = {
  simple: {
    name: 'Simple Approval (Principal only)',
    stages: [{ name: 'Principal Approval', role: 'principal' }],
  },
  standard: {
    name: 'Standard Approval (HOD then Principal)',
    stages: [
      { name: 'HOD Review', role: 'hod' },
      { name: 'Principal Approval', role: 'principal' },
    ],
  },
}

// One-click starting points for a school with no workflow yet. Only runs
// when the school has none, so it can never overwrite a custom setup.
export async function seedWorkflowPreset(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const preset = PRESETS[formData.get('preset') as string]
  if (!preset) redirect(LIST)

  const { count } = await supabase
    .from('workflow_templates')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
  if (count && count > 0) redirect(LIST)

  const { data: roles } = await supabase
    .from('roles')
    .select('id, name')
    .is('school_id', null)
    .in('name', preset.stages.map((s) => s.role))

  const roleIdByName = new Map((roles ?? []).map((r) => [r.name, r.id] as [string, string]))

  if (preset.stages.some((s) => !roleIdByName.has(s.role))) {
    redirect(`${LIST}?error=${encodeURIComponent('The default roles this preset needs were not found. Make sure the seed script has been run.')}`)
  }

  const { data: template, error } = await supabase
    .from('workflow_templates')
    .insert({ school_id: schoolId, name: preset.name, is_active: true })
    .select('id')
    .single()

  if (error || !template) {
    redirect(`${LIST}?error=${encodeURIComponent(error?.message ?? 'Failed to create workflow')}`)
  }

  const { error: stageError } = await supabase.from('workflow_stages').insert(
    preset.stages.map((s, i) => ({
      school_id: schoolId,
      template_id: template.id,
      sequence_order: i + 1,
      name: s.name,
      approver_role_id: roleIdByName.get(s.role)!,
    }))
  )

  if (stageError) {
    redirect(`${LIST}?error=${encodeURIComponent(stageError.message)}`)
  }

  revalidatePath(LIST)
  redirect(`${LIST}/${template.id}`)
}

export async function createTemplate(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  // is_active must be set explicitly to false: the column defaults to true,
  // which would collide with the one-active-workflow index if another
  // workflow is already active.
  const { data: template, error } = await supabase
    .from('workflow_templates')
    .insert({ school_id: schoolId, name: (formData.get('name') as string).trim(), is_active: false })
    .select('id')
    .single()

  if (error || !template) {
    redirect(`${LIST}/new?error=${encodeURIComponent(error?.message ?? 'Failed to create workflow')}`)
  }

  revalidatePath(LIST)
  redirect(`${LIST}/${template.id}`)
}

export async function renameTemplate(templateId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workflow_templates')
    .update({ name: (formData.get('name') as string).trim() })
    .eq('id', templateId)

  if (error) {
    redirect(`${LIST}/${templateId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(LIST)
  revalidatePath(`${LIST}/${templateId}`)
}

export async function setActiveTemplate(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const templateId = formData.get('template_id') as string
  const back = (formData.get('back') as string) || LIST

  const { count } = await supabase
    .from('workflow_stages')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)

  if (!count) {
    redirect(`${back}?error=${encodeURIComponent('Add at least one approval stage before making this the active workflow.')}`)
  }

  // Same order of operations as sessions and grading scales: clear the
  // current active one first, or the unique index rejects two at once.
  await supabase.from('workflow_templates').update({ is_active: false }).eq('school_id', schoolId).eq('is_active', true)
  await supabase.from('workflow_templates').update({ is_active: true }).eq('id', templateId)

  revalidatePath(LIST)
  revalidatePath(`${LIST}/${templateId}`)
}

export async function deleteTemplate(formData: FormData) {
  const supabase = await createClient()
  const templateId = formData.get('template_id') as string

  const { data: template } = await supabase.from('workflow_templates').select('is_active').eq('id', templateId).single()

  if (template?.is_active) {
    redirect(`${LIST}?error=${encodeURIComponent('Make a different workflow active before deleting this one.')}`)
  }

  const { error } = await supabase.from('workflow_templates').delete().eq('id', templateId)

  if (error) {
    // 23503 = result batches already reference this workflow
    const message =
      error.code === '23503'
        ? 'Results have already been submitted using this workflow, so it can\'t be deleted.'
        : error.message
    redirect(`${LIST}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(LIST)
}

export async function addStage(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const templateId = formData.get('template_id') as string
  const detail = `${LIST}/${templateId}`

  const { data: last } = await supabase
    .from('workflow_stages')
    .select('sequence_order')
    .eq('template_id', templateId)
    .order('sequence_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('workflow_stages').insert({
    school_id: schoolId,
    template_id: templateId,
    sequence_order: (last?.sequence_order ?? 0) + 1,
    name: (formData.get('name') as string).trim(),
    approver_role_id: formData.get('approver_role_id') as string,
  })

  if (error) {
    redirect(`${detail}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(detail)
  revalidatePath(LIST)
}

export async function updateStage(formData: FormData) {
  const supabase = await createClient()
  const stageId = formData.get('stage_id') as string
  const templateId = formData.get('template_id') as string
  const detail = `${LIST}/${templateId}`

  const { error } = await supabase
    .from('workflow_stages')
    .update({
      name: (formData.get('name') as string).trim(),
      approver_role_id: formData.get('approver_role_id') as string,
    })
    .eq('id', stageId)

  if (error) {
    redirect(`${detail}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(detail)
}

export async function moveStage(formData: FormData) {
  const supabase = await createClient()
  const stageId = formData.get('stage_id') as string
  const templateId = formData.get('template_id') as string
  const direction = formData.get('direction') as string

  const { error } = await supabase.rpc('move_workflow_stage', {
    p_stage_id: stageId,
    p_direction: direction,
  })

  if (error) {
    redirect(`${LIST}/${templateId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`${LIST}/${templateId}`)
}

export async function deleteStage(formData: FormData) {
  const supabase = await createClient()
  const stageId = formData.get('stage_id') as string
  const templateId = formData.get('template_id') as string
  const detail = `${LIST}/${templateId}`

  const { data: template } = await supabase.from('workflow_templates').select('is_active').eq('id', templateId).single()
  const { count } = await supabase
    .from('workflow_stages')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)

  if (template?.is_active && (count ?? 0) <= 1) {
    redirect(`${detail}?error=${encodeURIComponent('The active workflow needs at least one stage. Add another stage first, or make a different workflow active.')}`)
  }

  const { error } = await supabase.from('workflow_stages').delete().eq('id', stageId)

  if (error) {
    // 23503 = batches currently sit at this stage, or approvals were
    // already recorded against it
    const message =
      error.code === '23503'
        ? 'This stage is in use by submitted results or has approval history, so it can\'t be deleted.'
        : error.message
    redirect(`${detail}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(detail)
  revalidatePath(LIST)
}