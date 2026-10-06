'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignFormTeacher(classId: string, armId: string | null, formData: FormData) {
  const teacherProfileId = (formData.get('teacherId') as string) || null
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('No profile found')

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()
  if (!currentSession) throw new Error('No current academic session is set for your school')

  // Clear any existing form teacher for this exact class/arm/session —
  // only one form teacher per class/arm at a time.
  let delQuery = supabase
    .from('teacher_class_assignments')
    .delete()
    .eq('school_id', profile.school_id)
    .eq('session_id', currentSession.id)
    .eq('class_id', classId)
    .eq('role', 'form_teacher')
  delQuery = armId ? delQuery.eq('arm_id', armId) : delQuery.is('arm_id', null)
  await delQuery

  if (teacherProfileId) {
    const { error } = await supabase.from('teacher_class_assignments').insert({
      school_id: profile.school_id,
      session_id: currentSession.id,
      teacher_id: teacherProfileId,
      class_id: classId,
      arm_id: armId,
      role: 'form_teacher',
    })
    if (error) throw new Error('Could not assign form teacher: ' + error.message)
  }

  revalidatePath(`/dashboard/academics/classes/${classId}`)
}
