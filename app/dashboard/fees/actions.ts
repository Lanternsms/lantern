'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

export async function saveFeeStructure(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profile not found' }

  const id = formData.get('id') as string | null
  const name = (formData.get('name') as string).trim()
  const amount = Number(formData.get('amount'))
  const sessionId = formData.get('session_id') as string
  const termId = (formData.get('term_id') as string) || null
  const classId = (formData.get('class_id') as string) || null

  if (!name || !amount || !sessionId) {
    return { error: 'Name, amount, and session are required.' }
  }

  if (id) {
    const { error } = await supabase
      .from('fee_structures')
      .update({ name, amount, session_id: sessionId, term_id: termId, class_id: classId })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('fee_structures')
      .insert({ school_id: profile.school_id, name, amount, session_id: sessionId, term_id: termId, class_id: classId })
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/fees/structures')
  return { success: true }
}

export async function deleteFeeStructure(id: string) {
  const supabase = await createClient()
  // payments.fee_structure_id has no ON DELETE CASCADE, so this fails
  // loudly if payments already reference it, rather than orphaning history.
  const { error } = await supabase.from('fee_structures').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/fees/structures')
  return { success: true }
}

export async function searchStudents(query: string) {
  const supabase = await createClient()
  if (!query || query.trim().length < 2) return []
  const { data } = await supabase
    .from('students')
    .select('id, first_name, last_name, admission_no')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,admission_no.ilike.%${query}%`)
    .limit(10)
  return data ?? []
}

export async function recordPayment(params: {
  studentId: string
  feeStructureId: string
  paymentMethod: string
  reference: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profile not found' }

  const { data: feeStructure } = await supabase
    .from('fee_structures')
    .select('amount')
    .eq('id', params.feeStructureId)
    .single()
  if (!feeStructure) return { error: 'Fee item not found.' }

  // Generate the id ourselves and insert without .select() — avoids the
  // RETURNING-requires-SELECT-policy trap we hit before with students:
  // whoever is recording this (fees.manage) might not also hold
  // fees.view_all, which is what payments_select actually checks.
  const paymentId = randomUUID()
  const { error } = await supabase.from('payments').insert({
    id: paymentId,
    school_id: profile.school_id,
    student_id: params.studentId,
    fee_structure_id: params.feeStructureId,
    amount_paid: feeStructure.amount, // full payment only — always the component's full amount
    payment_method: params.paymentMethod,
    reference: params.reference || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/fees/record')
  return { success: true, paymentId }
}