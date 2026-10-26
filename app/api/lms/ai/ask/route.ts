/* eslint-disable @typescript-eslint/no-explicit-any */
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLmsAccess, facilitatorHasTodayEntryForLesson, getAskerAccess } from '@/lib/lms/access'
import { isAiConfigured, streamAnswer, type ProviderMessage } from '@/lib/ai/provider'
import { buildSystemPrompt, buildUserPrompt, parseClassLevel, type TutorIntent } from '@/lib/ai/tutor-prompt'
import { AI_NAME } from '@/lib/ai/brand'
import { z } from 'zod'

export const maxDuration = 60

const bodySchema = z.object({
  lessonId: z.string().uuid(),
  sessionId: z.string().uuid(),
  question: z.string().min(1).max(500),
  mode: z.enum(['class', 'student']),
  studentId: z.string().uuid().optional(),
  intent: z.enum(['ask', 'simpler', 'example', 'quiz_me']).optional(),
})

export type FailureReason =
  | 'not_authorized'
  | 'ai_disabled'
  | 'no_notes'
  | 'notes_unreadable'
  | 'limit_reached'
  | 'provider_unavailable'
  | 'provider_misconfigured'
  | 'bad_request'

function failResponse({
  reason,
  status,
  friendlyMessage,
  why,
  isStaffOrManager = false,
  lessonId,
  mode,
  providerStatus,
}: {
  reason: FailureReason
  status: number
  friendlyMessage: string
  why?: string
  isStaffOrManager?: boolean
  lessonId?: string
  mode?: string
  providerStatus?: number | string
}) {
  // Requirement 4: Log one server line per failure with reason code, lesson id, mode and provider HTTP status (no question or answer text, no names)
  console.warn(
    `[LMS_AI_FAILURE] reason=${reason} lesson_id=${lessonId ?? 'none'} mode=${mode ?? 'none'} provider_status=${providerStatus ?? 'none'}${why ? ` why="${why}"` : ''}`
  )

  const body: Record<string, unknown> = {
    error: friendlyMessage,
    reason,
  }

  // Managers and facilitators may also see a small "why" line
  if (isStaffOrManager && why) {
    body.why = why
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Returns today's date in YYYY-MM-DD for a given timezone (for monthly limit scoping). */
function monthStr(tz: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' })
  const parts = formatter.formatToParts(new Date())
  return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`
}

function dayStr(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

export async function POST(req: Request) {
  // 1. Parse & validate body
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err: any) {
    return failResponse({
      reason: 'bad_request',
      status: 400,
      friendlyMessage: 'Invalid question request.',
      why: 'Request body failed validation schema',
    })
  }

  const { lessonId, sessionId, question, mode, intent = 'ask' } = body
  let studentId = body.studentId

  // 2. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return failResponse({
      reason: 'not_authorized',
      status: 401,
      friendlyMessage: 'Not found',
      why: 'User not authenticated',
      lessonId,
      mode,
    })
  }

  const access = await getLmsAccess(supabase, user)
  const { schoolId, userId, schoolTimezone } = access
  const isStaff = access.isManager || access.isFacilitator
  const admin = createAdminClient()

  // 3. Check AI global config
  if (!isAiConfigured()) {
    return failResponse({
      reason: 'provider_misconfigured',
      status: 503,
      friendlyMessage: `${AI_NAME} is not configured on this server.`,
      why: process.env.AI_DISABLED === 'true' ? 'AI_DISABLED is set to true' : 'Provider API key is missing in .env',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  // 4. Load AI settings for school
  const { data: aiSettings } = await (admin as any)
    .from('lms_ai_settings')
    .select('enabled, voice_enabled, read_aloud_enabled, daily_limit_per_student, daily_limit_per_class, monthly_limit_school')
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!aiSettings?.enabled) {
    return failResponse({
      reason: 'ai_disabled',
      status: 403,
      friendlyMessage: `${AI_NAME} is not enabled for your school.`,
      why: 'AI tutor disabled in school settings (/dashboard/lms/ai)',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  // 5. Load lesson with notes status
  const { data: lesson } = await (admin as any)
    .from('lms_lessons')
    .select('id, school_id, class_id, subject_id, status, ai_tutor_enabled, recorded_by, video_path, lms_lesson_notes_text!left(status, content)')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!lesson) {
    return failResponse({
      reason: 'not_authorized',
      status: 404,
      friendlyMessage: 'Not found',
      why: 'Lesson does not exist in this school',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  if (!lesson.ai_tutor_enabled) {
    return failResponse({
      reason: 'ai_disabled',
      status: 403,
      friendlyMessage: `${AI_NAME} is disabled for this lesson.`,
      why: 'ai_tutor_enabled is turned off on this lesson',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  const notesRow = Array.isArray(lesson.lms_lesson_notes_text)
    ? lesson.lms_lesson_notes_text[0]
    : lesson.lms_lesson_notes_text

  if (!notesRow || !notesRow.content) {
    return failResponse({
      reason: 'no_notes',
      status: 403,
      friendlyMessage: 'This lesson has no notes yet. Ask your teacher to add lesson notes first.',
      why: 'No lesson notes text found',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  if (notesRow.status !== 'ready') {
    const reasonText =
      notesRow.status === 'pending'
        ? 'Notes are being processed. Try again in a moment.'
        : notesRow.status === 'scanned'
        ? 'The lesson notes appear to be a scanned image and cannot be read by the AI.'
        : notesRow.status === 'too_long'
        ? 'The lesson notes are too long for the AI to process.'
        : 'The lesson notes could not be read.'

    return failResponse({
      reason: 'notes_unreadable',
      status: 403,
      friendlyMessage: reasonText,
      why: `Notes status is "${notesRow.status}"`,
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }
  const notesText: string = notesRow.content

  // 6. Authorization
  let authorized = false
  let authorizedStudentId: string | null = null

  if (mode === 'class') {
    // class mode: facilitator with today entry OR manager OR recorder
    if (access.isManager) {
      authorized = true
    } else if (lesson.recorded_by === userId) {
      authorized = true
    } else if (access.isFacilitator) {
      if (lesson.status !== 'published') {
        return failResponse({
          reason: 'not_authorized',
          status: 404,
          friendlyMessage: 'Not found',
          why: 'Lesson not published',
          isStaffOrManager: true,
          lessonId,
          mode,
        })
      }
      authorized = await facilitatorHasTodayEntryForLesson(access, lesson)
      if (!authorized) {
        return failResponse({
          reason: 'not_authorized',
          status: 404,
          friendlyMessage: 'Not found',
          why: 'Not scheduled for you today',
          isStaffOrManager: true,
          lessonId,
          mode,
        })
      }
    } else {
      return failResponse({
        reason: 'not_authorized',
        status: 404,
        friendlyMessage: 'Not found',
        why: 'Only assigned facilitators, recorders, or managers may use class mode',
        isStaffOrManager: isStaff,
        lessonId,
        mode,
      })
    }
  } else {
    // student mode: student themselves OR guardian of that student
    if (lesson.status !== 'published') {
      return failResponse({
        reason: 'not_authorized',
        status: 404,
        friendlyMessage: 'Not found',
        why: 'Lesson not published',
        isStaffOrManager: isStaff,
        lessonId,
        mode,
      })
    }

    // If studentId wasn't passed, attempt resolution from calling student or guardian
    if (!studentId) {
      // Check if caller is student
      const { data: selfSt } = await admin
        .from('students')
        .select('id')
        .eq('profile_id', userId)
        .eq('school_id', schoolId)
        .maybeSingle()
      if (selfSt) {
        studentId = selfSt.id
      } else {
        // Check if caller is guardian
        const { data: guardianRow } = await admin
          .from('guardians')
          .select('id')
          .eq('profile_id', userId)
          .eq('school_id', schoolId)
          .maybeSingle()
        if (guardianRow) {
          const { data: link } = await admin
            .from('student_guardians')
            .select('student_id')
            .eq('guardian_id', guardianRow.id)
            .limit(1)
            .maybeSingle()
          if (link) studentId = link.student_id
        }
      }
    }

    if (!studentId) {
      return failResponse({
        reason: 'not_authorized',
        status: 404,
        friendlyMessage: 'Not found',
        why: 'No enrolled student profile found for this user',
        isStaffOrManager: isStaff,
        lessonId,
        mode,
      })
    }

    // Managers and recorders can test student mode
    if (access.isManager || lesson.recorded_by === userId) {
      authorized = true
      authorizedStudentId = studentId
    } else {
      // Verify student or guardian enrollment using established access helper
      const asker = await getAskerAccess(userId, lessonId, studentId)
      if (asker) {
        authorized = true
        authorizedStudentId = studentId
      } else {
        return failResponse({
          reason: 'not_authorized',
          status: 404,
          friendlyMessage: 'Not found',
          why: 'Student is not actively enrolled in this lesson’s class for current session',
          isStaffOrManager: isStaff,
          lessonId,
          mode,
        })
      }
    }
  }

  if (!authorized) {
    return failResponse({
      reason: 'not_authorized',
      status: 404,
      friendlyMessage: 'Not found',
      why: 'Authorization check failed',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  // 7. Validate sessionId belongs to this asker + lesson (anti-tampering)
  const { data: existingSessionMsg } = await (admin as any)
    .from('lms_ai_messages')
    .select('asked_by, lesson_id')
    .eq('session_id', sessionId)
    .limit(1)
    .maybeSingle()

  if (existingSessionMsg) {
    if (existingSessionMsg.asked_by !== userId || existingSessionMsg.lesson_id !== lessonId) {
      return failResponse({
        reason: 'not_authorized',
        status: 404,
        friendlyMessage: 'Not found',
        why: 'Session ID mismatch or already used by another user/lesson',
        isStaffOrManager: isStaff,
        lessonId,
        mode,
      })
    }
  }

  // 8. Rate limits
  const today = dayStr(schoolTimezone)
  const todayStart = `${today}T00:00:00+00:00`
  const todayEnd = `${today}T23:59:59+00:00`
  const month = monthStr(schoolTimezone)
  const monthStart = `${month}-01T00:00:00+00:00`
  const [y, m] = month.split('-').map(Number)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00+00:00`

  const limitPerStudent = aiSettings.daily_limit_per_student ?? 20
  const limitPerClass = aiSettings.daily_limit_per_class ?? 150
  const limitMonthly = aiSettings.monthly_limit_school ?? 3000

  async function countMessages(filters: Record<string, string>) {
    let q = (admin as any)
      .from('lms_ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'user')
      .gte('created_at', filters.from)
      .lt('created_at', filters.to)
    for (const [k, v] of Object.entries(filters)) {
      if (k !== 'from' && k !== 'to') q = q.eq(k, v)
    }
    const { count } = await q
    return count ?? 0
  }

  // Burst check: max 6 per minute per user
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString()
  const { count: burstCount } = await (admin as any)
    .from('lms_ai_messages')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('asked_by', userId)
    .eq('role', 'user')
    .gte('created_at', oneMinAgo)

  if ((burstCount ?? 0) >= 6) {
    return failResponse({
      reason: 'limit_reached',
      status: 429,
      friendlyMessage: 'Too many requests. Please wait a moment before asking again.',
      why: 'Burst limit (6 requests/minute) reached',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  // Per-student daily limit (student mode)
  if (mode === 'student' && authorizedStudentId) {
    const count = await countMessages({
      student_id: authorizedStudentId,
      from: todayStart,
      to: todayEnd,
    })
    if (count >= limitPerStudent) {
      return failResponse({
        reason: 'limit_reached',
        status: 429,
        friendlyMessage: `Daily question limit reached for this student (${limitPerStudent} per day). Try again tomorrow.`,
        why: 'Per-student daily rate limit exceeded',
        isStaffOrManager: isStaff,
        lessonId,
        mode,
      })
    }
  }

  // Per-asker daily
  const askerCount = await countMessages({ asked_by: userId, from: todayStart, to: todayEnd })
  if (askerCount >= limitPerStudent * 2) {
    return failResponse({
      reason: 'limit_reached',
      status: 429,
      friendlyMessage: 'You have reached your daily question limit. Try again tomorrow.',
      why: 'Per-asker daily rate limit exceeded',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  // Per-class daily
  const classCount = await countMessages({ lesson_id: lessonId, from: todayStart, to: todayEnd })
  if (classCount >= limitPerClass) {
    return failResponse({
      reason: 'limit_reached',
      status: 429,
      friendlyMessage: 'This lesson has reached its daily question limit. Try again tomorrow.',
      why: 'Per-class daily rate limit exceeded',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  // Monthly school limit
  const monthCount = await countMessages({ from: monthStart, to: monthEnd })
  if (monthCount >= limitMonthly) {
    return failResponse({
      reason: 'limit_reached',
      status: 429,
      friendlyMessage: 'Your school has reached its monthly AI question limit. Contact your administrator.',
      why: 'School monthly rate limit exceeded',
      isStaffOrManager: isStaff,
      lessonId,
      mode,
    })
  }

  // 9. Load session history (last 6 messages from DB, NEVER from client)
  const { data: historyRows } = await (admin as any)
    .from('lms_ai_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .eq('asked_by', userId)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false })
    .limit(6)

  const history: ProviderMessage[] = ((historyRows ?? []) as any[])
    .reverse()
    .map((r: any) => ({ role: r.role as 'user' | 'assistant', content: r.content }))

  // 10. Load class name for level parsing
  const { data: classRow } = await (admin as any)
    .from('classes')
    .select('name')
    .eq('id', lesson.class_id)
    .maybeSingle()
  const classLevel = parseClassLevel(classRow?.name)

  // 11. Build prompt
  const systemPrompt = buildSystemPrompt(classLevel)
  const notesUserBlock = buildUserPrompt({ notesText, question, intent: intent as TutorIntent })

  // 12. Stream to client
  const clientSignal = req.signal

  let streamResult: Awaited<ReturnType<typeof streamAnswer>> | null = null
  try {
    streamResult = await streamAnswer({
      system: systemPrompt,
      notesUserBlock,
      history,
      question,
      maxOutputTokens: 450,
      signal: clientSignal,
    })
  } catch (err: any) {
    const errMessage = String(err?.message || err || '')
    const errStatus =
      err?.status ||
      (errMessage.includes('404') ? 404 :
       errMessage.includes('401') ? 401 :
       errMessage.includes('429') ? 429 : 503)

    const isMisconfigured =
      errMessage === 'AI_DISABLED' ||
      errMessage.includes('not found') ||
      errMessage.includes('API_KEY') ||
      errMessage.includes('model') ||
      errStatus === 404

    const reason: FailureReason = isMisconfigured ? 'provider_misconfigured' : 'provider_unavailable'

    return failResponse({
      reason,
      status: 503,
      friendlyMessage: isMisconfigured
        ? `${AI_NAME} is not properly configured. Please contact your administrator.`
        : `${AI_NAME} is temporarily unavailable. Try again shortly, or ask your teacher.`,
      why: `Provider error (${errStatus}): ${errMessage.slice(0, 160)}`,
      isStaffOrManager: isStaff,
      lessonId,
      mode,
      providerStatus: errStatus,
    })
  }

  const { chunks, getUsage } = streamResult

  // Tail buffer for grounded marker stripping (last 25 chars to safely detect [[GROUNDED:xxx]])
  const GROUNDED_RE = /\[\[GROUNDED:(yes|no)\]\]\s*$/
  const TAIL_LEN = 25
  let tail = ''
  let grounded: boolean | null = null

  const encoder = new TextEncoder()
  let userMsgId: string | null = null
  let assistantMsgId: string | null = null
  let modelName = process.env.AI_MODEL || ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = ''

        for await (const chunk of chunks) {
          if (clientSignal.aborted) {
            controller.close()
            return
          }

          // Accumulate tail for grounded marker detection
          tail += chunk
          if (tail.length > TAIL_LEN * 2) {
            // Flush safe portion from tail (everything except last TAIL_LEN chars)
            const safe = tail.slice(0, tail.length - TAIL_LEN)
            controller.enqueue(encoder.encode(safe))
            fullResponse += safe
            tail = tail.slice(tail.length - TAIL_LEN)
          }
        }

        // Process final tail — extract grounded marker
        const match = GROUNDED_RE.exec(tail)
        if (match) {
          grounded = match[1] === 'yes'
          tail = tail.replace(GROUNDED_RE, '').trimEnd()
        }

        // Flush remaining tail
        if (tail) {
          controller.enqueue(encoder.encode(tail))
          fullResponse += tail
        }

        controller.close()

        const usage = getUsage()
        modelName = usage.model

        // 13. Persist messages asynchronously
        after(async () => {
          try {
            const now = new Date().toISOString()
            // Insert user message
            const { data: userMsg } = await (admin as any)
              .from('lms_ai_messages')
              .insert({
                school_id: schoolId,
                lesson_id: lessonId,
                session_id: sessionId,
                mode,
                asked_by: userId,
                student_id: authorizedStudentId,
                role: 'user',
                content: question,
                model: usage.model,
                tokens_in: usage.tokensIn,
                tokens_out: 0,
                flagged: false,
                created_at: now,
              })
              .select('id')
              .single()
            userMsgId = userMsg?.id ?? null

            // Detect safety flag: grounded=false with safety language
            const safetyKeywords = ['unsafe', 'harm', 'teacher', 'trusted adult', 'not about the lesson']
            const flagged = safetyKeywords.some((kw) => fullResponse.toLowerCase().includes(kw))

            // Insert assistant message
            const { data: asstMsg } = await (admin as any)
              .from('lms_ai_messages')
              .insert({
                school_id: schoolId,
                lesson_id: lessonId,
                session_id: sessionId,
                mode,
                asked_by: userId,
                student_id: authorizedStudentId,
                role: 'assistant',
                content: fullResponse,
                grounded,
                flagged,
                model: usage.model,
                tokens_in: usage.tokensIn,
                tokens_out: usage.tokensOut,
                created_at: new Date().toISOString(),
              })
              .select('id')
              .single()
            assistantMsgId = asstMsg?.id ?? null

            void userMsgId; void assistantMsgId; void modelName
          } catch {
            // Never let logging break the response
          }
        })
      } catch {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Transfer-Encoding': 'chunked',
    },
  })
}
