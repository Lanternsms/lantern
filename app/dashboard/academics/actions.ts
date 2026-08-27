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

export async function createSession(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { error } = await supabase.from('academic_sessions').insert({
    school_id: schoolId,
    name: formData.get('name') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
  })

  if (error) {
    redirect(`/dashboard/academics/sessions/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/sessions')
  redirect('/dashboard/academics/sessions')
}

export async function updateSession(sessionId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('academic_sessions')
    .update({
      name: formData.get('name') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
    })
    .eq('id', sessionId)

  if (error) {
    redirect(`/dashboard/academics/sessions/${sessionId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/sessions')
  redirect('/dashboard/academics/sessions')
}

// Un-marks whichever session is currently "current" for this school BEFORE
// marking the new one — doing it in the reverse order would try to have
// two rows both true at once, which the one_current_session_per_school
// unique index in the schema will correctly reject.
export async function setCurrentSession(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const sessionId = formData.get('session_id') as string

  await supabase.from('academic_sessions').update({ is_current: false }).eq('school_id', schoolId).eq('is_current', true)
  await supabase.from('academic_sessions').update({ is_current: true }).eq('id', sessionId)

  revalidatePath('/dashboard/academics/sessions')
}

export async function createTerm(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const sessionId = formData.get('session_id') as string

  const { error } = await supabase.from('terms').insert({
    school_id: schoolId,
    session_id: sessionId,
    name: formData.get('name') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
  })

  if (error) {
    redirect(`/dashboard/academics/sessions/${sessionId}/terms/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/dashboard/academics/sessions/${sessionId}`)
  redirect(`/dashboard/academics/sessions/${sessionId}`)
}

export async function updateTerm(termId: string, sessionId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('terms')
    .update({
      name: formData.get('name') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
    })
    .eq('id', termId)

  if (error) {
    redirect(`/dashboard/academics/sessions/${sessionId}/terms/${termId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/dashboard/academics/sessions/${sessionId}`)
  redirect(`/dashboard/academics/sessions/${sessionId}`)
}

// Same pattern as setCurrentSession — clear the old current term for this
// school FIRST, since one_current_term_per_school is scoped to the whole
// school, not per-session (a school has one current term overall).
export async function setCurrentTerm(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const termId = formData.get('term_id') as string
  const sessionId = formData.get('session_id') as string

  await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId).eq('is_current', true)
  await supabase.from('terms').update({ is_current: true }).eq('id', termId)

  revalidatePath(`/dashboard/academics/sessions/${sessionId}`)
}