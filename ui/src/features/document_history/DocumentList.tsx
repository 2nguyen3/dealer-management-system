import { FileSearch, RotateCcw, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DateField } from '../../components/blocks/DateField'
import { Card } from '../../components/shadcn/card'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Table } from '../../components/ui/Table'
import { formatDate, formatVND } from '../../lib/formatters'
import { kindLabel, statusLabel } from '../../lib/labels'
import { useAuth } from '../authentication/useAuth'
import {
  canReadKind,
  documentKinds,
  parseSummary,
  type DocumentKind,
  type DocumentSummary,
} from './documentContracts'
import { SegmentedFilter, TableSkeleton } from './DocumentParts'
import { useDocumentPage } from './useDocumentRequests'

const statuses = ['DRAFT', 'PENDING', 'POSTED', 'CANCELLED'] as const
// Receipts and adjustments never carry an agency; issues/returns/money kinds do.
const agencyless: readonly DocumentKind[] = [
  'STOCK_RECEIPT',
  'STOCK_ADJUSTMENT',
]
// Money-only kinds have no product lines to filter by.
const productless: readonly DocumentKind[] = [
  'PAYMENT_RECEIPT',
  'CREDIT_APPLICATION',
  'REFUND',
]
const emptyDraft = {
  q: '',
  kind: '',
  fromDate: '',
  toDate: '',
  agencyId: '',
  productId: '',
}

/** Status segments for a list: only stock issues wait in PENDING. */
function statusSegments(kind?: DocumentKind) {
  return [
    { value: '', label: 'Tất cả' },
    ...statuses
      .filter((value) => value !== 'PENDING' || !kind || kind === 'STOCK_ISSUE')
      .map((value) => ({ value, label: statusLabel(value) })),
  ]
}

export function DocumentList({
  kind,
  posted = false,
  version = 0,
  actions,
  onRowClick,
}: {
  kind?: DocumentKind
  posted?: boolean
  version?: number
  actions: (row: DocumentSummary) => ReactNode
  /** Primary row action; the row stays keyboard-reachable via `actions`. */
  onRowClick?: (row: DocumentSummary) => void
}) {
  const { hasPermission } = useAuth()
  const [draft, setDraft] = useState({ ...emptyDraft, kind: kind ?? '' })
  const [filters, setFilters] = useState('')
  const [status, setStatus] = useState('')
  const [limit, setLimit] = useState(25)
  const [cursors, setCursors] = useState<string[]>([''])
  const allowed = kind
    ? canReadKind(kind, hasPermission)
    : Object.keys(documentKinds).some((item) =>
        canReadKind(item as DocumentKind, hasPermission),
      )
  const query = new URLSearchParams(filters)
  if (status && !posted) query.set('status', status)
  query.set('limit', String(limit))
  query.set('sort', '-businessDate')
  if (posted) query.set('status', 'POSTED')
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!)
  const path = `${kind ? documentKinds[kind].path : '/documents'}?${query}`
  // Version changes trigger only this active list, not unrelated master/ledger reads.
  const data = useDocumentPage(allowed ? path : null, parseSummary, version)
  if (!allowed) return <Alert type="error">Không có quyền đọc chứng từ.</Alert>
  const showKind = !kind
  const showAgency = !kind || !agencyless.includes(kind)
  const showProduct = !kind || !productless.includes(kind)
  const filtered = filters !== '' || status !== ''
  const columns = 5 + (showKind ? 1 : 0) + (showAgency ? 1 : 0)
  function apply(next: typeof draft) {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(next))
      if (value && (!kind || name !== 'kind')) params.set(name, value)
    setCursors([''])
    setFilters(params.toString())
  }
  return (
    <div className="space-y-4">
      <Card className="gap-0 p-4 shadow-xs">
        <form
          aria-label="Bộ lọc chứng từ"
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault()
            apply(draft)
          }}
        >
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Input
              label="Tìm chứng từ"
              placeholder="Mã chứng từ, đại lý, ghi chú…"
              value={draft.q}
              className="pl-9"
              onChange={(event) =>
                setDraft({ ...draft, q: event.target.value })
              }
            />
            <Search
              className="pointer-events-none absolute bottom-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          {!kind && (
            <Select
              label="Loại chứng từ"
              value={draft.kind}
              onChange={(event) =>
                setDraft({ ...draft, kind: event.target.value })
              }
              options={[
                { value: '', label: 'Tất cả loại được phép' },
                ...Object.entries(documentKinds)
                  .filter(([key]) =>
                    canReadKind(key as DocumentKind, hasPermission),
                  )
                  .map(([value]) => ({ value, label: kindLabel(value) })),
              ]}
            />
          )}
          {showAgency && (
            <EntityPicker
              id="document-filter-agency"
              resource="agencies"
              label="Đại lý"
              placeholder="Tất cả đại lý"
              value={draft.agencyId}
              onChange={(agencyId) => setDraft({ ...draft, agencyId })}
            />
          )}
          {showProduct && (
            <EntityPicker
              id="document-filter-product"
              resource="products"
              label="Mặt hàng"
              placeholder="Tất cả mặt hàng"
              value={draft.productId}
              onChange={(productId) => setDraft({ ...draft, productId })}
            />
          )}
          <DateField
            label="Từ ngày"
            value={draft.fromDate}
            max={draft.toDate || undefined}
            onChange={(fromDate) => setDraft({ ...draft, fromDate })}
          />
          <DateField
            label="Đến ngày (không gồm)"
            value={draft.toDate}
            min={draft.fromDate || undefined}
            onChange={(toDate) => setDraft({ ...draft, toDate })}
          />
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" className="flex-1">
              Áp dụng bộ lọc
            </Button>
            {filters !== '' && (
              <Button
                type="button"
                variant="ghost"
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  const reset = { ...emptyDraft, kind: kind ?? '' }
                  setDraft(reset)
                  apply(reset)
                }}
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </form>
      </Card>
      {data.error && (
        <Alert type="error">
          <span className="flex flex-wrap items-center gap-3">
            {data.error}
            <Button variant="outline" size="sm" onClick={data.reload}>
              Thử tải lại
            </Button>
          </span>
        </Alert>
      )}
      <Card className="gap-0 overflow-hidden py-0 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          {posted ? (
            <p className="text-sm font-medium text-foreground">
              Chứng từ đã ghi sổ
            </p>
          ) : (
            <SegmentedFilter
              label="Lọc theo trạng thái"
              value={status}
              options={statusSegments(kind)}
              onChange={(next) => {
                setStatus(next)
                setCursors([''])
              }}
            />
          )}
          {data.page && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {data.page.items.length} chứng từ trên trang này
            </p>
          )}
        </div>
        {data.loading ? (
          <TableSkeleton columns={columns} label="Đang tải chứng từ..." />
        ) : (
          data.page &&
          (data.page.items.length ? (
            <div className="overflow-x-auto">
              <Table caption="Danh sách chứng từ" className="min-w-[640px]">
                <thead>
                  <tr>
                    <th>Mã chứng từ</th>
                    {showKind && <th>Loại</th>}
                    {showAgency && <th>Đại lý</th>}
                    <th>Ngày</th>
                    <th className="cell-number">Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th className="cell-actions">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.page.items.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(onRowClick && 'cursor-pointer')}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      <td className="font-semibold whitespace-nowrap text-foreground">
                        {row.code}
                      </td>
                      {showKind && <td>{kindLabel(row.kind)}</td>}
                      {showAgency && (
                        <td className="max-w-56 truncate">
                          {row.agencyName ??
                            (row.agencyId ? `#${row.agencyId}` : '—')}
                        </td>
                      )}
                      <td className="whitespace-nowrap tabular-nums">
                        {formatDate(row.businessDate)}
                      </td>
                      <td className="cell-number font-medium">
                        {formatVND(row.totalAmount)}
                      </td>
                      <td>
                        <StatusBadge
                          status={row.status}
                          suffix={
                            row.revisionNo > 1
                              ? `v${row.revisionNo}`
                              : undefined
                          }
                        />
                      </td>
                      <td
                        className="cell-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {actions(row)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<FileSearch className="size-6" />}
                title="Không có chứng từ phù hợp."
                description={
                  filtered
                    ? 'Thử đổi trạng thái hoặc xóa bớt điều kiện lọc.'
                    : 'Chứng từ mới tạo sẽ xuất hiện tại đây.'
                }
              />
            </div>
          ))
        )}
        {data.page && (
          <Pagination
            limit={limit}
            onLimitChange={(value) => {
              setLimit(value)
              setCursors([''])
            }}
            totalShowing={data.page.items.length}
            hasNext={data.page.pagination.hasMore}
            hasPrevious={cursors.length > 1}
            onNext={() => {
              if (data.page?.pagination.nextCursor)
                setCursors([...cursors, data.page.pagination.nextCursor])
            }}
            onPrevious={() => setCursors(cursors.slice(0, -1))}
          />
        )}
      </Card>
    </div>
  )
}
