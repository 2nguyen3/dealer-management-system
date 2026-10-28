import type { TableHTMLAttributes } from 'react'

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
    <div className="table-responsive">
      <table className={`table ${className}`.trim()} {...props}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}
