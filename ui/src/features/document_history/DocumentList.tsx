import { FileSearch, Filter, Search } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DateField } from '../../components/blocks/DateField'
import { SortableHeader, SortMenu } from '../../components/data/SortControls'
import { nextSort, type SortValue } from '../../components/data/sorting'
import { Card } from '../../components/shadcn/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../../components/shadcn/input-group'
import { Label } from '../../components/shadcn/label'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { EntityPicker } from '../../components/ui/EntityPicker'
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
import { DocumentInsights } from './DocumentInsights'
import { FilterStatus, SegmentedFilter, TableSkeleton } from './DocumentParts'
import { useDocumentPage } from './useDocumentRequests'
import { t } from '@/lib/i18n/core'

/** Server default order of every document list (contract `sort` default). */
export const DOCUMENT_DEFAULT_SORT = '-businessDate'
/** Contract sort fields of /documents and the four goods-document lists. */
export const DOCUMENT_SORT_OPTIONS = [
  { field: 'businessDate', label: t('Ngày chứng từ') },
  { field: 'totalAmount', label: t('Tổng tiền') },
  { field: 'createdAt', label: t('Thời điểm lập') },
  { field: 'id', label: t('Thứ tự lập') },
] as const

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
    { value: '', label: t('Tất cả') },
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
  insights = true,
}: {
  kind?: DocumentKind
  posted?: boolean
  version?: number
  actions: (row: DocumentSummary) => ReactNode
  /** Primary row action; the row stays keyboard-reachable via `actions`. */
  onRowClick?: (row: DocumentSummary) => void
  /** Show the page-level visual summary above the table. */
  insights?: boolean
}) {
  const { hasPermission } = useAuth()
  const searchId = useId()
  const [draft, setDraft] = useState({ ...emptyDraft, kind: kind ?? '' })
  const [filters, setFilters] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<SortValue>(DOCUMENT_DEFAULT_SORT)
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
  query.set('sort', sort || DOCUMENT_DEFAULT_SORT)
  if (posted) query.set('status', 'POSTED')
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!)
  const path = `${kind ? documentKinds[kind].path : '/documents'}?${query}`
  // Version changes trigger only this active list, not unrelated master/ledger reads.
  const data = useDocumentPage(allowed ? path : null, parseSummary, version)
  if (!allowed)
    return <Alert type="error">{t('Không có quyền đọc chứng từ.')}</Alert>
  const showKind = !kind
  const showAgency = !kind || !agencyless.includes(kind)
  const showProduct = !kind || !productless.includes(kind)
  const activeFilters =
    [...new URLSearchParams(filters).keys()].length + (status ? 1 : 0)
  const columns = 5 + (showKind ? 1 : 0) + (showAgency ? 1 : 0)
  function apply(next: typeof draft) {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(next))
      if (value && (!kind || name !== 'kind')) params.set(name, value)
    setCursors([''])
    setFilters(params.toString())
  }
  function changeSort(next: SortValue) {
    // Clearing a header returns to the contract default, never an unsent sort.
    setSort(next || DOCUMENT_DEFAULT_SORT)
    setCursors([''])
  }
  function onSort(field: string, firstDirection?: 'asc' | 'desc') {
    changeSort(nextSort(sort, field, firstDirection))
  }
  function reset() {
    const cleared = { ...emptyDraft, kind: kind ?? '' }
    setDraft(cleared)
    setStatus('')
    apply(cleared)
  }
  return (
    <div className="space-y-4">
      <Card className="gap-0 p-3 shadow-xs sm:p-4">
        <form
          aria-label={t('Bộ lọc chứng từ')}
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(auto-fit,minmax(9.5rem,1fr))]"
          onSubmit={(event) => {
            event.preventDefault()
            apply(draft)
          }}
        >
          <div className="grid min-w-0 gap-1.5 sm:col-span-2 lg:col-span-2 xl:col-span-1">
            <Label
              htmlFor={searchId}
              className="text-[13px] text-foreground/85"
            >
              {t('Tìm chứng từ')}
            </Label>
            <InputGroup className="bg-card">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id={searchId}
                type="search"
                placeholder={t('Mã, đại lý, ghi chú…')}
                value={draft.q}
                onChange={(event) =>
                  setDraft({ ...draft, q: event.target.value })
                }
              />
            </InputGroup>
          </div>
          {!kind && (
            <Select
              label={t('Loại chứng từ')}
              value={draft.kind}
              onChange={(event) =>
                setDraft({ ...draft, kind: event.target.value })
              }
              options={[
                { value: '', label: t('Tất cả loại') },
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
              label={t('Đại lý')}
              placeholder={t('Tất cả')}
              value={draft.agencyId}
              onChange={(agencyId) => setDraft({ ...draft, agencyId })}
            />
          )}
          {showProduct && (
            <EntityPicker
              id="document-filter-product"
              resource="products"
              label={t('Mặt hàng')}
              placeholder={t('Tất cả')}
              value={draft.productId}
              onChange={(productId) => setDraft({ ...draft, productId })}
            />
          )}
          <DateField
            label={t('Từ ngày')}
            value={draft.fromDate}
            max={draft.toDate || undefined}
            onChange={(fromDate) => setDraft({ ...draft, fromDate })}
          />
          <DateField
            label={t('Đến ngày (không gồm)')}
            value={draft.toDate}
            min={draft.fromDate || undefined}
            onChange={(toDate) => setDraft({ ...draft, toDate })}
          />
          <Button
            type="submit"
            icon={<Filter className="size-4" />}
            className="w-full"
          >
            {t('Áp dụng bộ lọc')}
          </Button>
        </form>
      </Card>
      {data.error && (
        <Alert type="error">
          <span className="flex flex-wrap items-center gap-3">
            {data.error}
            <Button variant="outline" size="sm" onClick={data.reload}>
              {t('Thử tải lại')}
            </Button>
          </span>
        </Alert>
      )}
      {insights && data.page && (
        <DocumentInsights
          items={data.page.items}
          partial={data.page.pagination.hasMore || cursors.length > 1}
        />
      )}
      <Card className="gap-0 overflow-hidden py-0 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {posted ? (
              <p className="text-sm font-medium text-foreground">
                {t('Chứng từ đã ghi sổ')}
              </p>
            ) : (
              <SegmentedFilter
                label={t('Lọc theo trạng thái')}
                value={status}
                options={statusSegments(kind)}
                onChange={(next) => {
                  setStatus(next)
                  setCursors([''])
                }}
              />
            )}
            <FilterStatus count={activeFilters} onReset={reset} />
          </div>
          <div className="flex items-center gap-2">
            {data.page && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('{count} dòng', { count: data.page.items.length })}
              </span>
            )}
            <SortMenu
              options={DOCUMENT_SORT_OPTIONS}
              sort={sort}
              onChange={changeSort}
            />
          </div>
        </div>
        {data.loading ? (
          <TableSkeleton columns={columns} label={t('Đang tải chứng từ...')} />
        ) : (
          data.page &&
          (data.page.items.length ? (
            <div className="overflow-x-auto">
              <Table
                caption={t('Danh sách chứng từ')}
                className="min-w-[640px]"
              >
                <thead>
                  <tr>
                    <th>{t('Mã chứng từ')}</th>
                    {showKind && <th>{t('Loại')}</th>}
                    {showAgency && <th>{t('Đại lý')}</th>}
                    <SortableHeader
                      field="businessDate"
                      sort={sort}
                      onSort={onSort}
                      firstDirection="desc"
                    >
                      {t('Ngày')}
                    </SortableHeader>
                    <SortableHeader
                      field="totalAmount"
                      sort={sort}
                      onSort={onSort}
                      firstDirection="desc"
                      align="right"
                    >
                      {t('Tổng tiền')}
                    </SortableHeader>
                    <th>{t('Trạng thái')}</th>
                    <th className="cell-actions">
                      <span className="sr-only">{t('Thao tác')}</span>
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
                title={t('Không có chứng từ phù hợp.')}
                description={activeFilters ? t('Thử nới bộ lọc.') : undefined}
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
