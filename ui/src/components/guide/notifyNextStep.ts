import { toast } from 'sonner'
import { t } from '@/lib/i18n/core'
import { hintsEnabled } from './preferences'

/** Toaster id of the bottom-right guidance stack (normal toasts stay top-right). */
export const GUIDE_TOASTER = 'guide'
/** How long a next-step toast stays visible. */
export const NEXT_STEP_DURATION = 6000

type Navigate = (to: string) => void
let navigate: Navigate | null = null
let canOpen: (to: string) => boolean = () => true

/**
 * The shell registers the router's navigate (so toasts open pages client-side)
 * and a permission check (so "Mở" never leads to an access-denied page).
 */
export function registerGuideNavigator(
  next: Navigate | null,
  allowed: (to: string) => boolean = () => true,
): void {
  navigate = next
  canOpen = allowed
}

export interface NextStep {
  /** What just happened, e.g. "Đã nộp PX-778." (already translated). */
  done: string
  /** The next step and who does it (already translated). */
  next?: string
  /** Page that performs the next step; shows an "Mở" button. */
  to?: string
}

/**
 * Bottom-right toast that says what happened and what comes next, with an
 * "Mở" shortcut. Respects the user's hint switch; returns whether it showed.
 */
export function notifyNextStep({ done, next, to }: NextStep): boolean {
  if (!hintsEnabled() || !done.trim()) return false
  toast.success(done, {
    toasterId: GUIDE_TOASTER,
    duration: NEXT_STEP_DURATION,
    ...(next ? { description: next } : {}),
    ...(to && canOpen(to)
      ? {
          action: {
            label: t('Mở'),
            onClick: () =>
              navigate ? navigate(to) : window.location.assign(to),
          },
        }
      : {}),
  })
  return true
}
