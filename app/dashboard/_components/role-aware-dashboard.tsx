import { createClient } from '@/lib/supabase/server'
import { getMyAccessContext, canSee } from '@/lib/permissions'
import { DASHBOARD_WIDGETS } from './dashboard-widgets'
import { TeacherWidget } from './widgets/teacher-widget'

export async function RoleAwareDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, school_id')
    .eq('id', user.id)
    .single()

  const ctx = await getMyAccessContext(supabase)
  // Teachers get their day first; their form-class and approval queue fold into it.
  const teacherFirst = ctx.isTeacher
  const visibleWidgets = DASHBOARD_WIDGETS
    .filter((w) => canSee(ctx, w.gate))
    .filter((w) => !teacherFirst || !['teacher', 'formTeacher', 'approvals'].includes(w.key))

  // Fetch school details and active session/term for context banner
  const [sessionRes, termRes] = profile?.school_id
    ? await Promise.all([
        supabase
          .from('academic_sessions')
          .select('name')
          .eq('school_id', profile.school_id)
          .eq('is_current', true)
          .maybeSingle(),
        supabase
          .from('terms')
          .select('name')
          .eq('school_id', profile.school_id)
          .eq('is_current', true)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }]

  const activeSessionName = sessionRes.data?.name ?? null
  const activeTermName = termRes.data?.name ?? null

  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }).format(new Date()))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Format today's date in Lagos / local timezone
  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="flex flex-col gap-6 px-5 pb-10 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-semibold leading-[1.05] sm:text-[40px]">
            {greeting}{profile?.first_name ? `, ${profile.first_name}` : ''}
          </h1>
          <p className="text-[15px] text-text-secondary">
            {[todayFormatted, activeTermName, activeSessionName].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {teacherFirst && <TeacherWidget isFormTeacher={ctx.isFormTeacher} isApprover={ctx.isApprover} />}

      {/* ─── Other panels this person's role allows ─────────────────────── */}
      {visibleWidgets.length === 0 ? (teacherFirst ? null : (
        <div className="card p-8">
          <h2 className="text-base font-semibold text-text-primary">Nothing to show here yet</h2>
          <p className="mt-1 max-w-md text-sm text-text-secondary">
            Your role doesn’t include any of the home screen panels yet. Use the menu to reach your pages, or ask your school admin to adjust your role.
          </p>
        </div>
      )) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(
            await Promise.all(
              visibleWidgets.map(async (w) => {
                const content = await w.Component()
                if (!content) return null
                return (
                  <div key={w.key} className={w.span === 2 ? 'md:col-span-2' : ''}>
                    {content}
                  </div>
                )
              })
            )
          )}
        </div>
      )}
    </div>
  )
}