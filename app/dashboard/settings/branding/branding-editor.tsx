'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { contrastRatio, darken, isValidHex, suggestTextColor } from '@/lib/theme/color-utils'
import { saveBranding } from './actions'

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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-medium text-primary hover:underline"
            >
              Upload new logo
            </button>
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
          {/* Top bar — matches the real app: neutral surface, hamburger + school name only, no logo here */}
          <div className="h-11 bg-white border-b border-border flex items-center gap-3 px-4">
            <svg width="18" height="13" viewBox="0 0 22 16" fill="none">
              <path d="M0 1h22M0 8h22M0 15h22" stroke="#1f2430" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium" style={{ color: '#1f2430' }}>{schoolName}</span>
          </div>

          <div className="flex h-64">
            {/* Sidebar — matches the real app: logo (or "Lantern" fallback) in the header, plain nav links below */}
            <div className="w-40 shrink-0 flex flex-col" style={{ backgroundColor: sidebar }}>
              <div className="flex items-center px-3 py-3" style={{ borderBottom: `1px solid ${textOnSidebar}1A` }}>
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt={schoolName} className="h-5 max-w-[100px] object-contain" />
                ) : (
                  <span className="text-sm font-semibold" style={{ color: textOnSidebar }}>Lantern</span>
                )}
              </div>
              <div className="px-2 py-2 space-y-0.5">
                {['Dashboard', 'Students', 'Attendance', 'Fees'].map((item, i) => (
                  <div
                    key={item}
                    className="text-xs px-2.5 py-1.5 rounded-md"
                    style={{
                      backgroundColor: i === 1 ? sidebarActive : 'transparent',
                      color: textOnSidebar,
                      opacity: i === 1 ? 1 : 0.7,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-surface-muted/30 p-4 space-y-3">
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
        <p className="text-[11px] text-text-secondary">
          Matches the real layout: top bar shows your school name only; the logo and colors apply to the sidebar menu.
        </p>
      </div>
    </div>
  )
}