import { PALETTES, type Palette } from './palette'

const HEX = /^#[0-9a-f]{6}$/i

/** Linear sRGB mix of two `#rrggbb` colours; `weight` is the share of `b`. */
export function mixHex(a: string, b: string, weight: number): string {
  if (!HEX.test(a) || !HEX.test(b)) throw new Error('mixHex expects #rrggbb')
  const t = Math.min(1, Math.max(0, weight))
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(channel(a, i) * (1 - t) + channel(b, i) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/**
 * Cast-shadow tone for the isometric figures: the palette's primary colour
 * muted toward a neutral slate (lighter slate on light pages, deeper on dark),
 * so the illustration's shadows belong to the active palette.
 */
export function figureShadow(palette: Palette, dark: boolean): string {
  const swatch =
    PALETTES.find((option) => option.value === palette)?.swatch ??
    PALETTES[0].swatch
  return mixHex(swatch, dark ? '#1d2230' : '#5a6070', 0.45)
}

/**
 * URL of a static figure under `public/figures/` with the theme tokens it
 * reads (`theme`, `shadow`). Changing theme or palette changes the URL, so the
 * sandboxed frame reloads with matching colours.
 */
export function figureSrc(
  name: string,
  palette: Palette,
  dark: boolean,
  base: string = import.meta.env.BASE_URL,
): string {
  const query = new URLSearchParams({
    theme: dark ? 'dark' : 'light',
    shadow: figureShadow(palette, dark),
  })
  return `${base}figures/${name}?${query.toString()}`
}
