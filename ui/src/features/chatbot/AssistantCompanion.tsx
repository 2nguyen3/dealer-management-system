import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { toast } from 'sonner'
import { getLocale, t } from '@/lib/i18n/core'
import { localeDirection } from '@/lib/i18n/locales'
import { cn } from '@/lib/utils'
import { useAuth } from '../authentication/useAuth'
import { AssistantPanel } from './AssistantPanel'
import { ASSISTANT_PERMISSIONS } from './contract'
import { PetMascot, type PetLook, type PetMood } from './PetMascot'
import {
  setAssistantPlacement,
  useAssistantPlacement,
  type AssistantPlacement,
} from './preferences'
import { useAssistantChat, type ChatOutcome } from './useAssistantChat'

const PET = 68
const EDGE = 20
const GREETED_KEY = 'agentra-assistant-greeted'
const SLEEP_AFTER_MS = 120_000

const outcomeMood: Record<ChatOutcome, PetMood> = {
  ANSWERED: 'happy',
  NEEDS_SELECTION: 'puzzled',
  NEEDS_INFO: 'puzzled',
  REFUSED: 'sad',
  ERROR: 'sad',
  UNAVAILABLE: 'sad',
}

function firstNameOf(fullName: string | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/)
  return parts[parts.length - 1] || t('bạn')
}

function greetedThisSession(): boolean {
  try {
    if (sessionStorage.getItem(GREETED_KEY)) return true
    sessionStorage.setItem(GREETED_KEY, '1')
  } catch {
    // Greet every load when storage is unavailable.
  }
  return false
}

/**
 * Floating companion that opens the read-only assistant. Shown to users with
 * at least one metric permission unless hidden (menu or Hồ sơ → Giao diện).
 * Keyed by user so an account switch drops the conversation.
 */
export function AssistantCompanion() {
  const { user, hasPermission } = useAuth()
  const placement = useAssistantPlacement()
  if (!user || placement.hidden || !hasPermission(ASSISTANT_PERMISSIONS))
    return null
  return (
    <Companion
      key={user.id}
      placement={placement}
      firstName={firstNameOf(user.fullName)}
      hasPermission={(code) => hasPermission(code)}
    />
  )
}

function Companion({
  placement,
  firstName,
  hasPermission,
}: {
  placement: AssistantPlacement
  firstName: string
  hasPermission: Parameters<typeof AssistantPanel>[0]['hasPermission']
}) {
  const reduce = useReducedMotion()
  const panelId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [transient, setTransient] = useState<PetMood | null>(null)
  const [sleeping, setSleeping] = useState(false)
  const [look, setLook] = useState<PetLook>({ x: 0, y: 0 })
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const openRef = useRef(open)
  const lastActive = useRef(0)
  const dragStart = useRef<{
    pointerX: number
    pointerY: number
    x: number
    y: number
    moved: boolean
  } | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    openRef.current = open
  }, [open])

  const flash = useCallback((mood: PetMood, ms = 2600) => {
    setTransient(mood)
    window.setTimeout(
      () => setTransient((current) => (current === mood ? null : current)),
      ms,
    )
  }, [])

  const onSettled = useCallback(
    (outcome: ChatOutcome) => {
      flash(outcomeMood[outcome])
      if (!openRef.current) {
        setUnread(true)
        setBubble(
          outcome === 'ANSWERED'
            ? t('Có kết quả rồi, bấm vào mình để xem nhé!')
            : t('Mình cần bạn xem lại câu hỏi một chút.'),
        )
      }
    },
    [flash],
  )
  const chat = useAssistantChat(onSettled)

  // Greeting once per browser session.
  useEffect(() => {
    if (greetedThisSession()) return
    const show = window.setTimeout(() => {
      setBubble(
        t('Chào {name}! Cần tra công nợ, tồn kho hay doanh số cứ hỏi mình.', {
          name: firstName,
        }),
      )
      flash('wave', 2200)
    }, 1200)
    return () => window.clearTimeout(show)
  }, [firstName, flash])

  // Speech bubbles fade on their own.
  useEffect(() => {
    if (!bubble) return
    const hide = window.setTimeout(() => setBubble(null), 7000)
    return () => window.clearTimeout(hide)
  }, [bubble])

  // Falls asleep after a while without input; any input wakes it up.
  useEffect(() => {
    const wake = () => {
      lastActive.current = Date.now()
      setSleeping(false)
    }
    lastActive.current = Date.now()
    const check = window.setInterval(() => {
      if (!openRef.current && Date.now() - lastActive.current > SLEEP_AFTER_MS)
        setSleeping(true)
    }, 10_000)
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.clearInterval(check)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])

  // Eyes follow the pointer (one update per frame).
  useEffect(() => {
    if (reduce) return
    let frame = 0
    const onMove = (event: PointerEvent) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const rect = button.current?.getBoundingClientRect()
        if (!rect) return
        const dx = event.clientX - (rect.left + rect.width / 2)
        const dy = event.clientY - (rect.top + rect.height / 2)
        const distance = Math.max(1, Math.hypot(dx, dy))
        const reach = Math.min(1, distance / 240)
        setLook({ x: (dx / distance) * reach, y: (dy / distance) * reach })
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [reduce])

  useEffect(() => {
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const rtl = localeDirection(getLocale()) === 'rtl'
  const bottom = Math.max(
    8,
    Math.min(placement.bottom, viewport.height - PET - 8),
  )
  const onRight = (placement.side === 'end') !== rtl
  const mood: PetMood = chat.pending
    ? 'think'
    : (transient ?? (sleeping && !open ? 'sleep' : 'idle'))

  const toggle = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setOpen((value) => !value)
    setUnread(false)
    setBubble(null)
    setSleeping(false)
  }

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: rect.left,
      y: rect.top,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current
    if (!start) return
    const dx = event.clientX - start.pointerX
    const dy = event.clientY - start.pointerY
    if (!start.moved && Math.hypot(dx, dy) < 6) return
    start.moved = true
    setBubble(null)
    setDrag({
      x: Math.max(4, Math.min(viewport.width - PET - 4, start.x + dx)),
      y: Math.max(4, Math.min(viewport.height - PET - 4, start.y + dy)),
    })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current
    dragStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (!start?.moved || !drag) return
    suppressClick.current = true
    // Snap to the nearest side edge; keep the height the user chose.
    const physicalRight = drag.x + PET / 2 > viewport.width / 2
    setAssistantPlacement({
      side: physicalRight !== rtl ? 'end' : 'start',
      bottom: Math.round(viewport.height - drag.y - PET),
    })
    setDrag(null)
    flash('happy', 1200)
  }

  // Panel: same side as the pet, above it when there is room.
  const narrow = viewport.width < 640
  const panelBottom = Math.min(
    bottom + PET + 12,
    Math.max(12, viewport.height - 420),
  )
  const panelHeight = Math.min(600, viewport.height - panelBottom - 12)

  const petStyle = drag
    ? { left: drag.x, top: drag.y }
    : {
        bottom,
        [onRight ? 'right' : 'left']: EDGE,
      }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            className="fixed z-[60] print:hidden"
            style={
              narrow
                ? { left: 12, right: 12, bottom: panelBottom }
                : {
                    bottom: panelBottom,
                    [onRight ? 'right' : 'left']: EDGE,
                    width: 400,
                  }
            }
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <AssistantPanel
              id={panelId}
              items={chat.items}
              pending={chat.pending}
              firstName={firstName}
              hasPermission={hasPermission}
              onSend={chat.send}
              onChoose={chat.choose}
              onReset={chat.reset}
              onHide={() => {
                setOpen(false)
                setAssistantPlacement({ hidden: true })
                toast(t('Đã ẩn trợ lý. Bật lại trong Hồ sơ → Giao diện.'))
              }}
              onClose={close}
              style={{ height: Math.max(320, panelHeight) }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="fixed z-[60] print:hidden"
        style={petStyle}
        data-testid="assistant-companion"
      >
        <AnimatePresence>
          {bubble && !open && !drag && (
            <motion.div
              key={bubble}
              role="status"
              className={cn(
                'absolute bottom-full mb-2 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-2xl border bg-popover px-3 py-2 text-xs leading-snug text-popover-foreground shadow-lg',
                onRight ? 'right-1 rounded-br-sm' : 'left-1 rounded-bl-sm',
              )}
              initial={reduce ? false : { opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <button
                type="button"
                className="text-start"
                onClick={() => {
                  setBubble(null)
                  setOpen(true)
                  setUnread(false)
                }}
              >
                {bubble}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          ref={button}
          type="button"
          aria-label={open ? t('Đóng trợ lý Agentra') : t('Mở trợ lý Agentra')}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          title={t('Kéo để di chuyển, bấm để trò chuyện')}
          onClick={toggle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragStart.current = null
            setDrag(null)
          }}
          whileHover={reduce || drag ? undefined : { scale: 1.06, rotate: -3 }}
          whileTap={reduce ? undefined : { scale: 0.94 }}
          className={cn(
            'relative flex touch-none items-center justify-center rounded-full outline-none select-none',
            'focus-visible:ring-4 focus-visible:ring-ring/40',
            drag ? 'cursor-grabbing' : 'cursor-pointer',
          )}
          style={{ width: PET, height: PET }}
        >
          <PetMascot mood={mood} look={look} size={PET} />
          {unread && !open && (
            <span className="absolute top-1 end-1 flex size-3.5 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-rose-500 ring-2 ring-background" />
              <span className="sr-only">{t('Có câu trả lời mới')}</span>
            </span>
          )}
        </motion.button>
      </div>
    </>
  )
}
