import type { TableHTMLAttributes } from 'react'
import { Table as ShadcnTable, TableCaption } from '../shadcn/table'

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  caption?: string
}

export function Table({
  children,
  caption,
  className = '',
  ...props
}: TableProps) {
  return (
    <ShadcnTable className={`table ${className}`.trim()} {...props}>
      {caption && <TableCaption className="sr-only">{caption}</TableCaption>}
      {children}
    </ShadcnTable>
  )
}
