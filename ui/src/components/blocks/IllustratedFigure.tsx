import { useTheme } from 'next-themes'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { figureSrc, type FigureMotion } from '../theme/figureTheme'
import { usePalette } from '../theme/palette'
import { Skeleton } from '../shadcn/skeleton'

export interface IllustratedFigureProps {
  /** Static figure file under `public/figures/`, e.g. `forklift.html`. */
  name: string
  /** Accessible title describing the interactive illustration. */
  title: string
  className?: string
  /**
   * `hover` (default) shows a still frame and plays the loop only while the
   * pointer is over the figure (handled inside the figure document, which
   * receives those pointer events); `loop` plays continuously. The animated
   * scene is redrawn every frame, so a permanent loop costs about one core.
   */
  motion?: FigureMotion
  /** Forces the figure's light/dark tokens, e.g. on an always-dark panel. */
  tone?: 'light' | 'dark'
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
  motion = 'hover',
  tone,
}: IllustratedFigureProps) {
  const { resolvedTheme } = useTheme()
  const [palette] = usePalette()
  const dark = tone ? tone === 'dark' : resolvedTheme === 'dark'
  const src = figureSrc(name, palette, dark, undefined, motion)
  return (
    <FigureFrame
      key={src}
      src={src}
      title={title}
      className={className}
      forcedTone={tone}
      hoverPlay={motion === 'hover'}
    />
  )
}

function FigureFrame({
  src,
  title,
  className,
  forcedTone,
  hoverPlay,
}: {
  src: string
  title: string
  className?: string
  forcedTone?: 'light' | 'dark'
  hoverPlay: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  useHoverPause(frame, hoverPlay)
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      {!loaded && (
        <Skeleton className="absolute inset-0 rounded-xl" aria-hidden="true" />
      )}
      <iframe
        ref={frame}
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
          'block size-full border-0 bg-transparent transition-opacity duration-500',
          !forcedTone && 'dark:brightness-[.86] dark:saturate-[.9]',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}

/**
 * A hover-mode figure tells its host when it starts playing. The out-of-process
 * frame gets no event when the pointer leaves it, so the host's next pointer
 * boundary event on its own page posts `agentra:pause` (one listener, armed
 * only while the figure plays). The figure also stops after a few seconds
 * without pointer movement on its own.
 */
function useHoverPause(
  frame: RefObject<HTMLIFrameElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return
    let armed = false
    const onPointerOver = (event: PointerEvent) => {
      const element = frame.current
      if (!element || event.target === element) return
      armed = false
      document.removeEventListener('pointerover', onPointerOver)
      // Opaque sandbox origin: the target must be '*'; the message is data-free.
      element.contentWindow?.postMessage('agentra:pause', '*')
    }
    const onMessage = (event: MessageEvent) => {
      if (
        armed ||
        event.data !== 'agentra:figure-playing' ||
        event.source !== frame.current?.contentWindow
      )
        return
      armed = true
      document.addEventListener('pointerover', onPointerOver)
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      document.removeEventListener('pointerover', onPointerOver)
    }
  }, [frame, enabled])
}
