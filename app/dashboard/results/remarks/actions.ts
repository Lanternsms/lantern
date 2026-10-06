'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveClassTeacherRemark(
  termId: string,
  studentId: string,
  formData: FormData
) {
  const remark = (formData.get('remark') as string)?.trim() || null
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_class_teacher_remark', {
    p_student_id: studentId,
    p_term_id: termId,
    p_remark: remark,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/results/remarks')
}

export async function savePrincipalRemark(
  termId: string,
  studentId: string,
  formData: FormData
) {
  const remark = (formData.get('remark') as string)?.trim() || null
  const supabase = await createClient()

  const { error } = await supabase.rpc('set_principal_remark', {
    p_student_id: studentId,
    p_term_id: termId,
    p_remark: remark,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/results/remarks')
}
