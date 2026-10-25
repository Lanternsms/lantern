import { createClient } from '@/lib/supabase/server'
import { getMyAccessContext, canSee } from '@/lib/permissions'
import { DASHBOARD_WIDGETS } from './dashboard-widgets'
import { Calendar, Sparkles } from 'lucide-react'

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
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  // Compile active role badges
  const roleBadges: string[] = []
  if (ctx.isTeacher) roleBadges.push('Teacher')
  if (ctx.isFormTeacher) roleBadges.push('Form Teacher')
  if (ctx.isApprover) roleBadges.push('Approver')
  if (roleBadges.length === 0) roleBadges.push('Staff Member')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ─── Hero Welcome Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[#1c2a5e] to-sidebar text-white p-6 sm:p-8 shadow-sm">
        {/* Ambient background glows */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-primary-hover/40 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/15 text-white/90">
                <Calendar size={13} className="text-accent" />
                {todayFormatted}
              </span>
              {(activeSessionName || activeTermName) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 backdrop-blur-md border border-white/15 text-white/80">
                  <Sparkles size={12} className="text-accent" />
                  {[activeSessionName, activeTermName].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {greeting}
              {profile?.first_name ? `, ${profile.first_name}` : ''}
            </h1>
            <p className="text-sm text-white/75 max-w-xl">
              Here is your daily activity overview, class schedules, and operational shortcuts.
            </p>
          </div>

          {/* Role pills */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            {roleBadges.map((badge) => (
              <span
                key={badge}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-xs"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Dynamic Widgets Grid ───────────────────────────────────────── */}
      {visibleWidgets.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-surface-muted text-text-muted flex items-center justify-center mx-auto">
            <Sparkles size={24} />
          </div>
          <h2 className="text-base font-semibold text-text-primary">Dashboard in setup mode</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Your account doesn&apos;t have any active dashboard widgets configured yet. Use the navigation sidebar to access your features, or contact your school administrator.
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