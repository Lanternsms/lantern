'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { findOrCreateGuardian } from '@/app/dashboard/guardians/actions'

async function saveCustomFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  studentId: string,
  formData: FormData
) {
  const { data: definitions } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, field_type')
    .eq('entity_type', 'student')

  if (!definitions || definitions.length === 0) return

  for (const def of definitions) {
    const raw = formData.get(`custom_${def.field_key}`)
    if (raw === null) continue
    const value = def.field_type === 'boolean' ? raw === 'true' : raw

    await supabase.from('custom_field_values').upsert(
      { school_id: schoolId, definition_id: def.id, entity_id: studentId, value },
      { onConflict: 'definition_id,entity_id' }
    )
  }
}

export async function createStudent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const schoolId = profile.school_id
  const sessionId = formData.get('session_id') as string
  const from = (formData.get('from') as string) || ''

  const studentId = randomUUID()

  const { error } = await supabase
    .from('students')
    .insert({
      id: studentId,
      school_id: schoolId,
      admission_no: formData.get('admission_no') as string,
      first_name: formData.get('first_name') as string,
      middle_name: (formData.get('middle_name') as string) || null,
      last_name: formData.get('last_name') as string,
      date_of_birth: (formData.get('date_of_birth') as string) || null,
      gender: (formData.get('gender') as string) || null,
      residential_address: (formData.get('residential_address') as string) || null,
    })

  if (error) {
    redirect(`/dashboard/students/new?error=${encodeURIComponent(
      `${error.message} | user=${user.id} school=${schoolId}`
    )}`)
  }

  const classId = formData.get('class_id') as string
  const armId = formData.get('arm_id') as string
  const enrolmentDate = (formData.get('enrolment_date') as string) || null

  await supabase.from('enrolments').insert({
    school_id: schoolId,
    student_id: studentId,
    session_id: sessionId,
    class_id: classId,
    arm_id: armId || null,
    enrolment_date: enrolmentDate,
  })

  const existingGuardianIds = formData.getAll('guardian_existing_id') as string[]
  const names = formData.getAll('guardian_full_name') as string[]
  const relationships = formData.getAll('guardian_relationship') as string[]
  const phones = formData.getAll('guardian_phone') as string[]
  const emails = formData.getAll('guardian_email') as string[]
  const addresses = formData.getAll('guardian_address') as string[]

  // existingGuardianIds, names, relationships etc. are parallel arrays —
  // one element per guardian slot rendered by GuardianRepeater.
  // A slot in "link existing" mode has a non-empty existingGuardianIds[i]
  // and empty names[i]; a slot in "add new" mode is the reverse.
  const slotCount = Math.max(existingGuardianIds.length, names.length)

  for (let i = 0; i < slotCount; i++) {
    const existingId = existingGuardianIds[i]?.trim()

    if (existingId) {
      // Link an existing guardian directly — no duplicate record created.
      await supabase.from('student_guardians').insert({
        student_id: studentId,
        guardian_id: existingId,
        is_primary_contact: i === 0,
      })
      continue
    }

    if (!names[i]?.trim()) continue
    const [first, ...rest] = names[i].trim().split(' ')
    const last = rest.join(' ') || first

    const guardianId = await findOrCreateGuardian(supabase, schoolId, {
      first_name: first,
      last_name: last,
      relationship: relationships[i] || null,
      phone: phones[i] || null,
      email: emails[i] || null,
      address: addresses[i] || null,
    })

    if (guardianId) {
      await supabase.from('student_guardians').insert({
        student_id: studentId,
        guardian_id: guardianId,
        is_primary_contact: i === 0,
      })
      await saveGuardianCustomFieldsAtIndex(supabase, schoolId, guardianId, formData, i)
    }
  }

  await saveCustomFields(supabase, schoolId, studentId, formData)

  const { data: classRow } = await supabase.from('classes').select('name').eq('id', classId).single()
  const { data: armRow } = armId
    ? await supabase.from('arms').select('name').eq('id', armId).single()
    : { data: null }
  const classLabel = armRow ? `${classRow?.name} ${armRow.name}` : classRow?.name ?? ''
  const fullName = `${formData.get('first_name')} ${formData.get('last_name')}`

  revalidatePath('/dashboard/students')
  if (from === 'my-class') revalidatePath('/dashboard/my-class')

  redirect(
    `/dashboard/students/success?id=${studentId}&name=${encodeURIComponent(fullName)}&class=${encodeURIComponent(classLabel)}${from ? `&from=${from}` : ''}`
  )
}

export async function updateStudent(studentId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const schoolId = profile.school_id

  const { error } = await supabase
    .from('students')
    .update({
      first_name: formData.get('first_name') as string,
      middle_name: (formData.get('middle_name') as string) || null,
      last_name: formData.get('last_name') as string,
      date_of_birth: (formData.get('date_of_birth') as string) || null,
      gender: (formData.get('gender') as string) || null,
      residential_address: (formData.get('residential_address') as string) || null,
      status: formData.get('status') as string,
    })
    .eq('id', studentId)

  if (error) {
    redirect(`/dashboard/students/${studentId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  if (session) {
    const classId = formData.get('class_id') as string
    const armId = formData.get('arm_id') as string
    await supabase
      .from('enrolments')
      .update({ class_id: classId, arm_id: armId || null })
      .eq('student_id', studentId)
      .eq('session_id', session.id)
  }

  // Guardians: a row with a guardian_id is an existing link being edited
  // in place; a row with no guardian_id is a newly added guardian, which
  // still goes through findOrCreateGuardian to avoid duplicates.
  const guardianIds = formData.getAll('guardian_id') as string[]
  const names = formData.getAll('guardian_full_name') as string[]
  const relationships = formData.getAll('guardian_relationship') as string[]
  const phones = formData.getAll('guardian_phone') as string[]
  const emails = formData.getAll('guardian_email') as string[]
  const addresses = formData.getAll('guardian_address') as string[]

  for (let i = 0; i < names.length; i++) {
    if (!names[i]?.trim()) continue
    const [first, ...rest] = names[i].trim().split(' ')
    const last = rest.join(' ') || first

    if (guardianIds[i]) {
      await supabase
        .from('guardians')
        .update({
          first_name: first,
          last_name: last,
          relationship: relationships[i] || null,
          phone: phones[i] || null,
          email: emails[i] || null,
          address: addresses[i] || null,
        })
        .eq('id', guardianIds[i])
    } else {
      const guardianId = await findOrCreateGuardian(supabase, schoolId, {
        first_name: first,
        last_name: last,
        relationship: relationships[i] || null,
        phone: phones[i] || null,
        email: emails[i] || null,
        address: addresses[i] || null,
      })
      if (guardianId) {
        await supabase.from('student_guardians').insert({ student_id: studentId, guardian_id: guardianId })
      }
    }
      for (let i = 0; i < names.length; i++) {
    if (!names[i]?.trim()) continue
    const [first, ...rest] = names[i].trim().split(' ')
    const last = rest.join(' ') || first

    if (guardianIds[i]) {
      await supabase
        .from('guardians')
        .update({
          first_name: first,
          last_name: last,
          relationship: relationships[i] || null,
          phone: phones[i] || null,
          email: emails[i] || null,
          address: addresses[i] || null,
        })
        .eq('id', guardianIds[i])
      await saveGuardianCustomFieldsAtIndex(supabase, schoolId, guardianIds[i], formData, i)
    } else {
      const guardianId = await findOrCreateGuardian(supabase, schoolId, {
        first_name: first,
        last_name: last,
        relationship: relationships[i] || null,
        phone: phones[i] || null,
        email: emails[i] || null,
        address: addresses[i] || null,
      })
      if (guardianId) {
        await supabase.from('student_guardians').insert({ student_id: studentId, guardian_id: guardianId })
        await saveGuardianCustomFieldsAtIndex(supabase, schoolId, guardianId, formData, i)
      }
    }
  }

  }

  // Removing a guardian here only deletes the LINK to this student —
  // never the guardian record itself, since they may still be a parent
  // to siblings elsewhere in the school.
  const removedIds = formData.getAll('removed_guardian_ids') as string[]
  for (const removedId of removedIds) {
    await supabase.from('student_guardians').delete().eq('student_id', studentId).eq('guardian_id', removedId)
  }

  await saveCustomFields(supabase, schoolId, studentId, formData)

  const from = formData.get('from') as string
  revalidatePath(`/dashboard/students/${studentId}`)
  redirect(`/dashboard/students/${studentId}${from ? `?from=${from}` : ''}`)
}

async function saveGuardianCustomFieldsAtIndex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  guardianId: string,
  formData: FormData,
  index: number
) {
  const { data: definitions } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, field_type')
    .eq('entity_type', 'guardian')

  if (!definitions || definitions.length === 0) return

  for (const def of definitions) {
    if (def.field_type === 'boolean') {
      // Booleans use an indexed field name (see GuardianCustomFields) —
      // read it directly rather than via getAll() positional lookup.
      const raw = formData.get(`custom_${def.field_key}__${index}`)
      if (raw === null) continue
      await supabase.from('custom_field_values').upsert(
        { school_id: schoolId, definition_id: def.id, entity_id: guardianId, value: raw === 'true' },
        { onConflict: 'definition_id,entity_id' }
      )
    } else {
      const values = formData.getAll(`custom_${def.field_key}`) as string[]
      const raw = values[index]
      if (raw === undefined) continue
      await supabase.from('custom_field_values').upsert(
        { school_id: schoolId, definition_id: def.id, entity_id: guardianId, value: raw },
        { onConflict: 'definition_id,entity_id' }
      )
    }
  }
}

//CSV import
export type BulkImportRow = {
  admission_no: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  class_name: string
  arm_name: string
}

export type BulkImportResult = {
  successCount: number
  errors: { row: number; message: string }[]
}

export async function bulkImportStudents(rows: BulkImportRow[]): Promise<BulkImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const schoolId = profile.school_id

  const { data: session } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  if (!session) {
    return { successCount: 0, errors: [{ row: 0, message: 'No current academic session is set for your school.' }] }
  }

  const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', schoolId)
  const { data: arms } = await supabase.from('arms').select('id, name, class_id').eq('school_id', schoolId)

  const errors: { row: number; message: string }[] = []
  let successCount = 0

  // Sequential, not Promise.all — each row's admission number must be
  // checked/inserted one at a time to give accurate per-row error
  // reporting rather than a batch failure that hides which row broke.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +1 for header row, +1 for 1-indexing — matches what the user sees in their spreadsheet

    if (!row.first_name?.trim() || !row.last_name?.trim() || !row.admission_no?.trim()) {
      errors.push({ row: rowNum, message: 'Missing required field (First Name, Last Name, or Admission Number).' })
      continue
    }

    const matchedClass = classes?.find((c) => c.name.toLowerCase() === row.class_name?.trim().toLowerCase())
    if (!matchedClass) {
      errors.push({ row: rowNum, message: `Class "${row.class_name}" not found.` })
      continue
    }

    let matchedArmId: string | null = null
    if (row.arm_name?.trim()) {
      const matchedArm = arms?.find(
        (a) => a.class_id === matchedClass.id && a.name.toLowerCase() === row.arm_name.trim().toLowerCase()
      )
      if (!matchedArm) {
        errors.push({ row: rowNum, message: `Arm "${row.arm_name}" not found in class "${row.class_name}".` })
        continue
      }
      matchedArmId = matchedArm.id
    }

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        school_id: schoolId,
        admission_no: row.admission_no.trim(),
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        date_of_birth: row.date_of_birth?.trim() || null,
        gender: row.gender?.trim().toLowerCase() || null,
      })
      .select('id')
      .single()

    if (error || !student) {
      errors.push({ row: rowNum, message: error?.message ?? 'Failed to create student (possibly a duplicate admission number).' })
      continue
    }

    await supabase.from('enrolments').insert({
      school_id: schoolId,
      student_id: student.id,
      session_id: session.id,
      class_id: matchedClass.id,
      arm_id: matchedArmId,
    })

    successCount++
  }

  revalidatePath('/dashboard/students')
  return { successCount, errors }
}