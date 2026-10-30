import { createClient } from '@/lib/supabase/server'
import { getMyAccessContext, canSee } from '@/lib/permissions'
import { DASHBOARD_WIDGETS } from './dashboard-widgets'

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
  const visibleWidgets = DASHBOARD_WIDGETS.filter((w) => canSee(ctx, w.gate))

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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Format today's date in Lagos / local timezone
  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  // Compile active role badges
  const roleBadges: string[] = []
  if (ctx.isTeacher) roleBadges.push('Teacher')
  if (ctx.isFormTeacher) roleBadges.push('Form teacher')
  if (ctx.isApprover) roleBadges.push('Approver')
  if (roleBadges.length === 0) roleBadges.push('Staff')

  return (
    <div className="flex flex-col gap-6 px-5 pb-10 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] sm:text-[32px]">
            {greeting}{profile?.first_name ? `, ${profile.first_name}` : ''}
          </h1>
          <p className="text-[15px] text-text-secondary">
            {[todayFormatted, activeTermName, activeSessionName].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {roleBadges.map((badge) => (
            <span key={badge} className="rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-[#374151]">{badge}</span>
          ))}
        </div>
      </div>

      {/* ─── Dynamic Widgets Grid ───────────────────────────────────────── */}
      {visibleWidgets.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8">
          <h2 className="text-base font-semibold text-text-primary">Nothing to show here yet</h2>
          <p className="mt-1 max-w-md text-sm text-text-secondary">
            Your role doesn’t include any of the home screen panels yet. Use the menu to reach your pages, or ask your school admin to adjust your role.
          </p>
        </div>
      ) : (
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