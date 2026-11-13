import { cn } from '@/lib/utils'

export const BRAND_LOGO = {
  /** Green wordmark for light surfaces. */
  light: '/assets/brand/agentra-dark.png',
  /** White wordmark for dark surfaces. */
  dark: '/assets/brand/agentra-white.png',
} as const

/**
 * The Agentra wordmark in the variant that reads on the current theme. Both
 * variants are in the markup and CSS (`.dark`) picks one, so the logo is right
 * on the first paint and switches with the theme without a re-render; the
 * hidden variant is `display: none` and therefore out of the accessibility tree.
 */
export function BrandLogo({ className }: { className?: string }) {
  const size = cn('w-auto shrink-0 object-contain', className)
  return (
    <>
      <img
        className={cn(size, 'dark:hidden')}
        src={BRAND_LOGO.light}
        alt="Agentra"
        data-variant="light"
      />
      <img
        className={cn(size, 'hidden dark:block')}
        src={BRAND_LOGO.dark}
        alt="Agentra"
        data-variant="dark"
      />
    </>
  )
}
