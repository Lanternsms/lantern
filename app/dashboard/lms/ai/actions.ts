/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getLmsAccess, canManageLesson } from '@/lib/lms/access'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'
import { askQuestion } from '@/app/dashboard/lms/questions/actions'

export interface AiSettingsData {
  school_id: string
  enabled: boolean
  voice_enabled: boolean
  read_aloud_enabled: boolean
  daily_limit_per_student: number
  daily_limit_per_class: number
  monthly_limit_school: number
  updated_at?: string
}

export async function getAiSettings(): Promise<AiSettingsData> {
  const access = await getLmsAccess()
  const { schoolId } = access
  const admin = createAdminClient()

  const { data } = await (admin as any)
    .from('lms_ai_settings')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()

  if (data) {
    return {
      school_id: data.school_id,
      enabled: Boolean(data.enabled),
      voice_enabled: data.voice_enabled ?? true,
      read_aloud_enabled: data.read_aloud_enabled ?? true,
      daily_limit_per_student: data.daily_limit_per_student ?? 20,
      daily_limit_per_class: data.daily_limit_per_class ?? 150,
      monthly_limit_school: data.monthly_limit_school ?? 3000,
      updated_at: data.updated_at,
    }
  }

  return {
    school_id: schoolId,
    enabled: false,
    voice_enabled: true,
    read_aloud_enabled: true,
    daily_limit_per_student: 20,
    daily_limit_per_class: 150,
    monthly_limit_school: 3000,
  }
}

export async function updateAiSettings(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const access = await getLmsAccess()
  if (!access.isManager) {
    return { error: 'Not authorized. Admin access required.' }
  }

  const { schoolId } = access
  const admin = createAdminClient()

  const enabled = formData.get('enabled') === 'on' || formData.get('enabled') === 'true'
  const voice_enabled = formData.get('voice_enabled') === 'on' || formData.get('voice_enabled') === 'true'
  const read_aloud_enabled = formData.get('read_aloud_enabled') === 'on' || formData.get('read_aloud_enabled') === 'true'

  const daily_limit_per_student = Math.max(1, parseInt((formData.get('daily_limit_per_student') as string) || '20', 10))
  const daily_limit_per_class = Math.max(1, parseInt((formData.get('daily_limit_per_class') as string) || '150', 10))
  const monthly_limit_school = Math.max(10, parseInt((formData.get('monthly_limit_school') as string) || '3000', 10))

  const { error } = await (admin as any)
    .from('lms_ai_settings')
    .upsert({
      school_id: schoolId,
      enabled,
      voice_enabled,
      read_aloud_enabled,
      daily_limit_per_student,
      daily_limit_per_class,
      monthly_limit_school,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return { error: error.message }
  }

  await logSchoolAction('lms_ai_settings_updated', {
    metadata: {
      enabled,
      voice_enabled,
      read_aloud_enabled,
      daily_limit_per_student,
      daily_limit_per_class,
      monthly_limit_school,
    },
  })

  revalidatePath('/dashboard/lms/ai')
  revalidatePath('/dashboard/lms')
  return { success: true }
}

export async function setLessonAiTutorEnabled(
  lessonId: string,
  enabled: boolean
): Promise<{ error?: string; success?: boolean }> {
  const access = await getLmsAccess()
  const admin = createAdminClient()

  const { data: lesson } = await (admin as any)
    .from('lms_lessons')
    .select('id, school_id')
    .eq('id', lessonId)
    .maybeSingle()

  if (!lesson || !canManageLesson(lesson, access)) {
    return { error: 'Not authorized to configure this lesson.' }
  }

  const { error } = await (admin as any)
    .from('lms_lessons')
    .update({ ai_tutor_enabled: enabled })
    .eq('id', lessonId)
    .eq('school_id', access.schoolId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/dashboard/lms/${lessonId}`)
  return { success: true }
}

export async function getAiAuditLogs(params?: {
  lessonId?: string
  flaggedOnly?: boolean
  limit?: number
  offset?: number
}) {
  const access = await getLmsAccess()
  if (!access.isManager) {
    throw new Error('Not authorized')
  }

  const admin = createAdminClient()
  const limit = params?.limit ?? 50
  const offset = params?.offset ?? 0

  let q = (admin as any)
    .from('lms_ai_messages')
    .select(`
      id,
      lesson_id,
      session_id,
      mode,
      asked_by,
      student_id,
      role,
      content,
      grounded,
      flagged,
      model,
      tokens_in,
      tokens_out,
      created_at,
      lesson:lms_lessons!lesson_id(id, title),
      asker:profiles!asked_by(first_name, last_name)
    `, { count: 'exact' })
    .eq('school_id', access.schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params?.lessonId) {
    q = q.eq('lesson_id', params.lessonId)
  }
  if (params?.flaggedOnly) {
    q = q.eq('flagged', true)
  }

  const { data, count, error } = await q

  if (error) {
    return { logs: [], total: 0, error: error.message }
  }

  return { logs: data ?? [], total: count ?? 0 }
}

export async function flagAiMessage(
  messageId: string,
  flagged: boolean
): Promise<{ error?: string; success?: boolean }> {
  const access = await getLmsAccess()
  if (!access.isManager) {
    return { error: 'Not authorized' }
  }

  const admin = createAdminClient()
  const { error } = await (admin as any)
    .from('lms_ai_messages')
    .update({ flagged })
    .eq('id', messageId)
    .eq('school_id', access.schoolId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/lms/ai')
  return { success: true }
}

export async function escalateAiQuestionToTeacher({
  lessonId,
  studentId,
  question,
}: {
  lessonId: string
  studentId: string
  question: string
}) {
  return askQuestion({
    lessonId,
    studentId,
    body: question,
  })
}

// ── Test AI connection (managers only) ──────────────────────────────────────

export interface AiConnectionTestResult {
  success: boolean
  provider: string
  model: string
  latencyMs?: number
  reply?: string
  errorStatus?: number | string
  errorMessage?: string
}

export async function testAiConnection(): Promise<AiConnectionTestResult> {
  const access = await getLmsAccess()
  if (!access.isManager) {
    return { success: false, provider: 'unknown', model: 'unknown', errorMessage: 'Not authorized.' }
  }

  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  const model =
    process.env.AI_MODEL || (provider === 'anthropic' ? 'claude-haiku-4-5' : 'gemini-3.5-flash-lite')

  const start = Date.now()

  try {
    if (provider === 'anthropic') {
      const { default: AnthropicClient } = await import('@anthropic-ai/sdk')
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return {
          success: false,
          provider,
          model,
          errorStatus: 'config',
          errorMessage: 'ANTHROPIC_API_KEY is not set in environment.',
        }
      }
      const client = new AnthropicClient({ apiKey })
      const msg = await client.messages.create({
        model,
        max_tokens: 30,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      })
      const latencyMs = Date.now() - start
      const reply = ((msg.content[0] as any)?.text ?? '').slice(0, 80)
      return { success: true, provider, model, latencyMs, reply }
    } else {
      // Gemini
      const { GoogleGenAI } = await import('@google/genai')
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return {
          success: false,
          provider,
          model,
          errorStatus: 'config',
          errorMessage: 'GEMINI_API_KEY is not set in environment.',
        }
      }
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'Reply with OK only.' }] }],
        config: { maxOutputTokens: 30 },
      })
      const latencyMs = Date.now() - start
      const reply = ((response as any).text ?? '').slice(0, 80)
      return { success: true, provider, model, latencyMs, reply }
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - start
    const e = err as { status?: number; message?: string }
    const errStatus = e?.status ?? 'unknown'
    const rawMsg = String(e?.message || err || 'Unknown error')
    // Redact API key if somehow present in error message
    const apiKey =
      provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY
    const safeMsg = apiKey ? rawMsg.replace(apiKey, '[REDACTED]') : rawMsg
    return {
      success: false,
      provider,
      model,
      latencyMs,
      errorStatus: errStatus,
      errorMessage: safeMsg.slice(0, 300),
    }
  }
}

