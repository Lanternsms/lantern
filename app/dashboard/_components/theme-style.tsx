import { createClient } from '@/lib/supabase/server'
import { darken } from '@/lib/theme/color-utils'

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
  const primary = theme.primary || '#182350'
  const sidebar = theme.sidebar || '#131c40'
  const accent = theme.accent || '#b9915e'

  const css = `:root {
    --color-primary: ${primary};
    --color-primary-hover: ${darken(primary, 0.15)};
    --color-sidebar: ${sidebar};
    --color-sidebar-active: ${darken(sidebar, 0.15)};
    --color-accent: ${accent};
    --color-accent-hover: ${darken(accent, 0.15)};
    --color-text-on-primary: ${theme.text_on_primary || '#ffffff'};
    --color-text-on-sidebar: ${theme.text_on_sidebar || '#ffffff'};
    --color-text-on-accent: ${theme.text_on_accent || '#182350'};
  }`

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}