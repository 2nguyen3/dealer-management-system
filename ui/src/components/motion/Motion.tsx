import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
} from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const EASE = [0.22, 1, 0.36, 1] as const

/** Route-level enter animation: fade + short rise. Keyed by the caller. */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Container that staggers its <StaggerItem> children in. */
export function Stagger({
  children,
  className,
  delay = 0,
  step = 0.05,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number; step?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      className={cn('min-w-0', className)}
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.98 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.4, ease: EASE },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * Number that counts up from 0 when it scrolls into view. `format` renders the
 * intermediate values; the final text equals `format(value)` exactly.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('vi-VN'),
  duration = 0.9,
  className,
}: {
  value: number
  format?: (value: number) => string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  // Without IntersectionObserver (tests, old browsers) show the final value.
  const reduce =
    useReducedMotion() || typeof IntersectionObserver === 'undefined'
  const count = useMotionValue(reduce ? value : 0)
  const text = useTransform(count, (latest) => format(latest))
  useEffect(() => {
    const element = ref.current
    if (reduce || !element) {
      count.set(value)
      return
    }
    let controls: ReturnType<typeof animate> | undefined
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      controls = animate(count, value, { duration, ease: EASE })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      controls?.stop()
    }
  }, [count, duration, reduce, value])
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  )
}
