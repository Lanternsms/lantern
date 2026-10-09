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