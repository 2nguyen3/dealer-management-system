import { BookOpenText, Landmark, PiggyBank, Wallet } from 'lucide-react'
import { useState } from 'react'
import { ChartCard } from '@/components/blocks/ChartCard'
import { KpiCard } from '@/components/blocks/KpiCard'
import { PageHeader } from '@/components/blocks/PageHeader'
import {
  DonutChart,
  LegendList,
  RoundedBarChart,
} from '@/components/charts/MebiusCharts'
import { SortableHeader } from '@/components/data/SortControls'
import { nextSort, useSort } from '@/components/data/sorting'
import { Stagger, StaggerItem } from '@/components/motion/Motion'
import { Progress } from '@/components/shadcn/progress'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table } from '@/components/ui/Table'
import { formatCompactVND, formatPercent, toNumber } from '@/lib/chart'
import { formatDate, formatVND } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  businessDate,
  decimal,
  id,
  record,
  text,
  vietnamDate,
  type Row,
} from '../payment_receipts/contracts'
import {
  FilterBar,
  SectionCard,
  TableCard,
  TableSkeleton,
} from '../payment_receipts/financeUi'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { Balance } from './Balance'
import { SourceStatement } from './SourceStatement'
import { agingBuckets, limitUsage, usageBuckets } from './statementModel'

/** Server sort enum for GET /receivables (default -currentDebt). */
const DEFAULT_SORT = '-currentDebt'
/** Server sort enum for GET /agencies/{id}/invoice-balances. */
const INVOICE_SORT = 'businessDate'
const USAGE_COLORS: Record<string, string> = {
  low: 'var(--success)',
  mid: 'var(--chart-1)',
  high: 'var(--warning)',
  over: 'var(--destructive)',
  none: 'var(--chart-4)',
}

/** Progress indicator colour by limit usage (text keeps the exact percent). */
function usageTone(usage: number): string {
  return usage >= 1
    ? '[&_[data-slot=progress-indicator]]:bg-destructive'
    : usage >= 0.8
      ? '[&_[data-slot=progress-indicator]]:bg-warning'
      : '[&_[data-slot=progress-indicator]]:bg-primary'
}

const totalLabels: Record<string, string> = {
  currentDebt: 'Dư nợ',
  currentCredit: 'Dư có',
  reservedCredit: 'Dư có giữ chỗ',
  availableCredit: 'Dư có khả dụng',
}
const totalIcons: Record<string, typeof Wallet> = {
  currentDebt: Wallet,
  currentCredit: Landmark,
  reservedCredit: PiggyBank,
  availableCredit: PiggyBank,
}

function overview(value: unknown): Row {
  const data = record(value)
  id(data.agencyId)
  text(data.agencyCode)
  text(data.agencyName)
  decimal(data.currentDebt)
  decimal(data.remainingCreditLimit)
  return data
}
function invoice(value: unknown): Row {
  const data = record(value)
  id(data.issueDocumentId)
  text(data.code)
  businessDate(data.businessDate)
  decimal(data.totalAmount)
  decimal(data.outstandingAmount)
  return data
}

function Aging({ items }: { items: Row[] }) {
  const buckets = agingBuckets(
    items.map((item) => ({
      businessDate: String(item.businessDate),
      outstanding: String(item.outstandingAmount),
    })),
    vietnamDate(),
  )
  const total = buckets.reduce((sum, bucket) => sum + bucket.amount, 0)
  if (total <= 0) return null
  return (
    <div className="mb-4 space-y-2" aria-label="Tuổi nợ hóa đơn">
      <p className="text-xs text-muted-foreground">
        Tuổi nợ (tính trên {items.length} hóa đơn đang hiển thị)
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map((bucket, index) => (
          <li
            key={bucket.key}
            className="rounded-lg border bg-muted/30 px-3 py-2"
          >
            <p className="text-xs text-muted-foreground">{bucket.label}</p>
            <p className="font-semibold tabular-nums">
              {formatCompactVND(bucket.amount)}
            </p>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(bucket.amount / total) * 100}%`,
                  background: 'var(--chart-1)',
                  opacity: 0.45 + index * 0.18,
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {bucket.count} hóa đơn · {formatPercent(bucket.amount / total)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Invoices({ agencyId }: { agencyId: string }) {
  const sorter = useSort(INVOICE_SORT)
  const onSort = (field: string, first?: 'asc' | 'desc') =>
    sorter.setSort(nextSort(sorter.sort, field, first) || INVOICE_SORT)
  const list = useSourcePage(
    `/agencies/${agencyId}/invoice-balances`,
    { sort: sorter.sort },
    invoice,
  )
  return (
    <SectionCard
      title="Số dư hóa đơn"
      description="Phiếu xuất còn nợ. Bấm tiêu đề cột để sắp xếp."
    >
      {list.error && <Alert type="error">{list.error}</Alert>}
      {!list.loading && !list.error && <Aging items={list.items} />}
      <div className="overflow-hidden rounded-lg border">
        {list.loading ? (
          <TableSkeleton rows={3} label="Đang tải hóa đơn..." />
        ) : !list.error && !list.items.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            Không có hóa đơn còn số dư.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Số dư hóa đơn">
              <thead>
                <tr>
                  <th scope="col">Phiếu xuất</th>
                  <SortableHeader
                    field="businessDate"
                    sort={sorter.sort}
                    onSort={onSort}
                  >
                    Ngày
                  </SortableHeader>
                  <th scope="col" className="cell-number">
                    Tổng tiền
                  </th>
                  <SortableHeader
                    field="outstandingAmount"
                    sort={sorter.sort}
                    onSort={onSort}
                    align="right"
                    firstDirection="desc"
                  >
                    Còn nợ
                  </SortableHeader>
                  <th scope="col">Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={String(item.issueDocumentId)}>
                    <td className="font-medium">{String(item.code)}</td>
                    <td className="tabular-nums">
                      {formatDate(String(item.businessDate))}
                    </td>
                    <td className="cell-number">
                      {formatVND(String(item.totalAmount))}
                    </td>
                    <td className="cell-number font-medium">
                      {formatVND(String(item.outstandingAmount))}
                    </td>
                    <td>
                      <StatusBadge status={String(item.settlementStatus)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        <Pagination
          hasNext={list.hasMore}
          hasPrevious={list.hasPrevious}
          onNext={list.next}
          onPrevious={list.previous}
          isLoading={list.loading}
        />
      </div>
    </SectionCard>
  )
}

export function ReceivablesPage() {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [statement, setStatement] = useState(false)
  const sorter = useSort(DEFAULT_SORT)
  const onSort = (field: string, first?: 'asc' | 'desc') =>
    sorter.setSort(nextSort(sorter.sort, field, first) || DEFAULT_SORT)
  const list = useSourcePage('/receivables', { q, sort: sorter.sort }, overview)
  const totals =
    list.metadata?.totals !== undefined
      ? Object.entries(record(list.metadata.totals))
      : []
  const bars = list.items.slice(0, 12).map((item) => ({
    code: String(item.agencyCode),
    debt: toNumber(String(item.currentDebt)),
    remaining: toNumber(String(item.remainingCreditLimit)),
  }))
  const buckets = usageBuckets(
    list.items.map((item) => ({
      currentDebt: item.currentDebt,
      maxDebt: item.maxDebt,
    })),
  )
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({ ...bucket, color: USAGE_COLORS[bucket.key]! }))
  return (
    <div className="page-container space-y-6">
      <PageHeader
        eyebrow="Tài chính"
        title="Công nợ đại lý"
        description="Dư nợ, hạn mức còn lại, tuổi nợ và sổ công nợ theo đại lý."
        className="mb-0"
      />
      <FilterBar>
        <Input
          label="Tìm theo mã hoặc tên đại lý"
          placeholder="VD: DL-101, Minh Phát…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </FilterBar>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {totals.length > 0 && (
        <section aria-label="Tổng theo bộ lọc" className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Tổng theo bộ lọc
          </h2>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {totals.map(([key, value]) => {
              const raw = decimal(value)
              const Icon = totalIcons[key] ?? Wallet
              return (
                <StaggerItem key={key}>
                  <KpiCard
                    label={totalLabels[key] ?? key}
                    icon={<Icon />}
                    value={formatCompactVND(toNumber(raw))}
                    exactValue={formatVND(raw)}
                    className="h-full"
                  />
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>
      )}
      {!list.loading && list.items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ChartCard
            title="Dư nợ và hạn mức còn lại"
            description={`Trang hiện tại · ${bars.length} đại lý đầu theo thứ tự đang sắp xếp`}
            table={
              <Table caption="Bảng dư nợ và hạn mức còn lại">
                <thead>
                  <tr>
                    <th scope="col">Đại lý</th>
                    <th scope="col" className="cell-number">
                      Dư nợ
                    </th>
                    <th scope="col" className="cell-number">
                      Còn lại
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bars.map((bar) => (
                    <tr key={bar.code}>
                      <td>{bar.code}</td>
                      <td className="cell-number">
                        {formatCompactVND(bar.debt)}
                      </td>
                      <td className="cell-number">
                        {formatCompactVND(bar.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
          >
            <RoundedBarChart
              data={bars}
              xKey="code"
              stacked
              height={220}
              series={[
                { key: 'debt', label: 'Dư nợ', color: 'var(--chart-1)' },
                {
                  key: 'remaining',
                  label: 'Hạn mức còn lại',
                  color: 'var(--chart-2)',
                },
              ]}
            />
          </ChartCard>
          <ChartCard
            title="Mức dùng hạn mức"
            description={`Trang hiện tại · ${list.items.length} đại lý`}
          >
            <div className="flex items-center gap-3">
              <DonutChart
                data={buckets.map((bucket) => ({
                  key: bucket.key,
                  label: bucket.label,
                  value: bucket.count,
                  color: bucket.color,
                }))}
                centerValue={String(list.items.length)}
                centerLabel="đại lý"
                valueFormatter={(value) => String(Math.round(value))}
                height={150}
                className="max-w-36 shrink-0"
              />
              <LegendList
                className="min-w-0 flex-1 gap-1.5 text-xs"
                items={buckets.map((bucket) => ({
                  key: bucket.key,
                  label: bucket.label,
                  value: bucket.count,
                  color: bucket.color,
                }))}
              />
            </div>
          </ChartCard>
        </div>
      )}
      <TableCard
        title="Công nợ theo đại lý"
        description="Bấm tiêu đề cột để sắp xếp; “Chi tiết” để xem số dư và sổ."
      >
        {list.loading ? (
          <TableSkeleton label="Đang tải công nợ..." />
        ) : !list.error && list.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Không tìm thấy đại lý nào phù hợp với điều kiện tìm kiếm."
              description="Thử tìm theo mã hoặc một phần tên đại lý."
            />
          </div>
        ) : (
          <Table caption="Công nợ đại lý">
            <thead>
              <tr>
                <SortableHeader
                  field="agencyId"
                  sort={sorter.sort}
                  onSort={onSort}
                >
                  Mã đại lý
                </SortableHeader>
                <th scope="col">Tên đại lý</th>
                <SortableHeader
                  field="currentDebt"
                  sort={sorter.sort}
                  onSort={onSort}
                  align="right"
                  firstDirection="desc"
                >
                  Dư nợ
                </SortableHeader>
                <SortableHeader
                  field="remainingCreditLimit"
                  sort={sorter.sort}
                  onSort={onSort}
                  align="right"
                  firstDirection="desc"
                >
                  Hạn mức còn lại
                </SortableHeader>
                <th scope="col" className="min-w-36">
                  Sử dụng hạn mức
                </th>
                <th scope="col" className="cell-actions">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => {
                const usage = limitUsage(item.currentDebt, item.maxDebt)
                const open = () => {
                  setSelected(String(item.agencyId))
                  setSelectedName(
                    `${String(item.agencyCode)} — ${String(item.agencyName)}`,
                  )
                  setStatement(false)
                }
                return (
                  <tr key={String(item.agencyId)}>
                    <td className="font-medium">{String(item.agencyCode)}</td>
                    <td>{String(item.agencyName)}</td>
                    <td className="cell-number font-medium">
                      {formatVND(String(item.currentDebt))}
                    </td>
                    <td className="cell-number">
                      {formatVND(String(item.remainingCreditLimit))}
                    </td>
                    <td>
                      {usage === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(100, usage * 100)}
                            className={cn('h-1.5 w-20', usageTone(usage))}
                            aria-label={`Sử dụng hạn mức ${String(item.agencyCode)}`}
                          />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatPercent(usage)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="cell-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Chi tiết công nợ ${String(item.agencyCode)}`}
                        onClick={open}
                      >
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
        <Pagination
          hasNext={list.hasMore}
          hasPrevious={list.hasPrevious}
          onNext={list.next}
          onPrevious={list.previous}
          isLoading={list.loading}
          totalShowing={list.loading ? undefined : list.items.length}
        />
      </TableCard>
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected('')}
        title={`Chi tiết công nợ ${selectedName || `#${selected}`}`}
        maxWidth="xl"
      >
        {selected && (
          <div className="space-y-4">
            <Balance key={`balance-${selected}`} agencyId={selected} />
            <Invoices key={selected} agencyId={selected} />
            {!statement && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  icon={<BookOpenText className="size-4" />}
                  onClick={() => setStatement(true)}
                >
                  Mở sổ công nợ
                </Button>
              </div>
            )}
            {statement && (
              <SourceStatement
                key={`statement-${selected}`}
                path={`/agencies/${selected}/receivable-entries`}
                title="Sổ công nợ"
                opening="openingDebt"
                closing="closingDebt"
                chart
                chartTitle="Diễn biến dư nợ"
                increaseLabel="Tăng nợ"
                decreaseLabel="Giảm nợ"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
