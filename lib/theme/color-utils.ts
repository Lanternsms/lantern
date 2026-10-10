export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function srgbToLinear(c: number) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const [rl, gl, bl] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)]
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Picks whichever of pure white/black reads better against bgHex. */
export function suggestTextColor(bgHex: string): { color: string; ratio: number } {
  const whiteRatio = contrastRatio(bgHex, '#FFFFFF')
  const blackRatio = contrastRatio(bgHex, '#000000')
  return whiteRatio >= blackRatio
    ? { color: '#FFFFFF', ratio: whiteRatio }
    : { color: '#000000', ratio: blackRatio }
}

/** Blends a color toward black by `amount` (0-1) for hover/active shades. */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const d = (c: number) => Math.round(c * (1 - amount))
  return `#${[d(r), d(g), d(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export function isValidHex(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)
}

// --- Hue/Lightness helpers (for deriving a tinted neutral ramp from one brand color) ---

export function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex)
  const r = r0 / 255, g = g0 / 255, b = b0 / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export type NeutralRamp = {
  surface: string
  surfaceMuted: string
  border: string
  textPrimary: string
  textSecondary: string
  textMuted: string
}

/**
 * Derives a brand-tinted "neutral" ramp from a single hex color (schools.theme.primary).
 * Same hue as the brand color, saturation heavily damped (capped low), lightness fixed per
 * role — so surfaces always stay near-white and text always stays near-black regardless of
 * how light, dark, or saturated the school's chosen primary color is. This keeps every
 * school's dashboard legible by construction while still visibly carrying their brand hue
 * into page backgrounds, card borders, and body copy — not just buttons and the sidebar.
 */
export function deriveNeutralRamp(primaryHex: string): NeutralRamp {
  const [h, s] = hexToHsl(primaryHex)
  const sat = (fraction: number, cap: number) => Math.min(s * fraction, cap)
  return {
    surface: hslToHex(h, sat(0.2, 0.04), 0.995),
    surfaceMuted: hslToHex(h, sat(0.3, 0.08), 0.97),
    border: hslToHex(h, sat(0.3, 0.12), 0.89),
    textPrimary: hslToHex(h, sat(0.35, 0.18), 0.14),
    textSecondary: hslToHex(h, sat(0.3, 0.14), 0.40),
    textMuted: hslToHex(h, sat(0.25, 0.1), 0.60),
  }
}