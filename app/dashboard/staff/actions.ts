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

async function saveCustomFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  staffId: string,
  formData: FormData
) {
  const { data: definitions } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, field_type')
    .eq('entity_type', 'staff')

  if (!definitions || definitions.length === 0) return

  for (const def of definitions) {
    const raw = formData.get(`custom_${def.field_key}`)
    if (raw === null) continue
    const value = def.field_type === 'boolean' ? raw === 'true' : raw

    await supabase.from('custom_field_values').upsert(
      { school_id: schoolId, definition_id: def.id, entity_id: staffId, value },
      { onConflict: 'definition_id,entity_id' }
    )
  }
}

export async function createStaff(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { data: staff, error } = await supabase
    .from('staff')
    .insert({
      school_id: schoolId,
      staff_no: formData.get('staff_no') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      department_id: (formData.get('department_id') as string) || null,
      qualification: (formData.get('qualification') as string) || null,
      employment_date: (formData.get('employment_date') as string) || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !staff) {
    redirect(`/dashboard/staff/new?error=${encodeURIComponent(error?.message ?? 'Failed to create staff record')}`)
  }

  await saveCustomFields(supabase, schoolId, staff.id, formData)

  revalidatePath('/dashboard/staff')
  redirect(`/dashboard/staff/${staff.id}`)
}

export async function updateStaff(staffId: string, formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { error } = await supabase
    .from('staff')
    .update({
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      department_id: (formData.get('department_id') as string) || null,
      qualification: (formData.get('qualification') as string) || null,
      employment_date: (formData.get('employment_date') as string) || null,
      status: formData.get('status') as string,
    })
    .eq('id', staffId)

  if (error) {
    redirect(`/dashboard/staff/${staffId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  await saveCustomFields(supabase, schoolId, staffId, formData)

  revalidatePath(`/dashboard/staff/${staffId}`)
  redirect(`/dashboard/staff/${staffId}`)
}