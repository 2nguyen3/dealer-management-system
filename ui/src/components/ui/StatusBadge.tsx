import { statusLabel, statusTone } from '../../lib/labels'
import { Badge } from './Badge'

export interface StatusBadgeProps {
  status: string | null | undefined
  /** Optional suffix such as a revision marker ("v2"). */
  suffix?: string
}

/** Vietnamese status badge; the raw server value stays available as a data attribute. */
export function StatusBadge({ status, suffix }: StatusBadgeProps) {
  return (
    <Badge variant={statusTone(status)} data-status={status ?? ''}>
      {statusLabel(status)}
      {suffix ? ` · ${suffix}` : ''}
    </Badge>
  )
}
