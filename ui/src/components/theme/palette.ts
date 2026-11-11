import { useSyncExternalStore } from 'react'

/** Selectable colour palettes; light/dark is chosen separately (next-themes). */
export const PALETTES = [
  { value: 'thuy', label: 'Thủy', hint: 'Xanh đại dương', swatch: '#1857d1' },
  { value: 'moc', label: 'Mộc', hint: 'Xanh rừng', swatch: '#24483d' },
  { value: 'kim', label: 'Kim', hint: 'Bạc than chì', swatch: '#475569' },
  { value: 'hoa', label: 'Hỏa', hint: 'Đỏ san hô', swatch: '#d1432b' },
  { value: 'tho', label: 'Thổ', hint: 'Hổ phách', swatch: '#c27407' },
  { value: 'tim', label: 'Tím', hint: 'Oải hương', swatch: '#6a43e8' },
] as const

export type Palette = (typeof PALETTES)[number]['value']

export const DEFAULT_PALETTE: Palette = 'thuy'
export const PALETTE_STORAGE_KEY = 'agentra-palette'

export function isPalette(value: unknown): value is Palette {
  return PALETTES.some((palette) => palette.value === value)
}

/** Stored palette, or the default when storage is empty, invalid or blocked. */
export function readStoredPalette(): Palette {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY)
    return isPalette(stored) ? stored : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}

const listeners = new Set<() => void>()
let current: Palette | null = null

function snapshot(): Palette {
  current ??= readStoredPalette()
  return current
}

/** Applies a palette to <html data-palette> and remembers it in this browser. */
export function setPalette(value: Palette): void {
  if (!isPalette(value)) return
  current = value
  document.documentElement.dataset.palette = value
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, value)
  } catch {
    // Storage blocked: the palette still applies for this page view.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePalette(): [Palette, (value: Palette) => void] {
  const palette = useSyncExternalStore(
    subscribe,
    snapshot,
    () => DEFAULT_PALETTE,
  )
  return [palette, setPalette]
}

/** Test hook: forget the cached palette so the next read hits storage. */
export function resetPaletteCache(): void {
  current = null
}
