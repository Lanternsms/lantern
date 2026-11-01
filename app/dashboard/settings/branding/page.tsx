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
    <div className="flex max-w-[1100px] flex-col gap-6 px-5 py-7 sm:px-8 sm:py-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Branding</h1>
        <p className="mt-1 text-[15px] text-text-secondary">
          Staff, students and guardians see your colour and crest everywhere in Lantern.
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