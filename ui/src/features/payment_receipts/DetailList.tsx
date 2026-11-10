import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type DetailEntry = [label: string, value: ReactNode]

/**
 * Label/value pairs for a record detail, laid out as a responsive
 * description-list grid. Each `<dt>` is immediately followed by its `<dd>`.
 */
export function DetailList({
  entries,
  className,
}: {
  entries: DetailEntry[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border bg-card p-4 sm:grid-cols-2',
        className,
      )}
    >
      {entries.map(([label, value]) => (
        <div key={label} className="min-w-0 border-b border-dashed pb-2">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
