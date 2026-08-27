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

export async function createClass(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { error } = await supabase.from('classes').insert({
    school_id: schoolId,
    name: (formData.get('name') as string).trim(),
    level: formData.get('level') ? parseInt(formData.get('level') as string, 10) : null,
    department_id: (formData.get('department_id') as string) || null,
  })

  if (error) {
    redirect(`/dashboard/academics/classes/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/classes')
  redirect('/dashboard/academics/classes')
}

export async function updateClass(classId: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('classes')
    .update({
      name: (formData.get('name') as string).trim(),
      level: formData.get('level') ? parseInt(formData.get('level') as string, 10) : null,
      department_id: (formData.get('department_id') as string) || null,
    })
    .eq('id', classId)

  if (error) {
    redirect(`/dashboard/academics/classes/${classId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/classes')
  revalidatePath(`/dashboard/academics/classes/${classId}`)
  redirect(`/dashboard/academics/classes/${classId}`)
}

export async function deleteClass(formData: FormData) {
  const supabase = await createClient()
  const classId = formData.get('class_id') as string

  // Deleting a class cascades to its arms (schema: arms.class_id on
  // delete cascade) — worth knowing before offering this action in the UI,
  // since it's not reversible and silently takes the arms with it.
  const { error } = await supabase.from('classes').delete().eq('id', classId)

  if (!error) {
    revalidatePath('/dashboard/academics/classes')
    redirect('/dashboard/academics/classes')
  }
}

export async function createArm(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const classId = formData.get('class_id') as string

  const { error } = await supabase.from('arms').insert({
    school_id: schoolId,
    class_id: classId,
    name: (formData.get('name') as string).trim(),
  })

  if (error) {
    // The unique(class_id, name) constraint from the schema is the most
    // likely real-world error here — two arms can't share a name within
    // one class — surface that plainly rather than a raw Postgres message.
    const message = error.code === '23505' ? 'An arm with this name already exists in this class.' : error.message
    redirect(`/dashboard/academics/classes/${classId}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(`/dashboard/academics/classes/${classId}`)
  redirect(`/dashboard/academics/classes/${classId}`)
}

export async function deleteArm(formData: FormData) {
  const supabase = await createClient()
  const armId = formData.get('arm_id') as string
  const classId = formData.get('class_id') as string

  const { error } = await supabase.from('arms').delete().eq('id', armId)

  if (error) {
    // Postgres foreign-key-violation code — happens when students are
    // still enrolled with this arm_id. Surface a clear, actionable
    // message instead of the raw constraint-violation text.
    const message =
      error.code === '23503'
        ? 'This arm still has students enrolled in it. Move them to a different arm before deleting it.'
        : error.message
    redirect(`/dashboard/academics/classes/${classId}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(`/dashboard/academics/classes/${classId}`)
}