import type { TableHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Table as ShadcnTable, TableCaption } from '../shadcn/table'

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  caption?: string
}

/**
 * Data table. Header/body styling for raw `<thead>/<tbody>` children is applied
 * through descendant selectors so feature pages need no per-cell classes.
 */
export function Table({
  children,
  caption,
  className = '',
  ...props
}: TableProps) {
  return (
    <ShadcnTable
      className={cn(
        'table text-[13px]',
        '[&_thead_th]:h-10 [&_thead_th]:bg-muted/60 [&_thead_th]:px-3 [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:tracking-wide [&_thead_th]:text-muted-foreground [&_thead_th]:uppercase',
        '[&_tbody_td]:px-3 [&_tbody_td]:py-2.5 [&_tbody_td]:align-middle',
        '[&_tbody_tr]:border-b [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/40 [&_tbody_tr:last-child]:border-0',
        className,
      )}
      {...props}
    >
      {caption && <TableCaption className="sr-only">{caption}</TableCaption>}
      {children}
    </ShadcnTable>
  )
}
