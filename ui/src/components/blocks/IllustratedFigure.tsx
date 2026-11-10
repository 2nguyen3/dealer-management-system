import { useState } from 'react'
import { cn } from '@/lib/utils'
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
 * colorfigures engine) in a sandboxed same-origin iframe. The figure keeps its
 * own global script scope, so it cannot clash with the application bundle.
 */
export function IllustratedFigure({
  name,
  title,
  className,
}: IllustratedFigureProps) {
  const [loaded, setLoaded] = useState(false)
  const src = `${import.meta.env.BASE_URL}figures/${name}`
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
        className={cn(
          'block size-full border-0 bg-transparent transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
