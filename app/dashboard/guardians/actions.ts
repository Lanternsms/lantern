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

// Sets one guardian as the primary contact for a student, and clears the
// flag on any other guardian linked to that same student — there should
// only ever be one primary contact at a time.
async function setPrimaryContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  guardianId: string
) {
  await supabase
    .from('student_guardians')
    .update({ is_primary_contact: false })
    .eq('student_id', studentId)

  await supabase
    .from('student_guardians')
    .update({ is_primary_contact: true })
    .eq('student_id', studentId)
    .eq('guardian_id', guardianId)
}

async function saveCustomFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  guardianId: string,
  formData: FormData
) {
  const { data: definitions } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, field_type')
    .eq('entity_type', 'guardian')

  if (!definitions || definitions.length === 0) return

  for (const def of definitions) {
    const raw = formData.get(`custom_${def.field_key}`)
    if (raw === null) continue
    const value = def.field_type === 'boolean' ? raw === 'true' : raw

    await supabase.from('custom_field_values').upsert(
      { school_id: schoolId, definition_id: def.id, entity_id: guardianId, value },
      { onConflict: 'definition_id,entity_id' }
    )
  }
}

export async function findOrCreateGuardian(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  data: { first_name: string; last_name: string; phone: string | null; email: string | null; relationship: string | null; address: string | null }
) {
  // Matched by name (case-insensitive), not phone — a guardian re-entered
  // for a second child under the same name is treated as the same person.
  const { data: existing } = await supabase
    .from('guardians')
    .select('id')
    .eq('school_id', schoolId)
    .ilike('first_name', data.first_name)
    .ilike('last_name', data.last_name)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('guardians')
    .insert({ school_id: schoolId, ...data })
    .select('id')
    .single()

  return created?.id ?? null
}

// Creates a brand-new guardian (or reuses an existing one matched by name)
// and links them to a student in one step — used from the student detail
// page's "+ Add guardian" link.
export async function createGuardian(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const studentId = formData.get('student_id') as string

  const fullName = (formData.get('full_name') as string).trim()
  const [first, ...rest] = fullName.split(' ')
  const last = rest.join(' ') || first

  const guardianId = await findOrCreateGuardian(supabase, schoolId, {
    first_name: first,
    last_name: last,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    relationship: (formData.get('relationship') as string) || null,
    address: (formData.get('address') as string) || null,
  })

  if (!guardianId) {
    redirect(`/dashboard/guardians/new?student_id=${studentId}&error=${encodeURIComponent('Failed to save guardian')}`)
  }

  await supabase.from('student_guardians').insert({
    student_id: studentId,
    guardian_id: guardianId,
    is_primary_contact: formData.get('is_primary_contact') === 'on',
  })

  if (formData.get('is_primary_contact') === 'on') {
    await setPrimaryContact(supabase, studentId, guardianId)
  }

  await saveCustomFields(supabase, schoolId, guardianId, formData)

  revalidatePath(`/dashboard/students/${studentId}`)
  redirect(`/dashboard/students/${studentId}`)
}

// Links an EXISTING guardian to another student — the sibling case,
// avoiding duplicate guardian records for the same real person.
export async function linkExistingGuardian(formData: FormData) {
  const supabase = await createClient()
  const studentId = formData.get('student_id') as string
  const guardianId = formData.get('guardian_id') as string

  const { error } = await supabase.from('student_guardians').insert({
    student_id: studentId,
    guardian_id: guardianId,
    is_primary_contact: formData.get('is_primary_contact') === 'on',
  })

  if (error) {
    redirect(`/dashboard/guardians?student_id=${studentId}&error=${encodeURIComponent(error.message)}`)
  }

  if (formData.get('is_primary_contact') === 'on') {
    await setPrimaryContact(supabase, studentId, guardianId)
  }

  revalidatePath(`/dashboard/students/${studentId}`)
  redirect(`/dashboard/students/${studentId}`)
}

export async function updateGuardian(guardianId: string, formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { error } = await supabase
    .from('guardians')
    .update({
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      relationship: (formData.get('relationship') as string) || null,
      address: (formData.get('address') as string) || null,
    })
    .eq('id', guardianId)

  if (error) {
    redirect(`/dashboard/guardians/${guardianId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  await saveCustomFields(supabase, schoolId, guardianId, formData)

  revalidatePath('/dashboard/guardians')
  revalidatePath(`/dashboard/guardians/${guardianId}`)
  redirect(`/dashboard/guardians/${guardianId}`)
}

// Toggles which guardian is primary for a given student, triggered
// directly from the student detail page — no separate form needed.
export async function makePrimaryContact(formData: FormData) {
  const supabase = await createClient()
  const studentId = formData.get('student_id') as string
  const guardianId = formData.get('guardian_id') as string

  await setPrimaryContact(supabase, studentId, guardianId)
  revalidatePath(`/dashboard/students/${studentId}`)
}