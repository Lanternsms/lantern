'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { contrastRatio, darken, isValidHex, suggestTextColor } from '@/lib/theme/color-utils'
import { saveBranding, removeLogo } from './actions'

type Theme = {
  primary?: string
  sidebar?: string
  accent?: string
  text_on_primary?: string
  text_on_sidebar?: string
  text_on_accent?: string
}

function ColorField({
  label, value, onChange, suggestedText, textValue, onTextChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suggestedText: { color: string; ratio: number }
  textValue: string
  onTextChange: (v: string) => void
}) {
  const [hexInput, setHexInput] = useState(value)

  function commitHex(v: string) {
    setHexInput(v)
    if (isValidHex(v)) onChange(v)
  }

  const usingSuggestion = textValue.toLowerCase() === suggestedText.color.toLowerCase()
  const currentRatio = contrastRatio(value, textValue)
  const passesAA = currentRatio >= 4.5

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => { onChange(e.target.value); setHexInput(e.target.value) }}
            className="w-9 h-9 rounded-lg border border-border cursor-pointer"
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => commitHex(e.target.value)}
            className="w-24 rounded-lg border border-border px-2 py-1.5 text-xs font-mono bg-surface text-text-primary"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">Text on this color</span>
        <div className="flex items-center gap-1.5 bg-surface-muted p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => onTextChange('#FFFFFF')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${textValue.toUpperCase() === '#FFFFFF' ? 'bg-surface shadow-xs text-text-primary' : 'text-text-secondary'
              }`}
          >
            White
          </button>
          <button
            type="button"
            onClick={() => onTextChange('#000000')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${textValue.toUpperCase() === '#000000' ? 'bg-surface shadow-xs text-text-primary' : 'text-text-secondary'
              }`}
          >
            Black
          </button>
        </div>
      </div>

      <p className={`text-[11px] ${passesAA ? 'text-emerald-600' : 'text-amber-600'}`}>
        {usingSuggestion ? 'Using suggested' : 'Overriding suggestion'} — contrast {currentRatio.toFixed(1)}:1
        {passesAA ? ' (passes WCAG AA)' : ' (low contrast — hard to read)'}
      </p>
    </div>
  )
}

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
  const [sidebar, setSidebar] = useState(initialTheme.sidebar || defaultTheme.sidebar)
  const [accent, setAccent] = useState(initialTheme.accent || defaultTheme.accent)
  const [textOnPrimary, setTextOnPrimary] = useState(initialTheme.text_on_primary || defaultTheme.text_on_primary)
  const [textOnSidebar, setTextOnSidebar] = useState(initialTheme.text_on_sidebar || defaultTheme.text_on_sidebar)
  const [textOnAccent, setTextOnAccent] = useState(initialTheme.text_on_accent || defaultTheme.text_on_accent)

  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()
  const [isRemovingLogo, startRemoveLogoTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const suggestedOnPrimary = useMemo(() => suggestTextColor(primary), [primary])
  const suggestedOnSidebar = useMemo(() => suggestTextColor(sidebar), [sidebar])
  const suggestedOnAccent = useMemo(() => suggestTextColor(accent), [accent])

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
    setPrimary(defaultTheme.primary)
    setSidebar(defaultTheme.sidebar)
    setAccent(defaultTheme.accent)
    setTextOnPrimary(defaultTheme.text_on_primary)
    setTextOnSidebar(defaultTheme.text_on_sidebar)
    setTextOnAccent(defaultTheme.text_on_accent)
    setMessage({ type: 'success', text: "Colors reset to Lantern's default — click Save Branding to apply." })
  }

  function handleSave() {
    setMessage(null)
    const formData = new FormData()
    formData.set('primary', primary)
    formData.set('sidebar', sidebar)
    formData.set('accent', accent)
    formData.set('text_on_primary', textOnPrimary)
    formData.set('text_on_sidebar', textOnSidebar)
    formData.set('text_on_accent', textOnAccent)
    if (logoFile) formData.set('logo', logoFile)

    startTransition(async () => {
      const result = await saveBranding(formData)
      if (result?.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Branding saved. Changes are now live for everyone at your school.' })
        setLogoFile(null)
      }
    })
  }

  const primaryHover = darken(primary, 0.15)
  const sidebarActive = darken(sidebar, 0.15)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* CONTROLS */}
      <div className="space-y-4">
        <div className="border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Logo</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-border bg-surface-muted flex items-center justify-center overflow-hidden">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="School logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-text-secondary">No logo</span>
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRemovingLogo}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
              >
                Upload new logo
              </button>
              {logoPreview && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isRemovingLogo || isPending}
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  {isRemovingLogo ? 'Removing…' : 'Remove logo'}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>
          <p className="text-[11px] text-text-secondary">PNG, JPG, SVG or WebP. Under 2MB.</p>
        </div>

        <ColorField label="Primary" value={primary} onChange={setPrimary} suggestedText={suggestedOnPrimary} textValue={textOnPrimary} onTextChange={setTextOnPrimary} />
        <ColorField label="Sidebar" value={sidebar} onChange={setSidebar} suggestedText={suggestedOnSidebar} textValue={textOnSidebar} onTextChange={setTextOnSidebar} />
        <ColorField label="Accent" value={accent} onChange={setAccent} suggestedText={suggestedOnAccent} textValue={textOnAccent} onTextChange={setTextOnAccent} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-60 px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleReset}
            className="inline-flex items-center text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-text-secondary disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
          {message && (
            <p className={`text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>
          )}
        </div>
      </div>

      {/* LIVE PREVIEW */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Live Preview</h3>
        <div className="border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="flex h-72">
            <div className="w-40 shrink-0 p-3 space-y-2" style={{ backgroundColor: sidebar }}>
              <div className="flex flex-col items-center justify-center gap-1 mb-4">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="h-6 max-w-[120px] w-auto object-contain" />
                ) : (
                  <span className="text-xs font-semibold" style={{ color: textOnSidebar }}>Lantern</span>
                )}
                <span
                  className="text-[10px] font-medium text-center truncate max-w-[110px]"
                  style={{ color: textOnSidebar, opacity: 0.8 }}
                >
                  {schoolName}
                </span>
              </div>
              {['Dashboard', 'Students', 'Attendance', 'Fees'].map((item, i) => (
                <div
                  key={item}
                  className="text-xs px-2.5 py-1.5 rounded-md"
                  style={{ backgroundColor: i === 0 ? sidebarActive : 'transparent', color: textOnSidebar, opacity: i === 0 ? 1 : 0.75 }}
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-9 bg-surface border-b border-border flex items-center gap-2 px-4 shrink-0">
                {logoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="" className="h-5 w-5 rounded object-contain shrink-0" />
                )}
                <span className="text-xs font-medium text-text-primary truncate">{schoolName}</span>
              </div>
              <div className="flex-1 bg-surface-muted/30 p-4 space-y-3 overflow-hidden">
                <div className="bg-surface border border-border rounded-lg p-3 shadow-xs">
                  <p className="text-xs text-text-secondary mb-2">Sample card</p>
                  <div className="flex items-center gap-2">
                    <button className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ backgroundColor: primary, color: textOnPrimary }}>
                      Primary Button
                    </button>
                    <button className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ backgroundColor: primaryHover, color: textOnPrimary }}>
                      Hover state
                    </button>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: accent, color: textOnAccent }}>
                      Accent badge
                    </span>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-lg p-3 shadow-xs">
                  <p className="text-xs text-text-secondary">Body text stays neutral — only brand elements change.</p>
                  <p className="text-sm font-medium mt-1" style={{ color: primary }}>A link or heading in your primary color</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-text-secondary">
          Updates instantly as you pick colors. Nothing applies for other users until you save.
        </p>
      </div>
    </div>
  )
}