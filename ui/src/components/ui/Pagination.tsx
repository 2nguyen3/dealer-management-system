import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { t } from '@/lib/i18n/core'

export interface PaginationProps {
  onNext?: () => void
  onPrevious?: () => void
  hasNext?: boolean
  hasPrevious?: boolean
  isLoading?: boolean
  limit?: number
  onLimitChange?: (newLimit: number) => void
  totalShowing?: number
}

export function Pagination({
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  isLoading = false,
  limit,
  onLimitChange,
  totalShowing,
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-4">
        {totalShowing !== undefined && (
          <span>
            {t('Đang hiển thị')}{' '}
            <strong className="font-semibold text-foreground tabular-nums">
              {totalShowing}
            </strong>{' '}
            {t('kết quả')}
          </span>
        )}
        {limit !== undefined && onLimitChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pagination-limit-select" className="sr-only">
              {t('Số dòng mỗi trang')}
            </label>
            <span aria-hidden="true">{t('Mỗi trang:')}</span>
            <select
              id="pagination-limit-select"
              className="h-8 rounded-md border bg-card px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              disabled={isLoading}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPrevious || isLoading}
          icon={<ChevronLeft className="size-4" />}
        >
          {t('Trang trước')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext || isLoading}
        >
          Trang sau
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
