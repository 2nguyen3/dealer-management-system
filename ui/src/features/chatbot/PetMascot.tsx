import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

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

function Eyes({ mood, look }: { mood: PetMood; look: PetLook }) {
  const reduce = useReducedMotion()
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
  // idle / think / puzzled: pupils that blink and follow the pointer.
  const offset =
    mood === 'think' ? { x: 2.2, y: -2 } : { x: look.x * 2.6, y: look.y * 2 }
  const small = mood === 'puzzled'
  return (
    <motion.g
      data-eyes={mood}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <motion.g
        style={centered}
        animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1] }}
        transition={{
          duration: 4.2,
          times: [0, 0.93, 0.965, 1],
          repeat: Infinity,
          ease: 'easeInOut',
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
      </motion.g>
    </motion.g>
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
 */
export function PetMascot({
  mood,
  look = { x: 0, y: 0 },
  size = 64,
}: {
  mood: PetMood
  look?: PetLook
  size?: number
}) {
  const reduce = useReducedMotion()
  const sleeping = mood === 'sleep'
  const bob = reduce ? undefined : { y: sleeping ? [0, 1, 0] : [0, -2.5, 0] }
  const bulb =
    mood === 'think' ? '#fbbf24' : mood === 'sad' ? '#f87171' : '#5eead4'
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
      className="overflow-visible"
    >
      <motion.ellipse
        cx="32"
        cy="59"
        rx="15"
        ry="2.6"
        className="fill-foreground/15"
        style={centered}
        animate={reduce ? undefined : { scaleX: [1, 0.85, 1] }}
        transition={{ duration: sleeping ? 4 : 2.8, repeat: Infinity }}
      />
      <motion.g
        animate={bob}
        transition={{
          duration: sleeping ? 4 : 2.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
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
        <motion.circle
          cx="32"
          cy="4.5"
          r="2.8"
          fill={bulb}
          animate={
            reduce
              ? undefined
              : { opacity: mood === 'think' ? [1, 0.3, 1] : [1, 0.7, 1] }
          }
          transition={{
            duration: mood === 'think' ? 0.7 : 2.4,
            repeat: Infinity,
          }}
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
        <motion.rect
          x="51.5"
          y="31"
          width="7"
          height="11"
          rx="3.5"
          fill="var(--primary)"
          style={{ transformBox: 'fill-box', transformOrigin: '50% 15%' }}
          animate={
            mood === 'wave' && !reduce
              ? { rotate: [0, -150, -110, -150, -110, 0] }
              : { rotate: 0 }
          }
          transition={{ duration: 1.6, ease: 'easeInOut' }}
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
        <Eyes mood={mood} look={look} />
        <Mouth mood={mood} />
        {(mood === 'happy' || mood === 'wave') && (
          <g fill="#fb7185" opacity="0.55">
            <circle cx="19.5" cy="35" r="2" />
            <circle cx="44.5" cy="35" r="2" />
          </g>
        )}
      </motion.g>
      <AnimatePresence>
        {sleeping && (
          <motion.text
            key="z"
            x="50"
            y="12"
            className="fill-muted-foreground text-[9px] font-semibold"
            initial={{ opacity: 0, y: 4 }}
            animate={
              reduce ? { opacity: 1 } : { opacity: [0, 1, 0], y: [4, -4, -10] }
            }
            exit={{ opacity: 0 }}
            transition={{ duration: 2.6, repeat: Infinity }}
          >
            z
          </motion.text>
        )}
        {mood === 'puzzled' && (
          <motion.text
            key="q"
            x="52"
            y="12"
            className="fill-amber-500 text-[11px] font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            ?
          </motion.text>
        )}
      </AnimatePresence>
    </svg>
  )
}
