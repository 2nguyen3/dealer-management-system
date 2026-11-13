import { useTheme } from 'next-themes'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { figureSrc } from '../theme/figureTheme'
import { usePalette } from '../theme/palette'
import { Skeleton } from '../shadcn/skeleton'

export interface IllustratedFigureProps {
  /** Static figure file under `public/figures/`, e.g. `forklift.html`. */
  name: string
  /** Accessible title describing the interactive illustration. */
  title: string
  className?: string
}

/**
 * Embeds a self-contained interactive isometric figure (built with the
 * colorfigures engine) in a sandboxed iframe. The figure keeps its own global
 * script scope, so it cannot clash with the application bundle. Theme tokens
 * travel in the query string (`theme`, palette-tinted `shadow`); the frame is
 * keyed by its URL so a theme or palette switch reloads it in matching colours.
 */
export function IllustratedFigure({
  name,
  title,
  className,
}: IllustratedFigureProps) {
  const { resolvedTheme } = useTheme()
  const [palette] = usePalette()
  const src = figureSrc(name, palette, resolvedTheme === 'dark')
  return <FigureFrame key={src} src={src} title={title} className={className} />
}

function FigureFrame({
  src,
  title,
  className,
}: {
  src: string
  title: string
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      {!loaded && (
        <Skeleton className="absolute inset-0 rounded-xl" aria-hidden="true" />
      )}
      <iframe
        src={src}
        title={title}
        loading="lazy"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        // The figure documents are light-scheme pages on a transparent canvas;
        // matching the frame's scheme keeps Chromium from painting an opaque
        // white backdrop behind them on dark pages.
        style={{ colorScheme: 'light' }}
        className={cn(
          'block size-full border-0 bg-transparent transition-opacity duration-500 dark:brightness-[.86] dark:saturate-[.9]',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
