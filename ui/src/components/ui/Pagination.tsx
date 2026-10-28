import { Button } from './Button'
import { ChevronRightIcon } from './Icons'

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
    <div className="pagination">
      <div className="pagination-left">
        {totalShowing !== undefined && (
          <span className="pagination-info">
            Đang hiển thị <strong>{totalShowing}</strong> kết quả
          </span>
        )}
        {limit !== undefined && onLimitChange && (
          <div className="pagination-limit-selector">
            <label htmlFor="pagination-limit-select" className="sr-only">
              Số dòng mỗi trang
            </label>
            <span className="pagination-limit-label">Mỗi trang:</span>
            <select
              id="pagination-limit-select"
              className="select select--compact pagination-select"
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

      <div className="pagination-controls">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPrevious || isLoading}
        >
          Trang trước
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext || isLoading}
          icon={<ChevronRightIcon size={16} />}
        >
          Trang sau
        </Button>
      </div>
    </div>
  )
}
