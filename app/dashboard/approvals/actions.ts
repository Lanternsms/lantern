'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function decideBatch(batchId: string, formData: FormData) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const action = formData.get('action') as string
  const comment = (formData.get('comment') as string) || null

  const { data: batch } = await supabase
    .from('result_batches')
    .select('current_stage_id, workflow_template_id')
    .eq('id', batchId)
    .single()

  if (!batch?.current_stage_id) {
    redirect(`/dashboard/approvals/${batchId}?error=${encodeURIComponent('This batch is not currently awaiting your review.')}`)
  }

  const { data: stage } = await supabase
    .from('workflow_stages')
    .select('sequence_order, is_final, approver_role_id')
    .eq('id', batch.current_stage_id)
    .single()

  // Enforce that only the user whose role matches the current stage's
  // approver_role_id can act. Any other role is rejected here.
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .single()

  if (!userRole || userRole.role_id !== stage?.approver_role_id) {
    redirect(`/dashboard/approvals/${batchId}?error=${encodeURIComponent('You are not the designated approver for this stage.')}`)
  }

  const { data: { school_id } } = { data: (await supabase.from('profiles').select('school_id').eq('id', user.id).single()).data! }

  // Use admin client: the RLS INSERT policy on workflow_actions checks that the
  // actor's role matches the stage's approver_role_id, which fails for the same
  // reason as the result_batches update — the check fires on the new row.
  // Auth is already confirmed above via the user-scoped client.
  const { error: logError } = await admin.from('workflow_actions').insert({
    school_id,
    batch_id: batchId,
    stage_id: batch.current_stage_id,
    actor_id: user.id,
    action,
    comment,
  })

  if (logError) {
    redirect(`/dashboard/approvals/${batchId}?error=${encodeURIComponent('Could not log this decision: ' + logError.message)}`)
  }

  if (action === 'return_to_teacher') {
    // Use admin client: the RLS WITH CHECK on result_batches only allows a
    // writer whose role is the approver for the *new* current_stage_id.
    // Returning a batch sets current_stage_id = null, which would fail that
    // check even though we've already verified the user is the current stage's
    // approver above.
    const { error: updateError } = await admin
      .from('result_batches')
      .update({ status: 'returned', current_stage_id: null })
      .eq('id', batchId)

    if (updateError) {
      redirect(`/dashboard/approvals/${batchId}?error=${encodeURIComponent('Could not return this batch: ' + updateError.message)}`)
    }
  } else if (action === 'approve') {
    if (stage?.is_final) {
      // Use admin client: publishing sets status='published' which the RLS
      // WITH CHECK won't allow via the approver-role check on current_stage_id.
      const { error: updateError } = await admin
        .from('result_batches')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', batchId)

      if (updateError) {
        redirect(`/dashboard/approvals/${batchId}?error=${encodeURIComponent('Could not publish this batch: ' + updateError.message)}`)
      }
    } else {
      // Picks the NEXT HIGHER sequence_order that actually exists,
      // instead of assuming current + 1 — safe even if stage numbers
      // have gaps from earlier adds, deletes, or reordering.
      const { data: nextStage, error: nextStageError } = await supabase
        .from('workflow_stages')
        .select('id')
        .eq('template_id', batch.workflow_template_id)
        .gt('sequence_order', stage?.sequence_order ?? 0)
        .order('sequence_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextStageError || !nextStage) {
        redirect(`/dashboard/approvals/${batchId}?error=${encodeURIComponent('Could not find the next approval stage. The workflow may be misconfigured — check Academics > Approval Workflow.')}`)
      }

      // Use admin client: advancing sets current_stage_id to the *next* stage,
      // which the current user's role is not the approver for — RLS WITH CHECK
      // would reject it even though we've verified they can approve this step.
      const { error: updateError } = await admin
        .from('result_batches')
        .update({ current_stage_id: nextStage!.id })
        .eq('id', batchId)

      if (updateError) {
        redirect(`/dashboard/approvals/${batchId}?error=${encodeURIComponent('Could not advance this batch: ' + updateError.message)}`)
      }
    }
  }

  revalidatePath('/dashboard/approvals')
  revalidatePath(`/dashboard/approvals/${batchId}`)
  redirect('/dashboard/approvals?decided=1')
}