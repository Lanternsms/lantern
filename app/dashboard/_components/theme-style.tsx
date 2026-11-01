import { createClient } from '@/lib/supabase/server'
import { contrastRatio, deriveSchoolLadder, isValidHex, mixHex } from '@/lib/theme/color-utils'

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
  // Values the old theme system saved as its defaults are not a school's choice;
  // they fall back to Lantern's brand blue from the logo.
  const OLD_DEFAULTS = new Set(['#182350', '#131c40', '#b9915e'])
  const chosen = (v?: string) => (v && isValidHex(v) && !OLD_DEFAULTS.has(v.toLowerCase()) ? v : undefined)
  const l = deriveSchoolLadder(chosen(theme.primary) || '#023879')
  // A school that chose its own sidebar colour keeps it; it is darkened only if white
  // text on it would fail 7:1, so the menu stays readable.
  const chosenSidebar = chosen(theme.sidebar) ?? null
  let deep = chosenSidebar ?? l.deep
  for (let w = 0.05; contrastRatio(deep, '#FFFFFF') < 7 && w <= 0.9; w += 0.05) {
    deep = mixHex(chosenSidebar ?? l.deep, '#000000', w)
  }
  const accent = chosen(theme.accent) ?? null

  const css = `:root {
    --color-school: ${l.accent};
    --color-primary: ${l.action};
    --color-primary-hover: ${l.actionHover};
    --color-school-soft: ${l.soft};
    --color-school-track: ${l.track};
    --color-school-ink: ${l.ink};
    --color-ground: ${l.ground};
    --color-school-deep: ${deep};
    --color-school-deep-raised: ${mixHex(deep, '#FFFFFF', 0.12)};
    --color-school-deep-muted: ${mixHex(deep, '#FFFFFF', 0.68)};${accent ? `\n    --color-accent: ${accent};` : ''}
  }`

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
