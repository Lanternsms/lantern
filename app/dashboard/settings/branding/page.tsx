export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BrandingEditor } from './branding-editor'

const FALLBACK_THEME = {
  primary: '#182350',
  sidebar: '#131c40',
  accent: '#b9915e',
  text_on_primary: '#ffffff',
  text_on_sidebar: '#ffffff',
  text_on_accent: '#182350',
}

export default async function BrandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/dashboard')

  const [{ data: school }, { data: defaultRow }] = await Promise.all([
    supabase.from('schools').select('name, logo_url, theme').eq('id', profile.school_id).single(),
    supabase.from('platform_theme_defaults').select('theme').eq('id', 1).single(),
  ])

  return (
    <div className="px-6 py-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Branding & Theme</h1>
        <p className="text-sm text-text-secondary mt-1">
          Set your school's logo and colors. Changes apply across the whole portal for everyone at your school.
        </p>
      </div>
      <BrandingEditor
        schoolName={school?.name ?? 'Your School'}
        initialLogoUrl={school?.logo_url ?? null}
        initialTheme={(school?.theme as any) ?? {}}
        defaultTheme={{ ...FALLBACK_THEME, ...((defaultRow?.theme as any) ?? {}) }}
      />
    </div>
  )
}