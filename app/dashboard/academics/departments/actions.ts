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

export async function createDepartment(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { error } = await supabase.from('departments').insert({
    school_id: schoolId,
    name: (formData.get('name') as string).trim(),
  })

  if (error) {
    redirect(`/dashboard/academics/departments/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/departments')
  redirect('/dashboard/academics/departments')
}

export async function updateDepartment(departmentId: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('departments')
    .update({ name: (formData.get('name') as string).trim() })
    .eq('id', departmentId)

  if (error) {
    redirect(`/dashboard/academics/departments/${departmentId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/academics/departments')
  redirect('/dashboard/academics/departments')
}

export async function deleteDepartment(formData: FormData) {
  const supabase = await createClient()
  const departmentId = formData.get('department_id') as string

  const { error } = await supabase.from('departments').delete().eq('id', departmentId)

  if (error) {
    // 23503 = foreign-key violation — this department is still referenced
    // by at least one class or staff record (both reference departments,
    // with no cascade), so Postgres correctly refuses to delete it.
    const message =
      error.code === '23503'
        ? 'This department is still assigned to one or more classes or staff members. Reassign them before deleting it.'
        : error.message
    redirect(`/dashboard/academics/departments?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/dashboard/academics/departments')
}