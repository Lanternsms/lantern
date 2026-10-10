import { createClient } from '@/lib/supabase/server'
import { getMyAccessContext, canSee } from '@/lib/permissions'
import { DASHBOARD_WIDGETS } from './dashboard-widgets'

export async function RoleAwareDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  const ctx = await getMyAccessContext(supabase)
  const visibleWidgets = DASHBOARD_WIDGETS.filter((w) => canSee(ctx, w.gate))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          {greeting}{profile?.first_name ? `, ${profile.first_name}` : ''}
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">Here&apos;s what&apos;s relevant to you today.</p>
      </div>

      {visibleWidgets.length === 0 ? (
        <div className="border border-border rounded-xl p-6 text-sm text-text-secondary">
          Your account doesn&apos;t have any dashboard widgets configured yet. Use the sidebar to get around, or ask your school admin about your access.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
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