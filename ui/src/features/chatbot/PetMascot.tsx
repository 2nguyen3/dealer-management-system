import { useEffect, useState, type CSSProperties } from 'react'

export type PetMood =
  'idle' | 'wave' | 'happy' | 'think' | 'puzzled' | 'sad' | 'sleep'

/** Where the pet looks, each axis in [-1, 1]. */
export interface PetLook {
  x: number
  y: number
}

const EYE = '#7dd3fc'
const SCREEN = '#0b1324'
const centered = {
  transformBox: 'fill-box',
  transformOrigin: 'center',
} as const

/** Moods whose eyes are open pupils that blink and follow the pointer. */
const OPEN_EYES: ReadonlySet<PetMood> = new Set(['idle', 'think', 'puzzled'])

/**
 * Blinks every few seconds with a timer (a 150 ms state flip), so an idle
 * pet costs nothing between blinks instead of animating every frame.
 */
function useBlink(enabled: boolean): boolean {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reduce?.matches) return
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setBlink(true)
          timer = window.setTimeout(() => {
            setBlink(false)
            schedule()
          }, 150)
        },
        3200 + Math.random() * 2400,
      )
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [enabled])
  return enabled && blink
}

function Eyes({ mood }: { mood: PetMood }) {
  const blink = useBlink(OPEN_EYES.has(mood))
  if (mood === 'happy' || mood === 'wave')
    return (
      <g
        stroke={EYE}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        data-eyes="happy"
      >
        <path d="M22.5 29.5 Q25 25.5 27.5 29.5" />
        <path d="M36.5 29.5 Q39 25.5 41.5 29.5" />
      </g>
    )
  if (mood === 'sleep')
    return (
      <g stroke={EYE} strokeWidth="2.2" strokeLinecap="round" data-eyes="sleep">
        <path d="M22.5 29 Q25 31 27.5 29" fill="none" />
        <path d="M36.5 29 Q39 31 41.5 29" fill="none" />
      </g>
    )
  if (mood === 'sad')
    return (
      <g data-eyes="sad">
        <rect x="23" y="27" width="4.5" height="5" rx="2.2" fill={EYE} />
        <rect x="36.5" y="27" width="4.5" height="5" rx="2.2" fill={EYE} />
        <g stroke={EYE} strokeWidth="1.6" strokeLinecap="round">
          <path d="M22 24.5 L27.5 23" />
          <path d="M42 24.5 L36.5 23" />
        </g>
      </g>
    )
  // idle / think / puzzled: pupils that blink and follow the pointer. The
  // offset comes from CSS variables set by the host (no React re-render).
  const small = mood === 'puzzled'
  const follow: CSSProperties = {
    transform:
      mood === 'think'
        ? 'translate(2.2px, -2px)'
        : 'translate(calc(var(--pet-look-x, 0) * 2.6px), calc(var(--pet-look-y, 0) * 2px))',
    transition: 'transform 180ms ease-out',
  }
  return (
    <g data-eyes={mood} style={follow}>
      <g
        style={{
          ...centered,
          transform: blink ? 'scaleY(0.1)' : 'none',
          transition: 'transform 70ms ease-in-out',
        }}
      >
        <rect x="22.5" y="25" width="5" height="7.5" rx="2.5" fill={EYE} />
        <rect
          x={small ? 37 : 36.5}
          y={small ? 26.5 : 25}
          width={small ? 4 : 5}
          height={small ? 5 : 7.5}
          rx="2.2"
          fill={EYE}
        />
      </g>
    </g>
  )
}

function Mouth({ mood }: { mood: PetMood }) {
  const common = {
    stroke: EYE,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    fill: 'none',
  }
  switch (mood) {
    case 'happy':
    case 'wave':
      return <path d="M28.5 34.5 Q32 39 35.5 34.5 Z" fill={EYE} />
    case 'sad':
      return <path d="M29 37 Q32 34.5 35 37" {...common} />
    case 'puzzled':
      return <path d="M28.5 36 Q30.5 34.5 32 36 T35.5 36" {...common} />
    case 'think':
      return <path d="M30 36 L34 36" {...common} />
    case 'sleep':
      return <circle cx="32" cy="36" r="1.4" fill={EYE} />
    default:
      return <path d="M29 35 Q32 37.5 35 35" {...common} />
  }
}

/**
 * The assistant's companion: a small screen-faced robot that bobs, blinks,
 * follows the pointer with its eyes and changes expression with its mood.
 * Purely decorative (aria-hidden); the surrounding button carries the name.
 *
 * Performance: the idle bob and shadow are CSS transform animations on HTML
 * wrappers (`.pet-bob`, `.pet-shadow` in styles.css), which the compositor
 * runs without main-thread work; SVG-internal motion only happens on events
 * (blink, wave, thinking bulb). Pointer tracking reads `--pet-look-x/y`.
 */
export function PetMascot({
  mood,
  look,
  size = 64,
}: {
  mood: PetMood
  /** Optional fixed gaze; otherwise inherited `--pet-look-x/y` variables. */
  look?: PetLook
  size?: number
}) {
  const sleeping = mood === 'sleep'
  const bulb =
    mood === 'think' ? '#fbbf24' : mood === 'sad' ? '#f87171' : '#5eead4'
  const gaze = look
    ? ({ '--pet-look-x': look.x, '--pet-look-y': look.y } as CSSProperties)
    : undefined
  return (
    <span
      aria-hidden="true"
      data-mood={mood}
      className="pet relative inline-block shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.22, ...gaze }}
    >
      <span className="pet-shadow absolute bottom-[2.5%] left-1/2 h-[8%] w-[47%] rounded-[50%] bg-foreground/15" />
      <span className="pet-bob absolute inset-0">
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          focusable="false"
          className="overflow-visible"
        >
          {/* Antenna */}
          <line
            x1="32"
            y1="11"
            x2="32"
            y2="5.5"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="32"
            cy="4.5"
            r="2.8"
            fill={bulb}
            className={mood === 'think' ? 'pet-pulse' : undefined}
          />
          {/* Arms */}
          <rect
            x="5.5"
            y="31"
            width="7"
            height="11"
            rx="3.5"
            fill="var(--primary)"
          />
          <rect
            key={mood === 'wave' ? 'wave' : 'rest'}
            x="51.5"
            y="31"
            width="7"
            height="11"
            rx="3.5"
            fill="var(--primary)"
            className={mood === 'wave' ? 'pet-wave' : undefined}
            style={{ transformBox: 'fill-box', transformOrigin: '50% 15%' }}
          />
          {/* Body */}
          <rect
            x="10"
            y="11"
            width="44"
            height="40"
            rx="16"
            fill="var(--primary)"
          />
          <path
            d="M17 17 Q22 13.5 30 13.5"
            stroke="white"
            strokeOpacity="0.35"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Face screen */}
          <rect x="15.5" y="19" width="33" height="23" rx="9" fill={SCREEN} />
          <Eyes mood={mood} />
          <Mouth mood={mood} />
          {(mood === 'happy' || mood === 'wave') && (
            <g fill="#fb7185" opacity="0.55">
              <circle cx="19.5" cy="35" r="2" />
              <circle cx="44.5" cy="35" r="2" />
            </g>
          )}
        </svg>
      </span>
      {sleeping && (
        <span className="pet-z absolute end-[6%] top-0 text-[0.6em] leading-none font-semibold text-muted-foreground">
          z
        </span>
      )}
      {mood === 'puzzled' && (
        <span className="absolute end-[2%] top-0 animate-in text-[0.7em] leading-none font-bold text-amber-500 duration-200 zoom-in-50 fade-in-0">
          ?
        </span>
      )}
    </span>
  )
}
