import { createElement } from 'react'
import { statusLabel, statusTone } from '../../lib/labels'
import { Badge } from './Badge'
import { statusIcon } from './statusIcons'

export interface StatusBadgeProps {
  status: string | null | undefined
  /** Optional suffix such as a revision marker ("v2"). */
  suffix?: string
}

/** Vietnamese status badge with a status pictogram; the raw server value stays available as a data attribute. */
export function StatusBadge({ status, suffix }: StatusBadgeProps) {
  return (
    <Badge
      variant={statusTone(status)}
      data-status={status ?? ''}
      icon={createElement(statusIcon(status))}
    >
      {statusLabel(status)}
      {suffix ? ` · ${suffix}` : ''}
    </Badge>
  )
}
