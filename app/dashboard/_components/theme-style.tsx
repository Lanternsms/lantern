import { createClient } from '@/lib/supabase/server'
import { deriveSchoolLadder } from '@/lib/theme/color-utils'

/**
 * Writes the school's colour ladder into CSS variables. A school picks one colour
 * (schools.theme.primary); everything else is derived so contrast holds for any choice.
 */
export async function ThemeStyle() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const { data: school } = await supabase
    .from('schools')
    .select('theme')
    .eq('id', profile.school_id)
    .single()

  const theme = (school?.theme ?? {}) as Record<string, string>
  const l = deriveSchoolLadder(theme.primary || '#1D4ED8')

  const css = `:root {
    --color-school: ${l.accent};
    --color-primary: ${l.action};
    --color-primary-hover: ${l.actionHover};
    --color-school-soft: ${l.soft};
    --color-school-track: ${l.track};
    --color-school-ink: ${l.ink};
    --color-ground: ${l.ground};
    --color-school-deep: ${l.deep};
    --color-school-deep-raised: ${l.deepRaised};
    --color-school-deep-muted: ${l.deepMuted};
  }`

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
