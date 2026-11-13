import {
  Boxes,
  PackageSearch,
  Search,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { KpiCard } from '../../components/blocks/KpiCard'
import { PageHeader } from '../../components/blocks/PageHeader'
import { SortableHeader } from '../../components/data/SortControls'
import { nextSort, type SortValue } from '../../components/data/sorting'
import { CountUp } from '../../components/motion/Motion'
import { Card } from '../../components/shadcn/card'
import { Progress } from '../../components/shadcn/progress'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { formatCompactVND, toNumber } from '../../lib/chart'
import { formatQuantity, formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import {
  SegmentedFilter,
  SectionCard,
  TableSkeleton,
} from '../document_history/DocumentParts'
import { id, message } from '../payment_receipts/contracts'
import { SourceStatement } from '../receivables/SourceStatement'
import {
  LowStockCard,
  StockHealthCard,
  StockValueChart,
} from './InventoryInsights'
import {
  parseStockRows,
  stockLevel,
  totalStockValue,
  type StockRow,
} from './inventoryRows'

/** Product list contract sort default for the overview (name ascending). */
const OVERVIEW_DEFAULT_SORT = 'name'
const overviewPath = (sort: SortValue) =>
  `/products?limit=100&sort=${encodeURIComponent(sort || OVERVIEW_DEFAULT_SORT)}`

function KpiSkeleton() {
  return (
    <Card className="gap-3 p-4 shadow-xs" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-32" />
    </Card>
  )
}

export function InventoryPage() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('inventory.read')
  const [selected, setSelected] = useState('')
  const [selectedLabel, setSelectedLabel] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<StockRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(canRead)
  const [overviewError, setOverviewError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [sort, setSort] = useState<SortValue>(OVERVIEW_DEFAULT_SORT)
  const statementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!canRead) return
    const controller = new AbortController()
    apiFetch<unknown>(overviewPath(sort), { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        const data = result.data as { pagination?: { hasMore?: unknown } }
        setRows(parseStockRows(result.data))
        setHasMore(data?.pagination?.hasMore === true)
        setOverviewError('')
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setOverviewError(message(failure))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [canRead, attempt, sort])

  useEffect(() => {
    if (selected) statementRef.current?.scrollIntoView?.({ block: 'start' })
  }, [selected])

  function choose(productId: string, label: string) {
    if (!productId) {
      setSelected('')
      setSelectedLabel('')
      setError('')
      return
    }
    try {
      setSelected(id(productId))
      setSelectedLabel(label)
      setError('')
    } catch (failure) {
      setError(message(failure))
    }
  }

  function onSort(field: string, firstDirection?: 'asc' | 'desc') {
    // Server order over the contract fields; clearing returns to name order.
    setLoading(true)
    setOverviewError('')
    setSort(nextSort(sort, field, firstDirection) || OVERVIEW_DEFAULT_SORT)
  }

  if (!canRead)
    return (
      <div className="space-y-6">
        <Alert type="error">Bạn không có quyền xem tồn kho.</Alert>
      </div>
    )

  const lowCount = rows.filter((row) => row.low).length
  const total = totalStockValue(rows)
  const term = search.trim().toLocaleLowerCase('vi')
  const visible = rows.filter(
    (row) =>
      (stockFilter !== 'low' || row.low) &&
      (!term ||
        row.code.toLocaleLowerCase('vi').includes(term) ||
        row.name.toLocaleLowerCase('vi').includes(term)),
  )
  const ready = !loading && !overviewError
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kho hàng"
        title="Tồn kho & Thẻ kho"
        description="Tồn hiện tại và thẻ kho từng mặt hàng."
        className="mb-0"
      />

      <section
        aria-label="Chỉ số tồn kho"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {loading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          ready && (
            <>
              <KpiCard
                label="Mặt hàng đang theo dõi"
                value={<CountUp value={rows.length} />}
                icon={<Boxes />}
                hint={
                  hasMore ? 'Tính trên 100 mặt hàng đầu' : 'Toàn bộ danh mục'
                }
              />
              <KpiCard
                label="Sắp hết hàng"
                value={<CountUp value={lowCount} />}
                icon={<TriangleAlert />}
                hint={
                  lowCount
                    ? stockFilter === 'low'
                      ? 'Đang lọc · bấm để bỏ'
                      : 'Bấm để lọc'
                    : 'Không có'
                }
                active={stockFilter === 'low'}
                onClick={() =>
                  setStockFilter((value) => (value === 'low' ? '' : 'low'))
                }
              />
              <KpiCard
                label="Giá trị tồn kho"
                value={
                  total === null ? (
                    '—'
                  ) : (
                    <CountUp
                      value={toNumber(total.toString())}
                      format={(value) => formatCompactVND(value)}
                    />
                  )
                }
                exactValue={
                  total === null ? undefined : formatVND(total.toString())
                }
                icon={<Wallet />}
                hint={
                  total === null
                    ? 'Chưa có giá nhập để tính'
                    : 'Theo giá nhập hiện hành'
                }
              />
            </>
          )
        )}
      </section>

      {ready && rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <StockValueChart rows={rows} />
          <div className="grid content-start gap-4">
            <StockHealthCard rows={rows} partial={hasMore} />
            <LowStockCard
              rows={rows}
              onSelect={(row) => choose(row.id, `${row.code} — ${row.name}`)}
            />
          </div>
        </div>
      )}

      <Card
        className="gap-0 overflow-hidden py-0 shadow-xs"
        aria-label="Tồn kho hiện tại"
        role="region"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground">
              Tồn kho hiện tại
            </h2>
            {ready && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {rows.length} mặt hàng
                {lowCount > 0 && ` · ${lowCount} sắp hết`}
              </p>
            )}
          </div>
          {ready && rows.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Input
                  aria-label="Lọc theo mã hoặc tên"
                  placeholder="Lọc theo mã hoặc tên…"
                  className="h-8 pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Search
                  className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <SegmentedFilter
                label="Lọc tình trạng tồn"
                value={stockFilter}
                options={[
                  { value: '', label: 'Tất cả' },
                  { value: 'low', label: 'Sắp hết' },
                ]}
                onChange={setStockFilter}
              />
            </div>
          )}
        </div>
        {loading && <TableSkeleton columns={6} label="Đang tải tồn kho..." />}
        {overviewError && (
          <div className="p-4">
            <Alert type="error">
              <span className="flex flex-wrap items-center gap-3">
                Không tải được tồn kho. {overviewError}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLoading(true)
                    setOverviewError('')
                    setAttempt((value) => value + 1)
                  }}
                >
                  Thử lại
                </Button>
              </span>
            </Alert>
          </div>
        )}
        {ready && (
          <>
            {visible.length > 0 && (
              <div className="max-h-[480px] overflow-auto">
                <Table
                  caption="Tồn kho theo mặt hàng"
                  className="min-w-[760px] [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10"
                >
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <SortableHeader field="name" sort={sort} onSort={onSort}>
                        Tên mặt hàng
                      </SortableHeader>
                      <th>Đơn vị</th>
                      <SortableHeader
                        field="currentStock"
                        sort={sort}
                        onSort={onSort}
                        align="right"
                      >
                        Tồn hiện tại
                      </SortableHeader>
                      <th>Mức tồn</th>
                      <th className="cell-number">Giá trị tồn</th>
                      <th>Tình trạng</th>
                      <th className="cell-actions">
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const level = stockLevel(row)
                      const isSelected = row.id === selected
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            'inventory-row cursor-pointer',
                            isSelected &&
                              'is-selected bg-primary/8 hover:bg-primary/10',
                          )}
                          onClick={() =>
                            choose(row.id, `${row.code} — ${row.name}`)
                          }
                        >
                          <td className="font-semibold whitespace-nowrap text-foreground">
                            {row.code}
                          </td>
                          <td className="font-medium text-foreground">
                            {row.name}
                          </td>
                          <td className="text-muted-foreground">
                            {row.unitName || '—'}
                          </td>
                          <td className="cell-number font-medium">
                            {formatQuantity(row.currentStock)}
                          </td>
                          <td className="w-32">
                            {level === null ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <Progress
                                value={level}
                                // The shared Progress does not forward `value` to Radix.
                                aria-valuenow={level}
                                aria-valuetext={`${formatQuantity(row.currentStock)} trên ngưỡng ${row.threshold ? formatQuantity(row.threshold) : '—'}`}
                                aria-label={`Mức tồn ${row.code}`}
                                title={
                                  row.threshold
                                    ? `Ngưỡng cảnh báo: ${formatQuantity(row.threshold)}`
                                    : undefined
                                }
                                className={cn(
                                  'h-1.5',
                                  row.low
                                    ? 'bg-warning/15 [&>[data-slot=progress-indicator]]:bg-warning'
                                    : 'bg-success/15 [&>[data-slot=progress-indicator]]:bg-success',
                                )}
                              />
                            )}
                          </td>
                          <td className="cell-number">
                            {row.stockValue === null
                              ? '—'
                              : formatVND(row.stockValue.toString())}
                          </td>
                          <td>
                            {row.low ? (
                              <Badge variant="warning">Sắp hết</Badge>
                            ) : (
                              <Badge variant="success">Đủ hàng</Badge>
                            )}
                          </td>
                          <td className="cell-actions">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Xem thẻ kho ${row.code}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                choose(row.id, `${row.code} — ${row.name}`)
                              }}
                            >
                              Thẻ kho
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
            )}
            {!rows.length && (
              <div className="p-4">
                <EmptyState
                  icon={<PackageSearch className="size-6" />}
                  title="Chưa có mặt hàng."
                />
              </div>
            )}
            {rows.length > 0 && !visible.length && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Không có mặt hàng khớp bộ lọc.
              </p>
            )}
            {hasMore && (
              <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                Chỉ 100 mặt hàng đầu tiên theo thứ tự đang chọn · tra cứu thẻ
                kho bên dưới cho mặt hàng khác.
              </p>
            )}
          </>
        )}
      </Card>

      <SectionCard
        as="h2"
        title="Tra cứu thẻ kho"
        description="Nhập – xuất – tồn theo thời gian."
      >
        <div className="max-w-md">
          <EntityPicker
            resource="products"
            label="Mặt hàng"
            value={selected}
            onChange={(productId, item) => choose(productId, item?.label ?? '')}
          />
        </div>
        {error && (
          <div className="mt-3">
            <Alert type="error">{error}</Alert>
          </div>
        )}
      </SectionCard>
      {selected && (
        <div ref={statementRef} className="scroll-mt-20">
          <SourceStatement
            key={selected}
            path={`/products/${selected}/inventory-entries`}
            title={`Thẻ kho: ${selectedLabel || `#${selected}`}`}
            opening="openingStock"
            closing="closingStock"
          />
        </div>
      )}
    </div>
  )
}
