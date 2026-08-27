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

// One-click standard set: Present, Absent, Late, Excused — matching the
// same four categories used in the original RLS test seed script. Only
// runs if the school has none yet.
export async function seedDefaultAttendanceStatuses() {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { count } = await supabase
    .from('attendance_statuses')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  if (count && count > 0) return

  await supabase.from('attendance_statuses').insert([
    { school_id: schoolId, code: 'present', label: 'Present', counts_as_present: true },
    { school_id: schoolId, code: 'absent', label: 'Absent', counts_as_present: false },
    { school_id: schoolId, code: 'late', label: 'Late', counts_as_present: true },
    { school_id: schoolId, code: 'excused', label: 'Excused', counts_as_present: false },
  ])

  revalidatePath('/dashboard/academics/attendance-statuses')
}

// Codes are auto-derived from the label (lowercased, spaces to
// underscores) — this matches the schema's unique(school_id, code)
// constraint and keeps the form itself simple: a school admin thinks in
// terms of the label ("Half Day"), not an internal code.
function slugify(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export async function createAttendanceStatus(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)
  const label = (formData.get('label') as string).trim()

  const { error } = await supabase.from('attendance_statuses').insert({
    school_id: schoolId,
    code: slugify(label),
    label,
    counts_as_present: formData.get('counts_as_present') === 'on',
  })

  if (error) {
    const message = error.code === '23505' ? 'A category with a matching name already exists.' : error.message
    redirect(`/dashboard/academics/attendance-statuses?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/dashboard/academics/attendance-statuses')
}

export async function updateAttendanceStatus(formData: FormData) {
  const supabase = await createClient()
  const statusId = formData.get('status_id') as string
  const label = (formData.get('label') as string).trim()

  const { error } = await supabase
    .from('attendance_statuses')
    .update({
      label,
      code: slugify(label),
      counts_as_present: formData.get('counts_as_present') === 'on',
    })
    .eq('id', statusId)

  if (error) {
    redirect(`/dashboard/academics/attendance-statuses?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/attendance-statuses')
}

export async function deleteAttendanceStatus(formData: FormData) {
  const supabase = await createClient()
  const statusId = formData.get('status_id') as string

  const { error } = await supabase.from('attendance_statuses').delete().eq('id', statusId)

  if (error) {
    // 23503 = foreign-key violation — real attendance records already
    // reference this category, so deleting it would orphan those rows.
    const message =
      error.code === '23503'
        ? 'Attendance has already been recorded using this category, so it can\'t be deleted.'
        : error.message
    redirect(`/dashboard/academics/attendance-statuses?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/dashboard/academics/attendance-statuses')
}