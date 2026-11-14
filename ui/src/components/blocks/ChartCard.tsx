import { BarChart3, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../shadcn/card'
import { ToggleGroup, ToggleGroupItem } from '../shadcn/toggle-group'
import { t } from '@/lib/i18n/core'

export interface ChartCardProps {
  title: string
  description?: ReactNode
  /** Extra header controls (e.g. a metric toggle). */
  actions?: ReactNode
  /** Accessible table rendering of the same data; enables the chart/table switch. */
  table?: ReactNode
  /** Rendered instead of the chart when there is nothing to plot. */
  empty?: ReactNode
  isEmpty?: boolean
  footer?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

/** Visual container for one chart, with an optional chart ⇄ table switch. */
export function ChartCard({
  title,
  description,
  actions,
  table,
  empty,
  isEmpty,
  footer,
  className,
  contentClassName,
  children,
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const showTable = table !== undefined && view === 'table'
  return (
    <Card className={cn('gap-3 py-4 shadow-xs', className)}>
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
        {(actions || table !== undefined) && (
          <CardAction className="flex items-center gap-2">
            {actions}
            {table !== undefined && (
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value={view}
                onValueChange={(next) =>
                  next && setView(next as 'chart' | 'table')
                }
                aria-label={t('Kiểu hiển thị {title}', { title })}
              >
                <ToggleGroupItem value="chart" aria-label={t('Biểu đồ')}>
                  <BarChart3 className="size-3.5" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label={t('Bảng số liệu')}>
                  <Table2 className="size-3.5" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className={cn('px-4', contentClassName)}>
        {isEmpty ? (
          (empty ?? (
            <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {t('Chưa có dữ liệu cho bộ lọc hiện tại.')}
            </p>
          ))
        ) : showTable ? (
          <div className="max-h-80 overflow-auto">{table}</div>
        ) : (
          children
        )}
      </CardContent>
      {footer && (
        <div className="border-t px-4 pt-3 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </Card>
  )
}
