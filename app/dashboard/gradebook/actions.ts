'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function getContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: term } = await supabase
    .from('terms')
    .select('id, session_id')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .single()

  return { userId: user.id, schoolId: profile.school_id, termId: term?.id ?? null }
}

// Idempotent: reuses an existing draft/returned/in-review/published batch
// for this exact class+subject+term+teacher rather than creating a new
// one every time, since results.unique(student,subject,term,assessment_type)
// would otherwise reject a second batch's scores outright.
async function findOrCreateBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  termId: string,
  classId: string,
  armId: string | null,
  subjectId: string,
  teacherId: string
) {
  const { data: existing } = await supabase
    .from('result_batches')
    .select('id, status')
    .eq('term_id', termId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .eq('submitted_by', teacherId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing

  const { data: activeWorkflow } = await supabase
    .from('workflow_templates')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .single()

  if (!activeWorkflow) return null

  const { data: created } = await supabase
    .from('result_batches')
    .insert({
      school_id: schoolId,
      term_id: termId,
      class_id: classId,
      arm_id: armId,
      subject_id: subjectId,
      submitted_by: teacherId,
      workflow_template_id: activeWorkflow.id,
      status: 'draft',
    })
    .select('id, status')
    .single()

  return created
}

export async function saveScores(classSubjectId: string, formData: FormData) {
  const supabase = await createClient()
  const { userId, schoolId, termId } = await getContext(supabase)
  if (!termId) redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('No current term is set.')}`)

  const { data: cs } = await supabase
    .from('class_subjects')
    .select('class_id, arm_id, subject_id')
    .eq('id', classSubjectId)
    .single()

  if (!cs) redirect('/dashboard/gradebook')

  const batch = await findOrCreateBatch(supabase, schoolId, termId, cs.class_id, cs.arm_id, cs.subject_id, userId)

  if (!batch) {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('No active approval workflow is set for your school yet. Ask an admin to activate one before scores can be submitted.')}`)
  }

  if (batch.status !== 'draft' && batch.status !== 'returned') {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('This batch is no longer editable - it has already been submitted.')}`)
  }

  const { data: assessmentTypes } = await supabase.from('assessment_types').select('id').eq('school_id', schoolId)

  const { data: termRow } = await supabase.from('terms').select('session_id').eq('id', termId).single()
  if (!termRow?.session_id) {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('Term session not found.')}`)
  }

  let enrolQuery = supabase
    .from('enrolments')
    .select('student_id')
    .eq('session_id', termRow.session_id)
    .eq('class_id', cs.class_id)

  if (cs.arm_id) enrolQuery = enrolQuery.eq('arm_id', cs.arm_id)
  const { data: enrolments } = await enrolQuery

  for (const e of enrolments ?? []) {
    for (const at of assessmentTypes ?? []) {
      const raw = formData.get(`score_${e.student_id}_${at.id}`)
      if (raw === null || raw === '') continue

      await supabase.from('results').upsert(
        {
          school_id: schoolId,
          batch_id: batch.id,
          student_id: e.student_id,
          subject_id: cs.subject_id,
          term_id: termId,
          assessment_type_id: at.id,
          score: parseFloat(raw as string),
          entered_by: userId,
        },
        { onConflict: 'student_id,subject_id,term_id,assessment_type_id' }
      )
    }
  }

  revalidatePath(`/dashboard/gradebook/${classSubjectId}`)
  redirect(`/dashboard/gradebook/${classSubjectId}?saved=1`)
}

export async function submitForApproval(classSubjectId: string) {
  const supabase = await createClient()
  const { userId, termId } = await getContext(supabase)
  if (!termId) redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('No current term is set.')}`)

  const { data: cs } = await supabase
    .from('class_subjects')
    .select('class_id, arm_id, subject_id')
    .eq('id', classSubjectId)
    .single()

  if (!cs) redirect('/dashboard/gradebook')

  const { data: batch } = await supabase
    .from('result_batches')
    .select('id, status, workflow_template_id')
    .eq('term_id', termId)
    .eq('class_id', cs.class_id)
    .eq('subject_id', cs.subject_id)
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!batch) {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('Save at least one score before submitting.')}`)
  }
  if (batch.status !== 'draft' && batch.status !== 'returned') {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('This batch has already been submitted.')}`)
  }

  const { data: session } = await supabase
    .from('terms')
    .select('session_id')
    .eq('id', termId)
    .single()

  if (!session?.session_id) {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('Term session not found.')}`)
  }

  let enrolQuery = supabase
    .from('enrolments')
    .select('student_id')
    .eq('session_id', session.session_id)
    .eq('class_id', cs.class_id)

  if (cs.arm_id) enrolQuery = enrolQuery.eq('arm_id', cs.arm_id)
  const { data: enrolments } = await enrolQuery

  const { data: assessmentTypes } = await supabase.from('assessment_types').select('id')

  const { data: existingResults } = await supabase
    .from('results')
    .select('student_id, assessment_type_id')
    .eq('batch_id', batch.id)

  const have = new Set((existingResults ?? []).map((r) => `${r.student_id}_${r.assessment_type_id}`))
  const expectedCount = (enrolments?.length ?? 0) * (assessmentTypes?.length ?? 0)
  const missing = expectedCount - have.size

  if (missing > 0) {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent(`${missing} score(s) are still missing. Every student needs a score for every assessment type before submitting.`)}`)
  }

  const { data: firstStage } = await supabase
    .from('workflow_stages')
    .select('id')
    .eq('template_id', batch.workflow_template_id)
    .order('sequence_order', { ascending: true })
    .limit(1)
    .single()

  if (!firstStage) {
    redirect(`/dashboard/gradebook/${classSubjectId}?error=${encodeURIComponent('The active workflow has no approval stages yet.')}`)
  }

  await supabase
    .from('result_batches')
    .update({ status: 'in_review', current_stage_id: firstStage.id, submitted_at: new Date().toISOString() })
    .eq('id', batch.id)

  revalidatePath(`/dashboard/gradebook/${classSubjectId}`)
  redirect(`/dashboard/gradebook/${classSubjectId}?submitted=1`)
}