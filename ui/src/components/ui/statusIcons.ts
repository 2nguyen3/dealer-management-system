import {
  Archive,
  Ban,
  CircleCheck,
  CircleDot,
  CircleMinus,
  CirclePause,
  CircleSlash,
  CircleX,
  Clock,
  FilePen,
  ListFilter,
  Lock,
  TimerOff,
  type LucideIcon,
} from 'lucide-react'
import { statusTone, type Tone } from '../../lib/labels'

/** Default pictogram per tone; specific statuses override it below. */
const TONE_ICONS: Record<Tone, LucideIcon> = {
  success: CircleCheck,
  warning: Clock,
  danger: CircleX,
  info: CircleDot,
  neutral: CircleMinus,
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  DRAFT: FilePen,
  CANCELED: Ban,
  CANCELLED: Ban,
  LOCKED: Lock,
  TERMINATED: CircleSlash,
  INACTIVE: CirclePause,
  EXPIRED: TimerOff,
  DISCONTINUED: Archive,
}

/** Pictogram shown with a status; the text label stays the source of meaning. */
export function statusIcon(status: string | null | undefined): LucideIcon {
  return STATUS_ICONS[String(status)] ?? TONE_ICONS[statusTone(status)]
}

/**
 * Pictogram for a status filter option: `ListFilter` for "all" (empty value),
 * the status icon for a status with a distinct tone or override, otherwise
 * `null` (the option stays text-only, e.g. non-status filter values).
 */
export function filterOptionIcon(value: string): LucideIcon | null {
  if (!value || value === '__all' || value === '__all__') return ListFilter
  if (value in STATUS_ICONS || statusTone(value) !== 'neutral')
    return statusIcon(value)
  return null
}
