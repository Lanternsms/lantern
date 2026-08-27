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

function slugify(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export async function createCustomField(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const entityType = formData.get('entity_type') as string
  const label = (formData.get('label') as string).trim()
  const fieldType = formData.get('field_type') as string
  const isRequired = formData.get('is_required') === 'on'

  // Options are entered as one per line in a textarea — only meaningful
  // for the 'select' field type, ignored/stored as null otherwise.
  const optionsRaw = formData.get('options') as string
  const options =
    fieldType === 'select' && optionsRaw?.trim()
      ? optionsRaw.split('\n').map((o) => o.trim()).filter(Boolean)
      : null

  const { data: maxSort } = await supabase
    .from('custom_field_definitions')
    .select('sort_order')
    .eq('school_id', schoolId)
    .eq('entity_type', entityType)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('custom_field_definitions').insert({
    school_id: schoolId,
    entity_type: entityType,
    field_key: slugify(label),
    label,
    field_type: fieldType,
    options,
    is_required: isRequired,
    sort_order: (maxSort?.sort_order ?? 0) + 1,
  })

  if (error) {
    // 23505 = unique(school_id, entity_type, field_key) violation —
    // two fields with the same label under the same entity type.
    const message = error.code === '23505' ? 'A field with this name already exists for this record type.' : error.message
    redirect(`/dashboard/academics/custom-fields?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/dashboard/academics/custom-fields')
}

export async function updateCustomField(formData: FormData) {
  const supabase = await createClient()
  const fieldId = formData.get('field_id') as string
  const label = (formData.get('label') as string).trim()
  const isRequired = formData.get('is_required') === 'on'

  // Deliberately NOT changing field_key or field_type here — see the
  // explanation below this action about why those are locked after creation.
  const { error } = await supabase
    .from('custom_field_definitions')
    .update({ label, is_required: isRequired })
    .eq('id', fieldId)

  if (error) {
    redirect(`/dashboard/academics/custom-fields?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/custom-fields')
}

export async function deleteCustomField(formData: FormData) {
  const supabase = await createClient()
  const fieldId = formData.get('field_id') as string

  // custom_field_values.definition_id has on delete cascade in the
  // schema, so this also silently removes every value ever entered for
  // this field across every student/staff/guardian — real data loss,
  // which is exactly why the page below asks for confirmation.
  const { error } = await supabase.from('custom_field_definitions').delete().eq('id', fieldId)

  if (error) {
    redirect(`/dashboard/academics/custom-fields?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/custom-fields')
}