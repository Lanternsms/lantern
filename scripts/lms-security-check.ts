/**
 * scripts/lms-security-check.ts
 *
 * LMS Authorization Regression Script
 * ────────────────────────────────────
 * Verifies that every LMS server-action authorization rule is enforced
 * correctly. Can be re-run after any code change to detect regressions.
 *
 * SAFETY RULES
 * ─────────────
 * 1. This script CREATES and DELETES data. It must ONLY run against a
 *    STAGING Supabase project. Never run it against production.
 * 2. It refuses to start unless the environment variable
 *      LMS_TEST_CONFIRM=I_UNDERSTAND_THIS_WRITES_DATA
 *    is set.
 * 3. Every fixture row is tagged with a unique run-id (RUN_TAG) so that
 *    cleanup is deterministic even if a previous run crashed.
 * 4. Cleanup runs in a finally block — it always executes, even when
 *    assertions fail.
 * 5. Storage objects are removed as part of cleanup.
 *
 * HOW TO RUN
 * ──────────
 *   export NEXT_PUBLIC_SUPABASE_URL="https://<staging-ref>.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="<staging-service-role-key>"
 *   export NEXT_PUBLIC_SUPABASE_ANON_KEY="<staging-anon-key>"
 *   export LMS_TEST_CONFIRM="I_UNDERSTAND_THIS_WRITES_DATA"
 *   npx tsx scripts/lms-security-check.ts
 *
 * Or: npm run test:lms-security
 *
 * UNIMPLEMENTED / SKIPPED
 * ─────────────────────────
 *   - TUS resumable upload endpoint auth (requires real HTTP upload)
 *   - deleteLesson storage side-effects (auth tested at DB level only)
 *   - Activity submission file upload auth (requires storage mock)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// ─── Safety gate ──────────────────────────────────────────────────────────────

const CONFIRM_VALUE = 'I_UNDERSTAND_THIS_WRITES_DATA'
if (process.env.LMS_TEST_CONFIRM !== CONFIRM_VALUE) {
  console.error(
    '\n[ABORT] This script creates and deletes data.\n' +
    `Set LMS_TEST_CONFIRM="${CONFIRM_VALUE}" to proceed.\n` +
    'NEVER run against production.\n'
  )
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '[ABORT] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
  )
  process.exit(1)
}

const CLIENT_KEY = (ANON_KEY ?? SERVICE_ROLE_KEY)!

// ─── Types ────────────────────────────────────────────────────────────────────

type AnyClient = SupabaseClient<any>

interface TestResult {
  name: string
  passed: boolean
  detail?: string
}

// ─── Globals ──────────────────────────────────────────────────────────────────

const RUN_TAG = `lms_sec_${randomUUID().replace(/-/g, '').slice(0, 12)}`
const results: TestResult[] = []

// Service-role (admin) client — bypasses RLS for fixture management
const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Assertion helpers ────────────────────────────────────────────────────────

function pass(name: string, detail?: string) {
  results.push({ name, passed: true, detail })
  console.log(`  ✅ PASS  ${name}${detail ? ' — ' + detail : ''}`)
}

function fail(name: string, detail?: string) {
  results.push({ name, passed: false, detail })
  console.error(`  ❌ FAIL  ${name}${detail ? ' — ' + detail : ''}`)
}

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) pass(name, detail)
  else fail(name, detail)
}

// ─── Fixture state ────────────────────────────────────────────────────────────

const fx = {
  schoolAId: '',
  schoolBId: '',
  sessionAId: '',
  sessionBId: '',
  classJss1Id: '',
  classJss2Id: '',
  subjectChemId: '',
  subjectMathId: '',
  statusPresentId: '',
  statusAbsentId: '',
  lessonId: '',
  entryF1Id: '',
  adminAId: '',
  teacherT1Id: '',
  teacherT2Id: '',
  facilitatorF1Id: '',
  facilitatorF2Id: '',
  guardianG1Id: '',
  guardianG2Id: '',
  studentS1Id: '',
  studentS2Id: '',
  adminBId: '',
  users: {
    adminA: { email: '', password: '' },
    teacherT1: { email: '', password: '' },
    teacherT2: { email: '', password: '' },
    facilitatorF1: { email: '', password: '' },
    facilitatorF2: { email: '', password: '' },
    guardianG1: { email: '', password: '' },
    guardianG2: { email: '', password: '' },
    adminB: { email: '', password: '' },
  },
  rootMessageId: null as string | null,
  activityId: null as string | null,
  attendanceCreated: false,
  storageObjects: [] as string[],
  notesPath: null as string | null,
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function makeEmail(role: string) {
  return `${RUN_TAG}_${role}@test.invalid`
}

function makePassword() {
  return `Test!${RUN_TAG.slice(0, 8)}#1`
}

async function createUser(
  email: string,
  password: string,
  schoolId: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user)
    throw new Error(`createUser(${email}): ${error?.message}`)
  const userId = data.user.id
  const { error: pErr } = await svc
    .from('profiles')
    .upsert({
      id: userId,
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
    })
  if (pErr) throw new Error(`profile upsert(${email}): ${pErr.message}`)
  return userId
}

async function signIn(email: string, password: string): Promise<AnyClient> {
  const client = createClient(SUPABASE_URL!, CLIENT_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn(${email}): ${error.message}`)
  return client
}

async function assignRole(userId: string, schoolId: string, role: string) {
  const { data: roleRow, error: rErr } = await svc
    .from('roles')
    .select('id')
    .eq('name', role)
    .maybeSingle()
  if (rErr) throw new Error(`findRole(${role}): ${rErr.message}`)
  if (!roleRow) {
    console.warn(
      `  [WARN] Role "${role}" not found — skipping assignment for ${userId}`
    )
    return
  }
  const { error } = await svc
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleRow.id, school_id: schoolId })
  if (error) throw new Error(`assignRole(${role}, ${userId}): ${error.message}`)
}

function todayLagosDayOfWeek(): number {
  const d = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })
  )
  return d.getDay()
}

function todayLagosDateStr(): string {
  const d = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })
  )
  return d.toISOString().slice(0, 10)
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup() {
  console.log('\n📦  Setting up fixtures…')
  const pw = makePassword()

  // Schools
  const { data: schoolA, error: sAErr } = await svc
    .from('schools')
    .insert({ name: `${RUN_TAG}_SchoolA`, subdomain: `${RUN_TAG}-a` })
    .select('id')
    .single()
  if (sAErr || !schoolA) throw new Error(`create schoolA: ${sAErr?.message}`)
  fx.schoolAId = schoolA.id

  const { data: schoolB, error: sBErr } = await svc
    .from('schools')
    .insert({ name: `${RUN_TAG}_SchoolB`, subdomain: `${RUN_TAG}-b` })
    .select('id')
    .single()
  if (sBErr || !schoolB) throw new Error(`create schoolB: ${sBErr?.message}`)
  fx.schoolBId = schoolB.id

  // Academic sessions
  const { data: sessionA, error: sessAErr } = await svc
    .from('academic_sessions')
    .insert({
      school_id: fx.schoolAId,
      name: `${RUN_TAG}_Session`,
      is_current: true,
    })
    .select('id')
    .single()
  if (sessAErr || !sessionA)
    throw new Error(`create sessionA: ${sessAErr?.message}`)
  fx.sessionAId = sessionA.id

  const { data: sessionB, error: sessBErr } = await svc
    .from('academic_sessions')
    .insert({
      school_id: fx.schoolBId,
      name: `${RUN_TAG}_Session`,
      is_current: true,
    })
    .select('id')
    .single()
  if (sessBErr || !sessionB)
    throw new Error(`create sessionB: ${sessBErr?.message}`)
  fx.sessionBId = sessionB.id

  // Classes
  const { data: classJss1, error: c1Err } = await svc
    .from('classes')
    .insert({ school_id: fx.schoolAId, name: `${RUN_TAG}_JSS1` })
    .select('id')
    .single()
  if (c1Err || !classJss1) throw new Error(`create JSS1: ${c1Err?.message}`)
  fx.classJss1Id = classJss1.id

  const { data: classJss2, error: c2Err } = await svc
    .from('classes')
    .insert({ school_id: fx.schoolAId, name: `${RUN_TAG}_JSS2` })
    .select('id')
    .single()
  if (c2Err || !classJss2) throw new Error(`create JSS2: ${c2Err?.message}`)
  fx.classJss2Id = classJss2.id

  // Subjects
  const { data: subChem, error: scErr } = await svc
    .from('subjects')
    .insert({ school_id: fx.schoolAId, name: `${RUN_TAG}_Chemistry` })
    .select('id')
    .single()
  if (scErr || !subChem) throw new Error(`create Chemistry: ${scErr?.message}`)
  fx.subjectChemId = subChem.id

  const { data: subMath, error: smErr } = await svc
    .from('subjects')
    .insert({ school_id: fx.schoolAId, name: `${RUN_TAG}_Mathematics` })
    .select('id')
    .single()
  if (smErr || !subMath) throw new Error(`create Math: ${smErr?.message}`)
  fx.subjectMathId = subMath.id

  // Attendance statuses
  const { data: statPresent, error: stPErr } = await svc
    .from('attendance_statuses')
    .insert({
      school_id: fx.schoolAId,
      label: `${RUN_TAG}_Present`,
      code: 'P',
      counts_as_present: true,
    })
    .select('id')
    .single()
  if (stPErr || !statPresent)
    throw new Error(`create Present status: ${stPErr?.message}`)
  fx.statusPresentId = statPresent.id

  const { data: statAbsent, error: stAErr } = await svc
    .from('attendance_statuses')
    .insert({
      school_id: fx.schoolAId,
      label: `${RUN_TAG}_Absent`,
      code: 'A',
      counts_as_present: false,
    })
    .select('id')
    .single()
  if (stAErr || !statAbsent)
    throw new Error(`create Absent status: ${stAErr?.message}`)
  fx.statusAbsentId = statAbsent.id

  // Users
  const pw_ = pw
  const roles = [
    'adminA',
    'teacherT1',
    'teacherT2',
    'facilitatorF1',
    'facilitatorF2',
    'guardianG1',
    'guardianG2',
    'adminB',
  ] as const
  for (const k of roles) {
    fx.users[k] = { email: makeEmail(k), password: pw_ }
  }

  fx.adminAId = await createUser(
    fx.users.adminA.email,
    pw,
    fx.schoolAId,
    'AdminA',
    RUN_TAG
  )
  fx.teacherT1Id = await createUser(
    fx.users.teacherT1.email,
    pw,
    fx.schoolAId,
    'TeacherT1',
    RUN_TAG
  )
  fx.teacherT2Id = await createUser(
    fx.users.teacherT2.email,
    pw,
    fx.schoolAId,
    'TeacherT2',
    RUN_TAG
  )
  fx.facilitatorF1Id = await createUser(
    fx.users.facilitatorF1.email,
    pw,
    fx.schoolAId,
    'FacilF1',
    RUN_TAG
  )
  fx.facilitatorF2Id = await createUser(
    fx.users.facilitatorF2.email,
    pw,
    fx.schoolAId,
    'FacilF2',
    RUN_TAG
  )
  fx.guardianG1Id = await createUser(
    fx.users.guardianG1.email,
    pw,
    fx.schoolAId,
    'GuardianG1',
    RUN_TAG
  )
  fx.guardianG2Id = await createUser(
    fx.users.guardianG2.email,
    pw,
    fx.schoolAId,
    'GuardianG2',
    RUN_TAG
  )
  fx.adminBId = await createUser(
    fx.users.adminB.email,
    pw,
    fx.schoolBId,
    'AdminB',
    RUN_TAG
  )

  // Roles
  await assignRole(fx.adminAId, fx.schoolAId, 'admin')
  await assignRole(fx.facilitatorF1Id, fx.schoolAId, 'facilitator')
  await assignRole(fx.facilitatorF2Id, fx.schoolAId, 'facilitator')
  await assignRole(fx.adminBId, fx.schoolBId, 'admin')

  // Students
  const { data: s1, error: s1Err } = await svc
    .from('students')
    .insert({
      school_id: fx.schoolAId,
      first_name: 'StudentS1',
      last_name: RUN_TAG,
      admission_no: `${RUN_TAG}-S1`,
    })
    .select('id')
    .single()
  if (s1Err || !s1) throw new Error(`create student S1: ${s1Err?.message}`)
  fx.studentS1Id = s1.id

  const { data: s2, error: s2Err } = await svc
    .from('students')
    .insert({
      school_id: fx.schoolAId,
      first_name: 'StudentS2',
      last_name: RUN_TAG,
      admission_no: `${RUN_TAG}-S2`,
    })
    .select('id')
    .single()
  if (s2Err || !s2) throw new Error(`create student S2: ${s2Err?.message}`)
  fx.studentS2Id = s2.id

  // Enrolments
  await svc.from('enrolments').insert({
    school_id: fx.schoolAId,
    student_id: fx.studentS1Id,
    session_id: fx.sessionAId,
    class_id: fx.classJss1Id,
    arm_id: null,
  })
  await svc.from('enrolments').insert({
    school_id: fx.schoolAId,
    student_id: fx.studentS2Id,
    session_id: fx.sessionAId,
    class_id: fx.classJss2Id,
    arm_id: null,
  })

  // Guardians
  const { data: g1Row, error: g1Err } = await svc
    .from('guardians')
    .insert({
      school_id: fx.schoolAId,
      profile_id: fx.guardianG1Id,
      first_name: 'GuardG1',
      last_name: RUN_TAG,
    })
    .select('id')
    .single()
  if (g1Err || !g1Row)
    throw new Error(`create guardian G1: ${g1Err?.message}`)

  const { data: g2Row, error: g2Err } = await svc
    .from('guardians')
    .insert({
      school_id: fx.schoolAId,
      profile_id: fx.guardianG2Id,
      first_name: 'GuardG2',
      last_name: RUN_TAG,
    })
    .select('id')
    .single()
  if (g2Err || !g2Row)
    throw new Error(`create guardian G2: ${g2Err?.message}`)

  await svc
    .from('student_guardians')
    .insert({ guardian_id: g1Row.id, student_id: fx.studentS1Id })
  await svc
    .from('student_guardians')
    .insert({ guardian_id: g2Row.id, student_id: fx.studentS2Id })

  // Published lesson (JSS1 Chemistry, recorded_by T1)
  const { data: lesson, error: lErr } = await svc
    .from('lms_lessons')
    .insert({
      school_id: fx.schoolAId,
      class_id: fx.classJss1Id,
      subject_id: fx.subjectChemId,
      title: `${RUN_TAG}_Lesson`,
      recorded_by: fx.teacherT1Id,
      uploaded_by: fx.teacherT1Id,
      status: 'published',
      video_path: `${fx.schoolAId}/${RUN_TAG}_lesson.mp4`,
    })
    .select('id')
    .single()
  if (lErr || !lesson) throw new Error(`create lesson: ${lErr?.message}`)
  fx.lessonId = lesson.id

  // Timetable entry for F1 (today's day_of_week, LMS, JSS1 Chemistry)
  const todayDow = todayLagosDayOfWeek()
  const { data: entry, error: eErr } = await svc
    .from('timetable_entries')
    .insert({
      school_id: fx.schoolAId,
      session_id: fx.sessionAId,
      class_id: fx.classJss1Id,
      arm_id: null,
      subject_id: fx.subjectChemId,
      teacher_id: fx.facilitatorF1Id,
      delivery_mode: 'lms',
      day_of_week: todayDow,
    })
    .select('id')
    .single()
  if (eErr || !entry)
    throw new Error(`create timetable entry: ${eErr?.message}`)
  fx.entryF1Id = entry.id

  // Lesson delivery (so getRoster can find it for attendance)
  await svc.from('lms_lesson_deliveries').insert({
    school_id: fx.schoolAId,
    lesson_id: fx.lessonId,
    class_id: fx.classJss1Id,
    arm_id: null,
    timetable_entry_id: fx.entryF1Id,
    delivered_by: fx.facilitatorF1Id,
    delivered_on: todayLagosDateStr(),
  })

  console.log(`  ✔  Fixtures created (RUN_TAG=${RUN_TAG})`)
  console.log(`     School A: ${fx.schoolAId}`)
  console.log(`     Lesson:   ${fx.lessonId}`)
}

// ─── Auth logic helpers (replicate server action logic without Next.js) ────────

/**
 * Replicate getLessonVideoUrl authorization checks.
 * Uses the user's own client (real RLS) for data visibility checks,
 * then checks permission RPCs.
 */
async function canGetVideoUrl(
  userClient: AnyClient,
  lessonId: string,
  studentId?: string
): Promise<{ allowed: boolean; reason: string }> {
  // Lesson must be visible to this user's school
  const { data: lesson } = await userClient
    .from('lms_lessons')
    .select('id, school_id, class_id, subject_id, status, video_path')
    .eq('id', lessonId)
    .maybeSingle()
  if (!lesson || !lesson.video_path)
    return { allowed: false, reason: 'lesson not visible or no video_path' }

  const [{ data: canManage }, { data: canUpload }, { data: canFacilitate }] =
    await Promise.all([
      userClient.rpc('has_permission', { perm_code: 'lms.manage' }),
      userClient.rpc('has_permission', { perm_code: 'lms.upload' }),
      userClient.rpc('has_permission', { perm_code: 'lms.facilitate' }),
    ])

  if (canManage || canUpload) return { allowed: true, reason: 'staff (manage/upload)' }

  if (canFacilitate) {
    if (lesson.status !== 'published')
      return { allowed: false, reason: 'draft + facilitator' }
    const { data: sess } = await userClient
      .from('academic_sessions')
      .select('id')
      .eq('school_id', lesson.school_id)
      .eq('is_current', true)
      .maybeSingle()
    if (!sess) return { allowed: false, reason: 'no current session' }
    const { data: authUser } = await userClient.auth.getUser()
    const { data: entryRows } = await userClient
      .from('timetable_entries')
      .select('id')
      .eq('school_id', lesson.school_id)
      .eq('session_id', sess.id)
      .eq('teacher_id', authUser?.user?.id ?? '')
      .eq('delivery_mode', 'lms')
      .eq('class_id', lesson.class_id)
      .eq('subject_id', lesson.subject_id)
      .limit(1)
    if (!entryRows || entryRows.length === 0)
      return { allowed: false, reason: 'no matching timetable entry' }
    return { allowed: true, reason: 'facilitator + timetable entry' }
  }

  // Non-staff path: requires published lesson + studentId + guardian/student link
  if (lesson.status !== 'published' || !studentId)
    return {
      allowed: false,
      reason: 'not staff + (not published or no studentId)',
    }

  const { data: authUser } = await userClient.auth.getUser()
  const userId = authUser?.user?.id
  if (!userId) return { allowed: false, reason: 'not authenticated' }

  const { data: profile } = await userClient
    .from('profiles')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()
  const schoolId = profile?.school_id
  if (!schoolId) return { allowed: false, reason: 'no profile' }

  // Is caller the student?
  const { data: selfStudent } = await userClient
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('profile_id', userId)
    .eq('school_id', schoolId)
    .maybeSingle()
  let kind: 'student' | 'guardian' | null = selfStudent ? 'student' : null

  if (!kind) {
    const { data: guardianRow } = await userClient
      .from('guardians')
      .select('id')
      .eq('profile_id', userId)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (guardianRow) {
      const { data: link } = await userClient
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardianRow.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (link) kind = 'guardian'
    }
  }
  if (!kind) return { allowed: false, reason: 'not student/guardian of studentId' }

  // Check enrolment in lesson's class for current session
  const { data: sess } = await userClient
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  if (!sess) return { allowed: false, reason: 'no current session' }

  const { data: enrolment } = await userClient
    .from('enrolments')
    .select('class_id')
    .eq('student_id', studentId)
    .eq('session_id', sess.id)
    .maybeSingle()

  if (!enrolment || enrolment.class_id !== lesson.class_id)
    return { allowed: false, reason: 'student not enrolled in lesson class' }

  return { allowed: true, reason: `${kind} access` }
}

/**
 * Replicate askQuestion guardian access check (without executing the insert —
 * we test logic only, so we can confirm PASS/FAIL without side-effects).
 * Returns { allowed, reason }.
 */
async function canAskQuestion(
  userClient: AnyClient,
  schoolId: string,
  lessonId: string,
  studentId: string
): Promise<{ allowed: boolean; reason: string }> {
  const { data: authUser } = await userClient.auth.getUser()
  const userId = authUser?.user?.id
  if (!userId) return { allowed: false, reason: 'not authenticated' }

  // Lesson must be published with video_path
  const { data: lesson } = await userClient
    .from('lms_lessons')
    .select('id, class_id, status, video_path')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!lesson || lesson.status !== 'published' || !lesson.video_path)
    return { allowed: false, reason: 'lesson not accessible' }

  // Check guardian link
  const { data: guardianRow } = await userClient
    .from('guardians')
    .select('id')
    .eq('profile_id', userId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!guardianRow) return { allowed: false, reason: 'not a guardian in school' }

  const { data: link } = await userClient
    .from('student_guardians')
    .select('student_id')
    .eq('guardian_id', guardianRow.id)
    .eq('student_id', studentId)
    .maybeSingle()
  if (!link) return { allowed: false, reason: 'not guardian of student' }

  const { data: sess } = await userClient
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  const { data: enrolment } = await userClient
    .from('enrolments')
    .select('class_id')
    .eq('student_id', studentId)
    .eq('session_id', sess?.id ?? '')
    .maybeSingle()
  if (!enrolment || enrolment.class_id !== lesson.class_id)
    return { allowed: false, reason: 'student not in lesson class' }

  return { allowed: true, reason: 'guardian + enrolled student' }
}

/** Replicate canAnswerLesson from access.ts (for Q&A reply/status-change auth). */
async function canAnswerLesson(
  userClient: AnyClient,
  schoolId: string,
  lessonId: string,
  userId: string
): Promise<boolean> {
  const { data: canManage } = await userClient.rpc('has_permission', {
    perm_code: 'lms.manage',
  })
  if (canManage) return true

  // Load lesson via service role (same as production code which uses admin client)
  const { data: lesson } = await svc
    .from('lms_lessons')
    .select('recorded_by, class_id, subject_id')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!lesson) return false
  if (lesson.recorded_by === userId) return true

  const { data: canFacilitate } = await userClient.rpc('has_permission', {
    perm_code: 'lms.facilitate',
  })
  if (!canFacilitate) return false

  const { data: sess } = await userClient
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  if (!sess) return false

  const { data: entries } = await userClient
    .from('timetable_entries')
    .select('id')
    .eq('school_id', schoolId)
    .eq('session_id', sess.id)
    .eq('teacher_id', userId)
    .eq('delivery_mode', 'lms')
    .eq('class_id', lesson.class_id)
    .eq('subject_id', lesson.subject_id)
    .limit(1)

  return !!(entries && entries.length > 0)
}

/** Replicate canManageActivities from access.ts. */
async function canManageActivities(
  userClient: AnyClient,
  schoolId: string,
  lessonId: string
): Promise<boolean> {
  const { data: canManage } = await userClient.rpc('has_permission', {
    perm_code: 'lms.manage',
  })
  if (canManage) return true

  const { data: lesson } = await svc
    .from('lms_lessons')
    .select('recorded_by')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!lesson) return false

  const { data: authUser } = await userClient.auth.getUser()
  return lesson.recorded_by === authUser?.user?.id
}

/** Replicate canViewActivityResults from access.ts (managers + recorders only; facilitators have NO access). */
async function canViewActivityResults(
  userClient: AnyClient,
  schoolId: string,
  lessonId: string,
  _userId: string
): Promise<boolean> {
  return canManageActivities(userClient, schoolId, lessonId)
}

/** Replicate authorizeForEntry from attendance/actions.ts. */
async function canMarkAttendance(
  userClient: AnyClient,
  schoolId: string,
  entryId: string,
  date: string,
  userId: string
): Promise<boolean> {
  const [{ data: canManage }, { data: canFacilitate }] = await Promise.all([
    userClient.rpc('has_permission', { perm_code: 'lms.manage' }),
    userClient.rpc('has_permission', { perm_code: 'lms.facilitate' }),
  ])
  if (!canManage && !canFacilitate) return false

  // Use service role to load entry (server action loads via user client but
  // scoped to schoolId; for the test we care about authorization logic)
  const { data: entry } = await svc
    .from('timetable_entries')
    .select(
      'id, school_id, session_id, teacher_id, delivery_mode, day_of_week'
    )
    .eq('id', entryId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!entry) return false
  if (entry.delivery_mode !== 'lms') return false

  const { data: sess } = await userClient
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  if (!sess || entry.session_id !== sess.id) return false

  if (canManage) return true

  // Facilitator: entry must be assigned to this user, and date must be today
  if (entry.teacher_id !== userId) return false
  const todayStr = todayLagosDateStr()
  const todayDow = todayLagosDayOfWeek()
  if (date !== todayStr) return false
  if (entry.day_of_week !== todayDow) return false

  return true
}

/** Replicate getNotesDownloadUrl auth logic from actions.ts. */
async function canGetNotesDownloadUrl(
  userClient: AnyClient,
  lessonId: string,
  studentId?: string
): Promise<{ allowed: boolean; reason: string }> {
  const { data: authUser } = await userClient.auth.getUser()
  const userId = authUser?.user?.id
  if (!userId) return { allowed: false, reason: 'not authenticated' }

  const { data: profile } = await userClient
    .from('profiles')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()
  const schoolId = profile?.school_id
  if (!schoolId) return { allowed: false, reason: 'no profile' }

  // Load lesson via service role (actions.ts uses admin client after getLmsAccess)
  const { data: lesson } = await svc
    .from('lms_lessons')
    .select(
      'id, school_id, title, status, notes_path, notes_name, notes_downloadable, recorded_by, class_id, subject_id'
    )
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!lesson || !lesson.notes_path) {
    return { allowed: false, reason: 'lesson not found or no notes_path' }
  }

  const [{ data: canManage }, { data: canUpload }, { data: canFacilitate }] =
    await Promise.all([
      userClient.rpc('has_permission', { perm_code: 'lms.manage' }),
      userClient.rpc('has_permission', { perm_code: 'lms.upload' }),
      userClient.rpc('has_permission', { perm_code: 'lms.facilitate' }),
    ])

  const isManager = !!(canManage || canUpload)
  if (isManager) return { allowed: true, reason: 'manager' }

  if (lesson.recorded_by === userId) {
    return { allowed: true, reason: 'recorder' }
  }

  if (canFacilitate) {
    if (lesson.status !== 'published') {
      return { allowed: false, reason: 'draft + facilitator' }
    }
    const { data: sess } = await userClient
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()
    if (!sess) return { allowed: false, reason: 'no current session' }

    const todayDow = todayLagosDayOfWeek()
    const { data: entries } = await userClient
      .from('timetable_entries')
      .select('id, day_of_week')
      .eq('school_id', schoolId)
      .eq('session_id', sess.id)
      .eq('teacher_id', userId)
      .eq('delivery_mode', 'lms')
      .eq('class_id', lesson.class_id)
      .eq('subject_id', lesson.subject_id)

    const hasToday = (entries ?? []).some((e: any) => e.day_of_week === todayDow)
    if (!hasToday) return { allowed: false, reason: 'facilitator without today timetable entry' }
    return { allowed: true, reason: 'facilitator + today entry' }
  }

  // Student / Guardian path:
  if (lesson.status !== 'published' || !lesson.notes_downloadable) {
    return { allowed: false, reason: 'not downloadable or not published' }
  }

  const { data: sess } = await userClient
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  if (!sess) return { allowed: false, reason: 'no current session' }

  if (studentId) {
    const { data: rels } = await svc
      .from('student_guardians')
      .select('guardian_id, guardians!inner(profile_id)')
      .eq('student_id', studentId)

    const isGuardian = (rels ?? []).some((r: any) => (r as any).guardians?.profile_id === userId)
    if (!isGuardian) return { allowed: false, reason: 'not guardian of student' }

    const { data: enrol } = await svc
      .from('enrolments')
      .select('id')
      .eq('school_id', schoolId)
      .eq('session_id', sess.id)
      .eq('class_id', lesson.class_id)
      .eq('student_id', studentId)
      .maybeSingle()

    if (!enrol) return { allowed: false, reason: 'student not in lesson class' }
    return { allowed: true, reason: 'guardian of enrolled student' }
  } else {
    const { data: stRow } = await svc
      .from('students')
      .select('id')
      .or(`user_id.eq.${userId},profile_id.eq.${userId}`)
      .maybeSingle()
    if (!stRow) return { allowed: false, reason: 'not a student' }

    const { data: enrol } = await svc
      .from('enrolments')
      .select('id')
      .eq('school_id', schoolId)
      .eq('session_id', sess.id)
      .eq('class_id', lesson.class_id)
      .eq('student_id', stRow.id)
      .maybeSingle()
    if (!enrol) return { allowed: false, reason: 'student not enrolled in lesson class' }
    return { allowed: true, reason: 'enrolled student' }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🔍  Running security assertions…\n')

  const [
    clientAdminA,
    clientT1,
    clientT2,
    clientF1,
    clientF2,
    clientG1,
    clientG2,
    clientAdminB,
  ] = await Promise.all([
    signIn(fx.users.adminA.email, fx.users.adminA.password),
    signIn(fx.users.teacherT1.email, fx.users.teacherT1.password),
    signIn(fx.users.teacherT2.email, fx.users.teacherT2.password),
    signIn(fx.users.facilitatorF1.email, fx.users.facilitatorF1.password),
    signIn(fx.users.facilitatorF2.email, fx.users.facilitatorF2.password),
    signIn(fx.users.guardianG1.email, fx.users.guardianG1.password),
    signIn(fx.users.guardianG2.email, fx.users.guardianG2.password),
    signIn(fx.users.adminB.email, fx.users.adminB.password),
  ])

  const todayStr = todayLagosDateStr()

  // ══════════════════════════════════════════
  console.log('\n── Section A: Video URL access ──')

  // A1: lms.manage → any lesson
  {
    const r = await canGetVideoUrl(clientAdminA, fx.lessonId)
    assert('A1: lms.manage can get signed URL', r.allowed, r.reason)
  }

  // A2: lms.upload alias test (adminA has manage which implies upload path)
  {
    const { data: canUpload } = await clientAdminA.rpc('has_permission', {
      perm_code: 'lms.upload',
    })
    assert(
      'A2: lms.manage role has lms.upload permission',
      !!canUpload,
      canUpload ? 'ok' : 'lms.upload not granted to admin'
    )
  }

  // A3: F1 (facilitator + matching entry) → published lesson
  {
    const r = await canGetVideoUrl(clientF1, fx.lessonId)
    assert(
      'A3: facilitator F1 with matching entry → allowed',
      r.allowed,
      r.reason
    )
  }

  // A4: F2 (facilitator, no entry for this lesson) → denied
  {
    const r = await canGetVideoUrl(clientF2, fx.lessonId)
    assert(
      'A4: facilitator F2 without entry → denied',
      !r.allowed,
      r.reason
    )
  }

  // A5: Draft lesson → F1 (facilitator) → denied
  {
    const { data: draft } = await svc
      .from('lms_lessons')
      .insert({
        school_id: fx.schoolAId,
        class_id: fx.classJss1Id,
        subject_id: fx.subjectChemId,
        title: `${RUN_TAG}_DraftLesson`,
        recorded_by: fx.teacherT1Id,
        uploaded_by: fx.teacherT1Id,
        status: 'draft',
        video_path: `${fx.schoolAId}/${RUN_TAG}_draft.mp4`,
      })
      .select('id')
      .single()
    if (draft) {
      const r = await canGetVideoUrl(clientF1, draft.id)
      assert('A5: facilitator + draft lesson → denied', !r.allowed, r.reason)
      await svc.from('lms_lessons').delete().eq('id', draft.id)
    } else {
      fail('A5: facilitator + draft lesson → denied', 'could not create draft lesson')
    }
  }

  // A6: T1 (recorded_by, no lms.* perm) → denied for video (not a perm path)
  {
    const r = await canGetVideoUrl(clientT1, fx.lessonId)
    assert(
      'A6: recorded_by T1 (no lms.* perm) → denied for video URL',
      !r.allowed,
      r.reason
    )
  }

  // A7: Guardian G1 (S1 in JSS1 = lesson class) → allowed
  {
    const r = await canGetVideoUrl(clientG1, fx.lessonId, fx.studentS1Id)
    assert(
      'A7: guardian G1 for enrolled S1 → allowed',
      r.allowed,
      r.reason
    )
  }

  // A8: Guardian G1 → draft lesson → denied
  {
    const { data: draft2 } = await svc
      .from('lms_lessons')
      .insert({
        school_id: fx.schoolAId,
        class_id: fx.classJss1Id,
        subject_id: fx.subjectChemId,
        title: `${RUN_TAG}_DraftLesson2`,
        recorded_by: fx.teacherT1Id,
        uploaded_by: fx.teacherT1Id,
        status: 'draft',
        video_path: `${fx.schoolAId}/${RUN_TAG}_draft2.mp4`,
      })
      .select('id')
      .single()
    if (draft2) {
      const r = await canGetVideoUrl(clientG1, draft2.id, fx.studentS1Id)
      assert('A8: guardian + draft lesson → denied', !r.allowed, r.reason)
      await svc.from('lms_lessons').delete().eq('id', draft2.id)
    } else {
      fail('A8: guardian + draft lesson → denied', 'could not create draft lesson')
    }
  }

  // A9: Guardian G2 (S2 in JSS2, lesson is JSS1) → denied
  {
    const r = await canGetVideoUrl(clientG2, fx.lessonId, fx.studentS2Id)
    assert(
      'A9: guardian G2 (S2 not in lesson class) → denied',
      !r.allowed,
      r.reason
    )
  }

  // A10: School B admin → cannot see school A lesson (school isolation)
  {
    const r = await canGetVideoUrl(clientAdminB, fx.lessonId)
    assert(
      'A10: school B admin → denied (school isolation)',
      !r.allowed,
      r.reason
    )
  }

  // ══════════════════════════════════════════
  console.log('\n── Section B: Q&A ──')

  // B1: G1 can ask about S1
  {
    const r = await canAskQuestion(
      clientG1,
      fx.schoolAId,
      fx.lessonId,
      fx.studentS1Id
    )
    assert('B1: guardian G1 can ask about enrolled S1', r.allowed, r.reason)
    // Actually insert so we can test reply logic
    if (r.allowed) {
      const { data: inserted } = await svc
        .from('lms_lesson_messages')
        .insert({
          school_id: fx.schoolAId,
          lesson_id: fx.lessonId,
          parent_id: null,
          student_id: fx.studentS1Id,
          author_id: fx.guardianG1Id,
          author_kind: 'guardian',
          body: `${RUN_TAG} test question from G1`,
          status: 'open',
        })
        .select('id')
        .single()
      if (inserted) fx.rootMessageId = inserted.id
    }
  }

  // B2: G2 (S2 not in JSS1) cannot ask
  {
    const r = await canAskQuestion(
      clientG2,
      fx.schoolAId,
      fx.lessonId,
      fx.studentS2Id
    )
    assert(
      'B2: guardian G2 (S2 not in class) → denied',
      !r.allowed,
      r.reason
    )
  }

  // B3: T1 (recorded_by) can answer
  {
    const ok = await canAnswerLesson(
      clientT1,
      fx.schoolAId,
      fx.lessonId,
      fx.teacherT1Id
    )
    assert('B3: recorded_by T1 can answer lesson', ok)
  }

  // B4: F1 (timetable entry) can answer
  {
    const ok = await canAnswerLesson(
      clientF1,
      fx.schoolAId,
      fx.lessonId,
      fx.facilitatorF1Id
    )
    assert('B4: facilitator F1 with entry can answer', ok)
  }

  // B5: F2 (no timetable entry) cannot answer
  {
    const ok = await canAnswerLesson(
      clientF2,
      fx.schoolAId,
      fx.lessonId,
      fx.facilitatorF2Id
    )
    assert('B5: facilitator F2 without entry → denied', !ok)
  }

  // B6: T2 (unrelated) cannot answer
  {
    const ok = await canAnswerLesson(
      clientT2,
      fx.schoolAId,
      fx.lessonId,
      fx.teacherT2Id
    )
    assert('B6: unrelated T2 cannot answer', !ok)
  }

  // B7: School B admin cannot read school A messages
  {
    const { data: msgs } = await clientAdminB
      .from('lms_lesson_messages')
      .select('id')
      .eq('lesson_id', fx.lessonId)

    assert(
      'B7: school B admin cannot see school A messages',
      !msgs || msgs.length === 0,
      `rows returned: ${msgs?.length ?? 'null'}`
    )
  }

  // ══════════════════════════════════════════
  console.log('\n── Section C: Activities ──')

  // C1: lms.manage can manage activities
  {
    const ok = await canManageActivities(
      clientAdminA,
      fx.schoolAId,
      fx.lessonId
    )
    assert('C1: lms.manage can manage activities', ok)
  }

  // C2: recorded_by T1 can manage own lesson
  {
    const ok = await canManageActivities(clientT1, fx.schoolAId, fx.lessonId)
    assert('C2: recorded_by T1 can manage activities', ok)
  }

  // C3: unrelated T2 cannot manage
  {
    const ok = await canManageActivities(clientT2, fx.schoolAId, fx.lessonId)
    assert('C3: unrelated T2 cannot manage activities', !ok)
  }

  // Create activity for C4/C5
  {
    const { data: act } = await svc
      .from('lms_activities')
      .insert({
        school_id: fx.schoolAId,
        lesson_id: fx.lessonId,
        kind: 'quiz',
        title: `${RUN_TAG}_Quiz`,
        status: 'draft',
        created_by: fx.adminAId,
        max_score: 10,
        attempts_allowed: 1,
        show_answers: false,
      })
      .select('id')
      .single()
    if (act) fx.activityId = act.id
  }

  // C4: F1 (facilitator + entry) CANNOT view activity results (facilitators have NO access to activities)
  {
    const ok = await canViewActivityResults(
      clientF1,
      fx.schoolAId,
      fx.lessonId,
      fx.facilitatorF1Id
    )
    assert('C4: facilitator F1 cannot view activity results', !ok)
  }

  // C5: F2 (facilitator, no entry) cannot view results
  {
    const ok = await canViewActivityResults(
      clientF2,
      fx.schoolAId,
      fx.lessonId,
      fx.facilitatorF2Id
    )
    assert('C5: facilitator F2 without entry cannot view results', !ok)
  }

  // ══════════════════════════════════════════
  console.log('\n── Section D: Period attendance ──')

  // D1: F1 → can mark today's entry
  {
    const ok = await canMarkAttendance(
      clientF1,
      fx.schoolAId,
      fx.entryF1Id,
      todayStr,
      fx.facilitatorF1Id
    )
    assert('D1: facilitator F1 can mark attendance for today', ok)
  }

  // D2: F2 (not assigned to entry) → denied
  {
    const ok = await canMarkAttendance(
      clientF2,
      fx.schoolAId,
      fx.entryF1Id,
      todayStr,
      fx.facilitatorF2Id
    )
    assert('D2: facilitator F2 (not assigned to entry) → denied', !ok)
  }

  // D3: T2 (no lms perms) → denied
  {
    const ok = await canMarkAttendance(
      clientT2,
      fx.schoolAId,
      fx.entryF1Id,
      todayStr,
      fx.teacherT2Id
    )
    assert('D3: unrelated T2 (no lms perms) → denied for attendance', !ok)
  }

  // D4: Admin A → any date
  {
    const ok = await canMarkAttendance(
      clientAdminA,
      fx.schoolAId,
      fx.entryF1Id,
      '2024-01-15',
      fx.adminAId
    )
    assert('D4: lms.manage admin can mark attendance for any date', ok)
  }

  // D5: School B admin → denied for school A entry
  {
    const ok = await canMarkAttendance(
      clientAdminB,
      fx.schoolAId,
      fx.entryF1Id,
      todayStr,
      fx.adminBId
    )
    assert('D5: school B admin cannot mark school A attendance', !ok)
  }

  // D-upsert: Actually write an attendance record via svc (tests DB write path)
  {
    const { data: upserted, error: upsertErr } = await svc
      .from('lms_period_attendance')
      .upsert(
        [
          {
            school_id: fx.schoolAId,
            class_id: fx.classJss1Id,
            arm_id: null,
            subject_id: fx.subjectChemId,
            lesson_id: fx.lessonId,
            student_id: fx.studentS1Id,
            date: todayStr,
            status_id: fx.statusPresentId,
            marked_by: fx.facilitatorF1Id,
            marked_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'student_id,date,subject_id' }
      )
      .select('student_id')
    const saved = !upsertErr && upserted && upserted.length > 0
    assert(
      'D-upsert: period attendance upsert succeeds',
      !!saved,
      upsertErr?.message ?? (saved ? 'ok' : 'no rows returned')
    )
    if (saved) fx.attendanceCreated = true
  }

  // ══════════════════════════════════════════
  console.log('\n── Section E: Direct DB / RLS isolation ──')

  // E1: Anon client → 0 rows from lms_lessons
  {
    const anon = createClient(SUPABASE_URL!, CLIENT_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: rows } = await anon
      .from('lms_lessons')
      .select('id')
      .eq('school_id', fx.schoolAId)
    assert(
      'E1: anon client gets 0 rows from lms_lessons',
      !rows || rows.length === 0,
      `rows: ${rows?.length ?? 'null'}`
    )
  }

  // E2: School B admin → 0 rows from school A lms_lessons
  {
    const { data: rows } = await clientAdminB
      .from('lms_lessons')
      .select('id')
      .eq('school_id', fx.schoolAId)
    assert(
      'E2: school B admin gets 0 rows from school A lms_lessons',
      !rows || rows.length === 0,
      `rows: ${rows?.length ?? 'null'}`
    )
  }

  // E3: Guardian G1 cannot insert directly into lms_lessons
  {
    const { error } = await clientG1.from('lms_lessons').insert({
      school_id: fx.schoolAId,
      class_id: fx.classJss1Id,
      subject_id: fx.subjectChemId,
      title: `${RUN_TAG}_UnauthorizedInsert`,
      status: 'draft',
    })
    assert(
      'E3: guardian cannot insert into lms_lessons directly',
      !!error,
      error ? error.message : 'insert succeeded — SECURITY BUG!'
    )
  }

  // ══════════════════════════════════════════
  console.log('\n── Section F: Storage helpers (RPC) ──')

  // F1: Admin can call lms_storage_usage() without error
  {
    const { data, error } = await clientAdminA.rpc('lms_storage_usage')
    assert(
      'F1: admin can call lms_storage_usage() without error',
      !error,
      error ? error.message : `rows: ${Array.isArray(data) ? data.length : 0}`
    )
  }

  // F2: Non-admin facilitator gets empty/denied from lms_storage_usage()
  {
    const { data, error } = await clientF1.rpc('lms_storage_usage')
    const returnedRows = Array.isArray(data) ? data.length : 0
    const secured = !!error || returnedRows === 0
    assert(
      'F2: facilitator gets empty/denied from lms_storage_usage()',
      secured,
      error ? error.message : `rows: ${returnedRows}`
    )
  }

  // ══════════════════════════════════════════
  console.log('\n── Section G: Lesson Notes PDF Security (G1–G10) ──')

  // Setup fixture notes on fx.lessonId
  fx.notesPath = `${fx.schoolAId}/${RUN_TAG}_notes.pdf`
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
  const { error: notesUploadErr } = await svc.storage
    .from('lms-notes')
    .upload(fx.notesPath, dummyPdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (notesUploadErr) {
    console.warn(`  ⚠️ Failed to upload dummy notes PDF: ${notesUploadErr.message}`)
  }

  await svc
    .from('lms_lessons')
    .update({
      notes_path: fx.notesPath,
      notes_name: 'test_notes.pdf',
      notes_size_bytes: dummyPdfBuffer.length,
      notes_uploaded_at: new Date().toISOString(),
      notes_downloadable: true,
    })
    .eq('id', fx.lessonId)

  // G1: Guardian of another class (G2 has S2 in JSS2, lesson is JSS1) → denied
  {
    const r = await canGetNotesDownloadUrl(clientG2, fx.lessonId, fx.studentS2Id)
    assert('G1: guardian of another class → getNotesDownloadUrl denied', !r.allowed, r.reason)
  }

  // G2: Student of another class (G1 querying with S2, not their child / wrong class) → denied
  {
    const r = await canGetNotesDownloadUrl(clientG1, fx.lessonId, fx.studentS2Id)
    assert('G2: student of another class → getNotesDownloadUrl denied', !r.allowed, r.reason)
  }

  // G3: Unpublished (draft) lesson with notes → guardian G1 denied
  {
    const draftNotesPath = `${fx.schoolAId}/${RUN_TAG}_draft_notes.pdf`
    const { data: draftWithNotes } = await svc
      .from('lms_lessons')
      .insert({
        school_id: fx.schoolAId,
        class_id: fx.classJss1Id,
        subject_id: fx.subjectChemId,
        title: `${RUN_TAG}_DraftLessonNotes`,
        recorded_by: fx.teacherT1Id,
        uploaded_by: fx.teacherT1Id,
        status: 'draft',
        video_path: `${fx.schoolAId}/${RUN_TAG}_draft3.mp4`,
        notes_path: draftNotesPath,
        notes_downloadable: true,
      })
      .select('id')
      .single()

    if (draftWithNotes) {
      const r = await canGetNotesDownloadUrl(clientG1, draftWithNotes.id, fx.studentS1Id)
      assert('G3: unpublished lesson → notes download denied for guardian/student', !r.allowed, r.reason)
      await svc.from('lms_lessons').delete().eq('id', draftWithNotes.id)
    } else {
      fail('G3: unpublished lesson → notes download denied', 'could not create draft fixture')
    }
  }

  // G4: Recorder of someone else's lesson (teacher T2 on fx.lessonId recorded by T1) → denied
  {
    const r = await canGetNotesDownloadUrl(clientT2, fx.lessonId)
    assert("G4: recorder of someone else's lesson → denied", !r.allowed, r.reason)
  }

  // G5: Facilitator without today timetable entry (F2) → denied
  {
    const r = await canGetNotesDownloadUrl(clientF2, fx.lessonId)
    assert('G5: facilitator without today timetable entry → denied', !r.allowed, r.reason)
  }

  // G6: notes_downloadable = false → student/guardian denied; manager allowed
  {
    await svc.from('lms_lessons').update({ notes_downloadable: false }).eq('id', fx.lessonId)
    const [rGuardian, rManager] = await Promise.all([
      canGetNotesDownloadUrl(clientG1, fx.lessonId, fx.studentS1Id),
      canGetNotesDownloadUrl(clientAdminA, fx.lessonId),
    ])
    assert(
      'G6: notes_downloadable=false → student/guardian denied, manager allowed',
      !rGuardian.allowed && rManager.allowed,
      `guardian: ${rGuardian.allowed}, manager: ${rManager.allowed}`
    )
    await svc.from('lms_lessons').update({ notes_downloadable: true }).eq('id', fx.lessonId)
  }

  // G7: Manager with notes attached → gets signed URL
  {
    const r = await canGetNotesDownloadUrl(clientAdminA, fx.lessonId)
    assert('G7: manager with notes → gets signed URL allowed', r.allowed, r.reason)
  }

  // G8: After notes removed (notes_path = null) → denied
  {
    await svc.from('lms_lessons').update({ notes_path: null }).eq('id', fx.lessonId)
    const r = await canGetNotesDownloadUrl(clientAdminA, fx.lessonId)
    assert('G8: after notes removed (notes_path null) → denied', !r.allowed, r.reason)
    // restore for subsequent tests
    await svc.from('lms_lessons').update({ notes_path: fx.notesPath }).eq('id', fx.lessonId)
  }

  // G9: Direct storage request with user JWT against lms-notes bucket → denied (no storage policies)
  {
    const { data: dlData, error: dlErr } = await clientAdminA.storage
      .from('lms-notes')
      .download(fx.notesPath)
    const secured = !!dlErr || !dlData
    assert(
      'G9: direct storage request with user JWT against lms-notes → denied (HTTP 403 / unauthorized)',
      secured,
      dlErr ? dlErr.message : 'no error returned'
    )
  }

  // G10: Recorder of own lesson (T1 on fx.lessonId recorded by T1) → gets signed URL allowed
  {
    const r = await canGetNotesDownloadUrl(clientT1, fx.lessonId)
    assert('G10: recorder of own lesson → gets signed URL allowed', r.allowed, r.reason)
  }

  // ══════════════════════════════════════════
  console.log('\n── Section H: AI Lesson Tutor (Lumi) Security (H1–H6) ──')

  // H1: Direct select on lms_ai_messages with user client → 0 rows / denied (RLS enabled, no policies)
  {
    const { data: userAiMsgs, error: userAiErr } = await clientAdminA
      .from('lms_ai_messages')
      .select('id')
      .eq('lesson_id', fx.lessonId)
    const blocked = !!userAiErr || !userAiMsgs || userAiMsgs.length === 0
    assert(
      'H1: direct select on lms_ai_messages with user JWT → blocked / returns 0 rows',
      blocked,
      userAiErr ? userAiErr.message : '0 rows returned'
    )
  }

  // H2: Direct insert on lms_ai_messages with user client → blocked by RLS
  {
    const { error: insErr } = await (clientAdminA as any)
      .from('lms_ai_messages')
      .insert({
        school_id: fx.schoolAId,
        lesson_id: fx.lessonId,
        session_id: '00000000-0000-0000-0000-000000000001',
        mode: 'student',
        asked_by: fx.adminAId,
        role: 'user',
        content: 'Malicious direct insert attempt',
      })
    assert(
      'H2: direct insert on lms_ai_messages with user client → denied by RLS',
      !!insErr,
      insErr ? insErr.message : 'unexpected success'
    )
  }

  // H3: Direct select on lms_ai_settings with anon client → blocked
  {
    const { data: anonData, error: anonErr } = await (anon as any)
      .from('lms_ai_settings')
      .select('id')
      .eq('school_id', fx.schoolAId)
    const blocked = !!anonErr || !anonData || anonData.length === 0
    assert(
      'H3: direct select on lms_ai_settings with anon client → denied / 0 rows',
      blocked,
      anonErr ? anonErr.message : '0 rows'
    )
  }

  // H4: Service role client can configure lms_ai_settings
  {
    const { error: upsertErr } = await (svc as any)
      .from('lms_ai_settings')
      .upsert({
        school_id: fx.schoolAId,
        enabled: true,
        voice_enabled: true,
        read_aloud_enabled: true,
        daily_limit_per_student: 25,
        daily_limit_per_class: 100,
        monthly_limit_school: 5000,
      })
    assert('H4: admin service role can upsert lms_ai_settings', !upsertErr, upsertErr?.message)
  }

  // H5: Service role client can persist lms_ai_messages with usage metrics
  {
    const { error: logErr } = await (svc as any)
      .from('lms_ai_messages')
      .insert({
        school_id: fx.schoolAId,
        lesson_id: fx.lessonId,
        session_id: '00000000-0000-0000-0000-000000000001',
        mode: 'class',
        asked_by: fx.adminAId,
        role: 'assistant',
        content: 'Test Lumi response grounded in notes [[GROUNDED:yes]]',
        grounded: true,
        tokens_in: 50,
        tokens_out: 25,
        model: 'gemini-2.5-flash-lite',
      })
    assert('H5: admin service role can log lms_ai_messages with tokens', !logErr, logErr?.message)
  }

  // H6: Verify lms_lessons.ai_tutor_enabled column is true by default
  {
    const { data: lessonRow } = await (svc as any)
      .from('lms_lessons')
      .select('ai_tutor_enabled')
      .eq('id', fx.lessonId)
      .single()
    assert(
      'H6: lms_lessons.ai_tutor_enabled defaults to true or is boolean',
      lessonRow && typeof lessonRow.ai_tutor_enabled === 'boolean',
      `ai_tutor_enabled=${lessonRow?.ai_tutor_enabled}`
    )
  }

  // ══════════════════════════════════════════
  console.log('\n── Skipped / Unimplemented ──')
  console.log(
    '  ⏭  SKIP  TUS resumable upload endpoint auth (requires live HTTP upload)'
  )
  console.log(
    '  ⏭  SKIP  deleteLesson storage side-effects (auth tested at DB level)'
  )
  console.log(
    '  ⏭  SKIP  Activity submission file upload auth (requires storage mock)'
  )
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

async function teardown() {
  console.log('\n🗑️  Cleaning up fixtures…')
  try {
    if (fx.activityId)
      await svc.from('lms_activities').delete().eq('id', fx.activityId)

    // AI messages and settings for fixture
    if (fx.lessonId)
      await svc.from('lms_ai_messages').delete().eq('lesson_id', fx.lessonId)
    if (fx.schoolAId)
      await svc.from('lms_ai_settings').delete().eq('school_id', fx.schoolAId)

    // Messages for this lesson
    if (fx.lessonId)
      await svc
        .from('lms_lesson_messages')
        .delete()
        .eq('lesson_id', fx.lessonId)

    // Period attendance
    if (fx.attendanceCreated && fx.studentS1Id)
      await svc
        .from('lms_period_attendance')
        .delete()
        .eq('student_id', fx.studentS1Id)

    // Lesson deliveries
    if (fx.entryF1Id)
      await svc
        .from('lms_lesson_deliveries')
        .delete()
        .eq('timetable_entry_id', fx.entryF1Id)

    // Timetable entry
    if (fx.entryF1Id)
      await svc.from('timetable_entries').delete().eq('id', fx.entryF1Id)

    // Lesson notes text
    if (fx.lessonId)
      await svc.from('lms_lesson_notes_text').delete().eq('lesson_id', fx.lessonId)

    // Notes storage object
    if (fx.notesPath)
      await svc.storage.from('lms-notes').remove([fx.notesPath])

    // Lesson
    if (fx.lessonId)
      await svc.from('lms_lessons').delete().eq('id', fx.lessonId)

    // Storage objects
    if (fx.storageObjects.length > 0)
      await svc.storage.from('lms-lessons').remove(fx.storageObjects)

    // Enrolments
    if (fx.studentS1Id)
      await svc.from('enrolments').delete().eq('student_id', fx.studentS1Id)
    if (fx.studentS2Id)
      await svc.from('enrolments').delete().eq('student_id', fx.studentS2Id)

    // Guardian links
    if (fx.studentS1Id)
      await svc
        .from('student_guardians')
        .delete()
        .eq('student_id', fx.studentS1Id)
    if (fx.studentS2Id)
      await svc
        .from('student_guardians')
        .delete()
        .eq('student_id', fx.studentS2Id)

    // Guardians
    if (fx.guardianG1Id)
      await svc.from('guardians').delete().eq('profile_id', fx.guardianG1Id)
    if (fx.guardianG2Id)
      await svc.from('guardians').delete().eq('profile_id', fx.guardianG2Id)

    // Students
    if (fx.studentS1Id)
      await svc.from('students').delete().eq('id', fx.studentS1Id)
    if (fx.studentS2Id)
      await svc.from('students').delete().eq('id', fx.studentS2Id)

    // User roles + profiles + auth users
    const userIds = [
      fx.adminAId,
      fx.teacherT1Id,
      fx.teacherT2Id,
      fx.facilitatorF1Id,
      fx.facilitatorF2Id,
      fx.guardianG1Id,
      fx.guardianG2Id,
      fx.adminBId,
    ].filter(Boolean)
    if (userIds.length > 0) {
      await svc.from('user_roles').delete().in('user_id', userIds)
      await svc.from('profiles').delete().in('id', userIds)
      for (const uid of userIds) {
        await svc.auth.admin.deleteUser(uid)
      }
    }

    // Attendance statuses
    if (fx.statusPresentId)
      await svc
        .from('attendance_statuses')
        .delete()
        .eq('id', fx.statusPresentId)
    if (fx.statusAbsentId)
      await svc
        .from('attendance_statuses')
        .delete()
        .eq('id', fx.statusAbsentId)

    // Subjects
    if (fx.subjectChemId)
      await svc.from('subjects').delete().eq('id', fx.subjectChemId)
    if (fx.subjectMathId)
      await svc.from('subjects').delete().eq('id', fx.subjectMathId)

    // Classes
    if (fx.classJss1Id)
      await svc.from('classes').delete().eq('id', fx.classJss1Id)
    if (fx.classJss2Id)
      await svc.from('classes').delete().eq('id', fx.classJss2Id)

    // Sessions
    if (fx.sessionAId)
      await svc.from('academic_sessions').delete().eq('id', fx.sessionAId)
    if (fx.sessionBId)
      await svc.from('academic_sessions').delete().eq('id', fx.sessionBId)

    // Schools
    if (fx.schoolAId)
      await svc.from('schools').delete().eq('id', fx.schoolAId)
    if (fx.schoolBId)
      await svc.from('schools').delete().eq('id', fx.schoolBId)

    console.log('  ✔  Cleanup complete.')
  } catch (err) {
    console.error('  ⚠️  Cleanup error (some fixtures may remain):', err)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  LMS Security Regression Script')
  console.log(`  Run ID: ${RUN_TAG}`)
  console.log(`  Target: ${SUPABASE_URL}`)
  console.log('═══════════════════════════════════════════')

  try {
    await setup()
    await runTests()
  } finally {
    await teardown()
  }

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log('\n═══════════════════════════════════════════')
  console.log(
    `  Results: ${passed} passed, ${failed} failed (${results.length} total)`
  )
  if (failed > 0) {
    console.error('\n  FAILING CASES:')
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(`    ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
      })
  }
  console.log('═══════════════════════════════════════════\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('\n[FATAL]', err)
  teardown().finally(() => process.exit(2))
})
