import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Agentra "Thủy" mark: a water drop cut by two waves. The waves read as the
 * crossbar of an "A" and as goods flowing through the distribution network.
 */
export function BrandMark({
  className,
  animated = false,
}: {
  className?: string
  animated?: boolean
}) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
    >
      <defs>
        <linearGradient id={`${id}-drop`} x1="14" y1="4" x2="52" y2="60">
          <stop offset="0" stopColor="#5fd4ff" />
          <stop offset="0.55" stopColor="#1f6bff" />
          <stop offset="1" stopColor="#0a2a6b" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d="M32 4C32 4 10 27.5 10 41.5C10 53.4 19.8 62 32 62C44.2 62 54 53.4 54 41.5C54 27.5 32 4 32 4Z" />
        </clipPath>
      </defs>
      <path
        d="M32 4C32 4 10 27.5 10 41.5C10 53.4 19.8 62 32 62C44.2 62 54 53.4 54 41.5C54 27.5 32 4 32 4Z"
        fill={`url(#${id}-drop)`}
      />
      <g clipPath={`url(#${id}-clip)`}>
        <g className={cn(animated && 'animate-wave')}>
          <path
            d="M0 40C8 36 14 36 22 40C30 44 36 44 44 40C52 36 58 36 70 40V64H0Z"
            fill="#ffffff"
            fillOpacity="0.22"
          />
          <path
            d="M0 47C8 43 14 43 22 47C30 51 36 51 44 47C52 43 58 43 70 47V64H0Z"
            fill="#ffffff"
            fillOpacity="0.28"
          />
        </g>
      </g>
      <path
        d="M24 46L32 24L40 46"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx="22.5"
        cy="30"
        rx="2.6"
        ry="5"
        fill="#ffffff"
        fillOpacity="0.55"
        transform="rotate(25 22.5 30)"
      />
    </svg>
  )
}

/** Mark + wordmark lockup. */
export function BrandLockup({
  className,
  subtitle = 'Dealer Management',
  tone = 'default',
}: {
  className?: string
  subtitle?: string | null
  tone?: 'default' | 'inverse'
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className="size-9" animated />
      <span className="grid leading-tight">
        <span
          className={cn(
            'text-[0.95rem] font-bold tracking-tight',
            tone === 'inverse' ? 'text-white' : 'text-foreground',
          )}
        >
          agentra<span className="text-[#3fa9ff]">_</span>
        </span>
        {subtitle && (
          <span
            className={cn(
              'text-[0.65rem] tracking-[0.18em] uppercase',
              tone === 'inverse'
                ? 'text-sidebar-foreground/70'
                : 'text-muted-foreground',
            )}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}
