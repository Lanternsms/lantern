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

export async function createSubject(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { error } = await supabase.from('subjects').insert({
    school_id: schoolId,
    name: (formData.get('name') as string).trim(),
    code: (formData.get('code') as string)?.trim().toUpperCase() || null,
  })

  if (error) {
    redirect(`/dashboard/academics/subjects/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/subjects')
  redirect('/dashboard/academics/subjects')
}

export async function updateSubject(subjectId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('subjects')
    .update({
      name: (formData.get('name') as string).trim(),
      code: (formData.get('code') as string)?.trim().toUpperCase() || null,
    })
    .eq('id', subjectId)

  if (error) {
    redirect(`/dashboard/academics/subjects/${subjectId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/subjects')
  redirect('/dashboard/academics/subjects')
}

export async function deleteSubject(formData: FormData) {
  const supabase = await createClient()
  const subjectId = formData.get('subject_id') as string

  const { error } = await supabase.from('subjects').delete().eq('id', subjectId)

  if (error) {
    const message =
      error.code === '23503'
        ? 'This subject is currently assigned to one or more classes. Remove those assignments first.'
        : error.message
    redirect(`/dashboard/academics/subjects?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/dashboard/academics/subjects')
}

// Assigns a subject to a whole class (arm_id left null = applies to every
// arm) for the school's current session. Assigning per-specific-arm is
// supported by the schema but not exposed in this first version of the UI.
export async function assignSubjectToClass(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const classId = formData.get('class_id') as string

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  if (!session) {
    redirect(`/dashboard/academics/classes/${classId}?error=${encodeURIComponent('No current academic session is set.')}`)
  }

  const teacherId = formData.get('teacher_id') as string

  const { error } = await supabase.from('class_subjects').insert({
    school_id: schoolId,
    session_id: session.id,
    class_id: classId,
    subject_id: formData.get('subject_id') as string,
    teacher_id: teacherId || null,
  })

  if (error) {
    const message = error.code === '23505' ? 'This subject is already assigned to this class.' : error.message
    redirect(`/dashboard/academics/classes/${classId}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(`/dashboard/academics/classes/${classId}`)
}

export async function updateClassSubjectTeacher(formData: FormData) {
  const supabase = await createClient()
  const classSubjectId = formData.get('class_subject_id') as string
  const classId = formData.get('class_id') as string
  const teacherId = formData.get('teacher_id') as string

  await supabase
    .from('class_subjects')
    .update({ teacher_id: teacherId || null })
    .eq('id', classSubjectId)

  revalidatePath(`/dashboard/academics/classes/${classId}`)
}

export async function removeSubjectFromClass(formData: FormData) {
  const supabase = await createClient()
  const classSubjectId = formData.get('class_subject_id') as string
  const classId = formData.get('class_id') as string

  await supabase.from('class_subjects').delete().eq('id', classSubjectId)
  revalidatePath(`/dashboard/academics/classes/${classId}`)
}