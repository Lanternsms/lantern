'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { contrastRatio, deriveSchoolLadder, isValidHex } from '@/lib/theme/color-utils'
import { saveBranding, removeLogo } from './actions'

type Theme = {
  primary?: string
  sidebar?: string
  accent?: string
  text_on_primary?: string
  text_on_sidebar?: string
  text_on_accent?: string
}

const SWATCHES = [
  ['Lantern navy', '#182350'], ['Royal blue', '#1D4ED8'], ['Emerald', '#0E7C66'], ['Raspberry', '#B8336A'], ['Amber', '#B45309'],
  ['Maroon', '#7F1D1D'], ['Navy', '#1E3A5F'], ['Forest', '#166534'], ['Gold', '#E0B100'],
] as const

export function BrandingEditor({
  schoolName,
  initialLogoUrl,
  initialTheme,
  defaultTheme,
}: {
  schoolName: string
  initialLogoUrl: string | null
  initialTheme: Theme
  defaultTheme: Required<Theme>
}) {
  const [primary, setPrimary] = useState(initialTheme.primary || defaultTheme.primary)
  const [hexInput, setHexInput] = useState(initialTheme.primary || defaultTheme.primary)

  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()
  const [isRemovingLogo, startRemoveLogoTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const ladder = useMemo(() => deriveSchoolLadder(primary), [primary])
  const readable = contrastRatio(primary, '#FFFFFF') >= 4.5

  function pick(hex: string) {
    setPrimary(hex)
    setHexInput(hex)
    setMessage(null)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleRemoveLogo() {
    // An unsaved selection in the file picker — just discard it locally,
    // no need to touch the server or the already-saved logo (if any).
    if (logoFile) {
      setLogoFile(null)
      setLogoPreview(initialLogoUrl)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (!initialLogoUrl) return
    const confirmed = window.confirm(
      'Remove your school\'s logo? The sidebar will show the "Lantern" text instead until you upload a new one.'
    )
    if (!confirmed) return

    setMessage(null)
    startRemoveLogoTransition(async () => {
      const result = await removeLogo()
      if (result?.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setLogoPreview(null)
        setMessage({ type: 'success', text: 'Logo removed — showing the default "Lantern" text until you upload a new one.' })
      }
    })
  }

  function handleReset() {
    pick(defaultTheme.primary)
    setMessage({ type: 'success', text: 'Back to the default colour. Save to apply it.' })
  }

  function handleSave() {
    setMessage(null)
    // Lantern builds every shade from the one colour. The other theme keys are still
    // written so older readers of schools.theme keep working.
    const formData = new FormData()
    formData.set('primary', primary)
    formData.set('sidebar', initialTheme.sidebar || ladder.deep)
    formData.set('accent', initialTheme.accent || primary)
    formData.set('text_on_primary', '#ffffff')
    formData.set('text_on_sidebar', '#111827')
    formData.set('text_on_accent', '#ffffff')
    if (logoFile) formData.set('logo', logoFile)

    startTransition(async () => {
      const result = await saveBranding(formData)
      if (result?.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Saved. Everyone at your school sees the new colour and crest on their next page.' })
        setLogoFile(null)
      }
    })
  }

  const crest = logoPreview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoPreview} alt="" className="h-full w-full object-contain" />
  ) : (
    <svg aria-hidden viewBox="0 0 30 34" className="h-[70%]">
      <path d="M15 1 28 5v11c0 8-5.5 13.5-13 17C7.5 29.5 2 24 2 16V5z" fill={primary} />
      <path d="M15 8v15M9 13h12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="card flex flex-col gap-6 p-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold">School colour</legend>
          <div role="radiogroup" aria-label="School colour" className="flex flex-wrap gap-2.5">
            {SWATCHES.map(([name, hex]) => {
              const on = primary.toUpperCase() === hex
              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={name}
                  title={name}
                  onClick={() => pick(hex)}
                  className="h-10 w-10 rounded-full"
                  style={{ backgroundColor: hex, boxShadow: on ? `0 0 0 3px #fff, 0 0 0 5px ${hex}` : undefined }}
                />
              )
            })}
          </div>
          <label className="flex flex-wrap items-center gap-3 text-sm text-[#374151]">
            Or a hex code
            <input
              value={hexInput}
              onChange={(e) => { setHexInput(e.target.value); if (isValidHex(e.target.value)) pick(e.target.value) }}
              aria-invalid={!isValidHex(hexInput)}
              className="h-9 w-28 rounded-md border border-control px-2.5 text-sm tabular-nums focus:border-primary focus:outline-none"
            />
            <input type="color" value={primary} onChange={(e) => pick(e.target.value)} aria-label="Pick any colour" className="h-9 w-11 cursor-pointer rounded-md border border-control bg-surface p-1" />
          </label>
          <p className={`text-sm ${readable ? 'text-success-text' : 'text-warning-text'}`}>
            {readable
              ? 'Readable: white text on this colour passes the contrast check.'
              : 'Too light for white text, so buttons will use a darker shade of it automatically.'}
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 font-semibold">Crest</legend>
          <div className="flex items-center gap-4">
            <span className="card flex h-[72px] w-[72px] items-center justify-center overflow-hidden p-2">{crest}</span>
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isRemovingLogo} className="h-9 rounded-md border border-control bg-surface px-3.5 text-sm font-medium hover:bg-raised disabled:opacity-60">
                  {logoPreview ? 'Replace crest' : 'Upload crest'}
                </button>
                {logoPreview && (
                  <button type="button" onClick={handleRemoveLogo} disabled={isRemovingLogo || isPending} className="h-9 rounded-md px-3 text-sm font-medium text-danger-text hover:bg-danger-bg disabled:opacity-60">
                    {isRemovingLogo ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
              <span className="text-[13px] text-text-secondary">PNG, JPG, SVG or WebP, square, under 2 MB.</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoChange} />
          </div>
        </fieldset>

        {message && (
          <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2.5 text-sm ${message.type === 'success' ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'}`}>
            {message.text}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-rule pt-4">
          <button type="button" disabled={isPending} onClick={handleReset} className="h-10 rounded-md border border-control bg-surface px-4 text-sm font-medium hover:bg-raised disabled:opacity-60">
            Use default
          </button>
          <button type="button" disabled={isPending} onClick={handleSave} className="h-10 rounded-md px-5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: ladder.action }}>
            {isPending ? 'Saving…' : 'Save branding'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-sm text-text-secondary">Preview: what a guardian sees</span>
        <div className="flex flex-col gap-3.5 rounded-2xl border border-border p-5 transition-colors duration-200" style={{ backgroundColor: ladder.ground }}>
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden">{crest}</span>
            {schoolName}
          </span>
          <span className="text-[22px] font-semibold leading-tight">Chidera arrived at 7:48am today.</span>
          <div className="grid grid-cols-5 gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
              <span key={d} className="flex h-10 items-center justify-center rounded-lg text-xs font-medium" style={i === 2 ? { backgroundColor: '#fffbeb', color: '#92400e' } : i === 4 ? { border: '1px dashed #d1d5db', color: '#6b7280' } : { backgroundColor: ladder.soft, color: ladder.ink }}>
                {d}
              </span>
            ))}
          </div>
          <div className="card flex flex-col gap-2 p-3.5">
            <span className="text-sm text-text-secondary">Fees for Kelechi</span>
            <span className="text-[22px] font-semibold tabular-nums">₦35,000</span>
            <span className="block h-1.5 overflow-hidden rounded" style={{ backgroundColor: ladder.track }}>
              <span className="block h-full w-[83%]" style={{ backgroundColor: primary }} />
            </span>
            <span className="flex h-10 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: ladder.action }}>Pay ₦35,000</span>
          </div>
        </div>
        <p className="text-[13px] text-text-secondary">Nothing changes for anyone else until you save.</p>
      </div>
    </div>
  )
}
