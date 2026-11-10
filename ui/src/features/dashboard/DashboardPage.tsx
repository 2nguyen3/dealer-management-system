import {
  BadgeCheck,
  Banknote,
  ClipboardList,
  Landmark,
  PackageX,
  RotateCw,
  Store,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { KpiCard } from '../../components/blocks/KpiCard'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Card } from '../../components/shadcn/card'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  formatCompactVND,
  formatPercent,
  formatPlain,
  toNumber,
} from '../../lib/chart'
import { formatDateTime, formatQuantity, formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import {
  reports,
  month as validMonth,
  vietnamMonth,
  type ReportKind,
  type ReportRow,
} from '../reports/contracts'
import { AgencyMatrix } from './AgencyMatrix'
import {
  RankedBarChart,
  SalesTrendChart,
  SegmentedBar,
  type BarDatum,
  type TrendDatum,
} from './charts'
import { dashboardAdmission, sectionGrants } from './contracts'
import {
  agencyLabel,
  buildMatrix,
  buildReportQuery,
  emptyFilters,
  filterNames,
  monthChoices,
  monthLabel,
  productLabel,
  shortMonthLabel,
  trendDelta,
  visualFilters,
  type FilterKey,
  type FilterValue,
  type Filters,
} from './model'
import { Slicers } from './Slicers'
import { useReport, useSnapshot } from './useReport'
import { MiniTable, VisualCard } from './VisualCard'

type Section = keyof typeof sectionGrants

const sectionLabels: Record<Section, string> = {
  agencies: 'Đại lý',
  inventory: 'Tồn kho',
  sales: 'Doanh số',
  receivables: 'Công nợ và tiền',
  pendingIssueCount: 'Phiếu xuất đang chờ',
  verifiedUnreceiptedAmount: 'Tiền đã xác minh chưa ghi phiếu thu',
}

const VS_PREVIOUS = 'so với tháng trước'
const TOP = 10

function money(value: string) {
  return {
    value: formatCompactVND(toNumber(value)),
    exactValue: formatVND(value),
  }
}

/** KPI delta props; without a comparable previous month show a plain hint. */
function delta(ratio: number | null, upIsGood: boolean) {
  return ratio === null
    ? { hint: 'Chưa đủ dữ liệu tháng trước để so sánh' }
    : { delta: { ratio, upIsGood, label: VS_PREVIOUS } }
}

function filterNote(kind: ReportKind, filters: Filters): string | null {
  const keys = visualFilters(kind)
  const applied = (Object.keys(filterNames) as FilterKey[]).filter(
    (key) => filters[key] && keys.includes(key),
  )
  const ignored = (Object.keys(filterNames) as FilterKey[]).filter(
    (key) => filters[key] && !keys.includes(key),
  )
  if (!applied.length && !ignored.length) return null
  return [
    applied.length
      ? `Theo bộ lọc: ${applied.map((key) => filterNames[key]).join(', ')}`
      : '',
    ignored.length
      ? `Không áp dụng: ${ignored.map((key) => filterNames[key]).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function DashboardPage() {
  const { user, allowedFunctions } = useAuth()
  const grantKey = [...allowedFunctions].sort().join(',')
  const grants = new Set<string>(allowedFunctions)
  const admitted =
    !!user && dashboardAdmission.some((grant) => grants.has(grant))
  const [months] = useState(() => monthChoices(vietnamMonth()))
  const [selectedMonth, setSelectedMonth] = useState(
    () => months[0]?.value ?? vietnamMonth(),
  )
  const [monthError, setMonthError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [reload, setReload] = useState(0)
  const scope = JSON.stringify([user?.id, grantKey, reload])

  const can = (section: Section) =>
    sectionGrants[section].some((grant) => grants.has(grant))
  const reportAllowed = (kind: ReportKind) =>
    admitted &&
    grants.has('reports.read') &&
    grants.has(reports[kind].permission)
  const query = (kind: ReportKind) =>
    reportAllowed(kind) ? buildReportQuery(kind, selectedMonth, filters) : null

  const snapshot = useSnapshot(selectedMonth, admitted, scope)
  const salesReport = useReport(query('sales'), scope)
  const debtReport = useReport(query('debt'), scope)
  const productReport = useReport(query('product-sales'), scope)
  const cashReport = useReport(query('cash-and-credit'), scope)
  const inventoryReport = useReport(query('inventory'), scope)
  const productId = filters.productId?.id
  const productFocus = useReport(
    productId && reportAllowed('product-sales')
      ? buildReportQuery(
          'product-sales',
          selectedMonth,
          filters,
          { productId },
          '1',
        )
      : null,
    scope,
  )
  const stockFocus = useReport(
    productId && reportAllowed('inventory')
      ? buildReportQuery(
          'inventory',
          selectedMonth,
          filters,
          { productId },
          '1',
        )
      : null,
    scope,
  )

  const data = snapshot.data
  const agencies = can('agencies') ? data?.agencies : undefined
  const inventory = can('inventory') ? data?.inventory : undefined
  const sales = can('sales') ? data?.sales : undefined
  const receivables = can('receivables') ? data?.receivables : undefined
  const pendingIssues = can('pendingIssueCount')
    ? data?.pendingIssueCount
    : undefined
  const verifiedUnreceipted = can('verifiedUnreceiptedAmount')
    ? data?.verifiedUnreceiptedAmount
    : undefined
  const missing = data
    ? (Object.keys(sectionGrants) as Section[]).filter(
        (section) => can(section) && !(section in data),
      )
    : []
  const periodLabel = `Tháng ${monthLabel(selectedMonth)}`
  const selectedAgency = filters.agencyId?.id ?? null
  const selectedProduct = filters.productId?.id ?? null

  const anyAgencyReport = (
    ['sales', 'debt', 'product-sales', 'cash-and-credit'] as ReportKind[]
  ).some(reportAllowed)
  const slicers = {
    agencyId:
      anyAgencyReport &&
      (grants.has('agency.read') || grants.has('agency.manage')),
    typeId:
      (reportAllowed('sales') || reportAllowed('debt')) &&
      ['agency_type.manage', 'agency.read', 'agency.manage'].some((g) =>
        grants.has(g),
      ),
    districtId:
      reportAllowed('debt') &&
      ['district.manage', 'agency.read', 'agency.manage'].some((g) =>
        grants.has(g),
      ),
    productId:
      (reportAllowed('product-sales') || reportAllowed('inventory')) &&
      (grants.has('product.manage') || grants.has('inventory.read')),
  }

  function setFilter(key: FilterKey, value: FilterValue | null) {
    setFilters((current) => ({ ...current, [key]: value }))
  }
  function toggle(key: 'agencyId' | 'productId', value: FilterValue) {
    setFilters((current) => ({
      ...current,
      [key]: current[key]?.id === value.id ? null : value,
    }))
  }
  function changeMonth(value: string) {
    if (!validMonth(value)) {
      setMonthError('Chọn tháng hợp lệ.')
      return
    }
    setMonthError(null)
    setSelectedMonth(value)
  }

  // ---------------------------------------------------------------- KPIs
  const trend = sales?.monthlyTrend ?? []
  const kpis: ReactNode[] = []
  if (sales) {
    kpis.push(
      <KpiCard
        key="net"
        label="Doanh số thuần"
        {...money(sales.net)}
        icon={<TrendingUp />}
        {...delta(trendDelta(trend, selectedMonth, 'net'), true)}
        trend={trend.map((point) => toNumber(point.net))}
      />,
      <KpiCard
        key="returns"
        label="Hàng trả lại"
        {...money(sales.returns)}
        icon={<Undo2 />}
        {...delta(trendDelta(trend, selectedMonth, 'returns'), false)}
        trend={trend.map((point) => toNumber(point.returns))}
        trendColor="var(--chart-3)"
      />,
    )
  }
  if (receivables) {
    kpis.push(
      <KpiCard
        key="debt"
        label="Công nợ hiện tại"
        {...money(receivables.currentDebt)}
        icon={<Landmark />}
        hint={`Dư có hiện tại ${formatVND(receivables.currentCredit)}`}
      />,
      <KpiCard
        key="cash"
        label="Tiền thực thu"
        {...money(receivables.cashReceived)}
        icon={<Banknote />}
        hint={`Đã hoàn ${formatVND(receivables.cashRefunded)} trong tháng`}
      />,
    )
  }
  if (agencies) {
    kpis.push(
      <KpiCard
        key="agencies"
        label="Đại lý hoạt động"
        value={`${formatQuantity(agencies.active)} / ${formatQuantity(agencies.total)}`}
        icon={<Store />}
        hint={
          agencies.total
            ? `${formatPercent(agencies.active / agencies.total)} tổng số đại lý`
            : 'Chưa có đại lý'
        }
      />,
    )
  }
  if (inventory) {
    kpis.push(
      <KpiCard
        key="low-stock"
        label="Mặt hàng tồn thấp"
        value={formatQuantity(inventory.lowStockProductCount)}
        icon={<PackageX />}
        hint={`Trên ${formatQuantity(inventory.productCount)} mặt hàng · nhập ${formatCompactVND(toNumber(inventory.receivedAmount))}`}
      />,
    )
  }
  if (pendingIssues !== undefined) {
    kpis.push(
      <KpiCard
        key="pending"
        label="Phiếu xuất đang chờ"
        value={formatQuantity(pendingIssues)}
        icon={<ClipboardList />}
        hint="Phiếu chưa ghi sổ"
      />,
    )
  }
  if (verifiedUnreceipted !== undefined) {
    kpis.push(
      <KpiCard
        key="verified"
        label="Đã xác minh, chưa ghi phiếu thu"
        {...money(verifiedUnreceipted)}
        icon={<BadgeCheck />}
        hint="Chưa tính vào thực thu"
      />,
    )
  }
  const expectedKpis =
    (can('sales') ? 2 : 0) +
    (can('receivables') ? 2 : 0) +
    (can('agencies') ? 1 : 0) +
    (can('inventory') ? 1 : 0) +
    (can('pendingIssueCount') ? 1 : 0) +
    (can('verifiedUnreceiptedAmount') ? 1 : 0)

  // ---------------------------------------------------------------- visuals
  const trendData: TrendDatum[] = trend.map((point) => ({
    month: point.month,
    label: shortMonthLabel(point.month),
    net: toNumber(point.net),
    gross: toNumber(point.gross),
    returns: toNumber(point.returns),
    display: {
      net: formatVND(point.net),
      gross: formatVND(point.gross),
      returns: formatVND(point.returns),
    },
  }))

  const productSource = reportAllowed('product-sales')
    ? {
        ...productReport,
        rows: productReport.page?.items ?? [],
        note: filterNote('product-sales', filters),
      }
    : sales || (can('sales') && (snapshot.loading || snapshot.error))
      ? {
          loading: snapshot.loading,
          error: snapshot.error,
          retry: () => setReload((n) => n + 1),
          rows: sales?.topProducts ?? [],
          note: 'Toàn công ty',
        }
      : null
  const productBars: BarDatum[] = (productSource?.rows ?? [])
    .slice(0, TOP)
    .map((row) => ({
      id: String(row.productId),
      label: String(row.productName),
      value: toNumber(row.salesAmount),
      display: formatVND(String(row.salesAmount)),
      detail: `${String(row.productCode)} · bán ${formatQuantity(String(row.soldQuantity))} ${String(row.unitName)}`,
    }))
  const pickProduct = (row: ReportRow) =>
    toggle('productId', { id: String(row.productId), label: productLabel(row) })

  const debtFromReport = reportAllowed('debt')
  const debtSource = debtFromReport
    ? {
        ...debtReport,
        rows: (debtReport.page?.items ?? []).filter(
          (row) => toNumber(row.closingDebt) > 0,
        ),
        amountKey: 'closingDebt',
        note: filterNote('debt', filters),
      }
    : receivables ||
        (can('receivables') && (snapshot.loading || snapshot.error))
      ? {
          loading: snapshot.loading,
          error: snapshot.error,
          retry: () => setReload((n) => n + 1),
          rows: (receivables?.topAgencies ?? []) as unknown as ReportRow[],
          amountKey: 'currentDebt',
          note: 'Dư nợ hiện tại, toàn công ty',
        }
      : null
  const debtBars: BarDatum[] = (debtSource?.rows ?? [])
    .slice(0, TOP)
    .map((row) => ({
      id: String(row.agencyId),
      label: String(row.agencyName),
      value: toNumber(row[debtSource!.amountKey]),
      display: formatVND(String(row[debtSource!.amountKey])),
      detail: String(row.agencyCode),
    }))
  const pickAgency = (row: { readonly [key: string]: unknown }) =>
    toggle('agencyId', { id: String(row.agencyId), label: agencyLabel(row) })
  const pickAgencyBar = (rows: ReportRow[], datum: BarDatum) => {
    const row = rows.find((item) => String(item.agencyId) === datum.id)
    if (row) pickAgency(row)
  }

  const salesRows = salesReport.page?.items ?? []
  const salesBars: BarDatum[] = salesRows.slice(0, TOP).map((row) => ({
    id: String(row.agencyId),
    label: String(row.agencyName),
    value: toNumber(row.netSalesAmount),
    display: formatVND(String(row.netSalesAmount)),
    detail: `${String(row.agencyCode)} · ${formatQuantity(String(row.numberOfIssues))} phiếu xuất`,
  }))

  const cashTotals = cashReport.page?.totals
  const cashSource = reportAllowed('cash-and-credit')
    ? {
        ...cashReport,
        items: cashTotals
          ? (
              [
                ['cashReceived', 'Tiền thực thu'],
                ['cashRefunded', 'Tiền thực hoàn'],
                ['creditCreated', 'Dư có phát sinh'],
                ['creditApplied', 'Dư có đã cấn trừ'],
                ['creditRefunded', 'Dư có đã hoàn'],
              ] as const
            ).map(([key, label]) => ({
              key,
              label,
              value: String(cashTotals[key]),
            }))
          : [],
        note: filterNote('cash-and-credit', filters),
      }
    : receivables ||
        (can('receivables') && (snapshot.loading || snapshot.error))
      ? {
          loading: snapshot.loading,
          error: snapshot.error,
          retry: () => setReload((n) => n + 1),
          items: receivables
            ? [
                {
                  key: 'cashReceived',
                  label: 'Tiền thực thu',
                  value: receivables.cashReceived,
                },
                {
                  key: 'cashRefunded',
                  label: 'Tiền thực hoàn',
                  value: receivables.cashRefunded,
                },
              ]
            : [],
          note: 'Toàn công ty',
        }
      : null
  const cashBars: BarDatum[] = (cashSource?.items ?? []).map((item) => ({
    id: item.key,
    label: item.label,
    value: toNumber(item.value),
    display: formatVND(item.value),
  }))

  const stockRows = inventoryReport.page?.items ?? []
  const stockBars: BarDatum[] = stockRows.map((row) => ({
    id: String(row.productId),
    label: String(row.productName),
    value: toNumber(row.closingStock),
    display: `${formatQuantity(String(row.closingStock))} ${String(row.unitName)}`,
    detail: String(row.productCode),
  }))
  const showInventory =
    !!inventory ||
    reportAllowed('inventory') ||
    (can('inventory') && (snapshot.loading || !!snapshot.error))

  const matrixSources = {
    sales: reportAllowed('sales'),
    debt: reportAllowed('debt'),
  }
  const matrixRows = buildMatrix(salesReport.page, debtReport.page)
  const matrixLoading =
    (matrixSources.sales && salesReport.loading) ||
    (matrixSources.debt && debtReport.loading)
  const matrixError =
    [
      matrixSources.sales ? salesReport.error : null,
      matrixSources.debt ? debtReport.error : null,
    ]
      .filter(Boolean)
      .join(' · ') || null

  // ---------------------------------------------------------------- focus
  const focusAgencySales = selectedAgency
    ? salesRows.find((row) => String(row.agencyId) === selectedAgency)
    : undefined
  const focusAgencyDebt = selectedAgency
    ? debtReport.page?.items.find(
        (row) => String(row.agencyId) === selectedAgency,
      )
    : undefined
  const focusProductSales = productFocus.page?.items[0]
  const focusProductStock = stockFocus.page?.items[0]
  const focusItems: { label: string; value: string }[] = []
  if (selectedAgency) {
    if (focusAgencySales)
      focusItems.push(
        {
          label: 'Doanh số thuần của đại lý',
          value: formatVND(String(focusAgencySales.netSalesAmount)),
        },
        {
          label: 'Tỷ lệ doanh số',
          value: `${formatQuantity(String(focusAgencySales.salesRate))} %`,
        },
      )
    if (focusAgencyDebt)
      focusItems.push({
        label: 'Nợ cuối kỳ của đại lý',
        value: formatVND(String(focusAgencyDebt.closingDebt)),
      })
    if (cashTotals)
      focusItems.push({
        label: 'Thực thu từ đại lý',
        value: formatVND(String(cashTotals.cashReceived)),
      })
  }
  if (selectedProduct) {
    if (focusProductSales)
      focusItems.push(
        {
          label: 'Mặt hàng: số lượng bán',
          value: `${formatQuantity(String(focusProductSales.soldQuantity))} ${String(focusProductSales.unitName)}`,
        },
        {
          label: 'Mặt hàng: doanh số gộp',
          value: formatVND(String(focusProductSales.salesAmount)),
        },
      )
    if (focusProductStock)
      focusItems.push({
        label: 'Mặt hàng: tồn cuối kỳ',
        value: `${formatQuantity(String(focusProductStock.closingStock))} ${String(focusProductStock.unitName)}`,
      })
  }

  const refreshing =
    snapshot.loading ||
    [salesReport, debtReport, productReport, cashReport, inventoryReport].some(
      (state) => state.loading,
    )

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        eyebrow="Tổng quan điều hành"
        title="Bảng điều khiển"
        description="Doanh số, công nợ, dòng tiền và tồn kho theo tháng — nhấn vào một đại lý hoặc mặt hàng để lọc chéo các biểu đồ."
        actions={
          admitted && (
            <>
              <p
                role="status"
                className="text-xs text-muted-foreground tabular-nums"
              >
                {data ? (
                  <>
                    {periodLabel} · Cập nhật lúc{' '}
                    <time
                      dateTime={data.asOf}
                      className="font-medium text-foreground"
                    >
                      {formatDateTime(data.asOf)}
                    </time>
                  </>
                ) : snapshot.loading ? (
                  'Đang tải dữ liệu…'
                ) : (
                  periodLabel
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCw className="size-4" aria-hidden="true" />}
                isLoading={refreshing}
                onClick={() => setReload((n) => n + 1)}
              >
                Làm mới
              </Button>
            </>
          )
        }
      />
      {!admitted ? (
        <Alert type="info">
          Bạn không có quyền truy cập bảng điều khiển. Liên hệ quản trị viên nếu
          cần được cấp quyền.
        </Alert>
      ) : (
        <>
          <Slicers
            month={selectedMonth}
            months={months}
            onMonth={changeMonth}
            filters={filters}
            available={slicers}
            onFilter={setFilter}
            onReset={() => setFilters(emptyFilters)}
          />
          {monthError && <Alert type="error">{monthError}</Alert>}

          <section aria-label="Chỉ số chính" className="space-y-3">
            {snapshot.error ? (
              <Alert type="error" title="Không tải được chỉ số tổng quan">
                <span className="block">{snapshot.error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setReload((n) => n + 1)}
                >
                  Thử lại
                </Button>
              </Alert>
            ) : snapshot.loading ? (
              <div
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                aria-busy="true"
              >
                <span className="sr-only">Đang tải bảng điều khiển...</span>
                {Array.from({ length: Math.max(1, expectedKpis) }, (_, i) => (
                  <Card key={i} className="gap-3 p-4 shadow-xs">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-7 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {missing.length > 0 && (
                  <Alert type="info">
                    Chưa có dữ liệu cho:{' '}
                    {missing
                      .map((section) => sectionLabels[section])
                      .join(', ')}
                    .
                  </Alert>
                )}
                {kpis.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpis}
                  </div>
                )}
                {kpis.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Chỉ số tính cho toàn công ty. Công nợ, đại lý và tồn kho là
                    số liệu hiện tại; doanh số, nhập hàng và thu tiền tính theo
                    tháng đã chọn.
                  </p>
                )}
              </>
            )}
          </section>

          {focusItems.length > 0 && (
            <section
              aria-label="Đối tượng đang chọn"
              className="rounded-xl border border-primary/20 bg-primary/5 p-4"
            >
              <h2 className="text-sm font-semibold">
                Đang xem:{' '}
                {[filters.agencyId?.label, filters.productId?.label]
                  .filter(Boolean)
                  .join(' · ')}
              </h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                {focusItems.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {can('sales') && (
              <VisualCard
                className="md:col-span-12 xl:col-span-8"
                title="Xu hướng doanh số"
                description="Doanh số gộp, thuần và hàng trả lại — tối đa 12 tháng đến tháng đã chọn, toàn công ty"
                loading={snapshot.loading}
                error={snapshot.error}
                onRetry={() => setReload((n) => n + 1)}
                isEmpty={!trendData.length}
                empty={
                  <EmptyState
                    title="Chưa có dữ liệu xu hướng"
                    description="Không có doanh số trong 12 tháng gần nhất."
                  />
                }
                table={
                  <MiniTable
                    caption="Xu hướng doanh số"
                    headers={[
                      'Tháng',
                      'Doanh số gộp',
                      'Trả hàng',
                      'Doanh số thuần',
                    ]}
                    rows={trend.map((point) => ({
                      key: point.month,
                      label: monthLabel(point.month),
                      cells: [
                        formatVND(point.gross),
                        formatVND(point.returns),
                        formatVND(point.net),
                      ],
                    }))}
                  />
                }
              >
                <SalesTrendChart data={trendData} />
              </VisualCard>
            )}

            {productSource && (
              <VisualCard
                className="md:col-span-6 xl:col-span-4"
                title="Mặt hàng bán chạy"
                description={`Top ${TOP} theo doanh số gộp · ${periodLabel}${productSource.note ? ` · ${productSource.note}` : ''}`}
                loading={productSource.loading}
                error={productSource.error}
                onRetry={productSource.retry}
                isEmpty={!productBars.length}
                empty={
                  <EmptyState
                    title="Không có mặt hàng bán trong kỳ"
                    description="Thử chọn tháng khác hoặc bỏ bộ lọc."
                  />
                }
                table={
                  <MiniTable
                    caption="Top mặt hàng"
                    headers={[
                      'Mặt hàng',
                      'Đã bán',
                      'Doanh số gộp',
                      'Doanh số thuần',
                    ]}
                    rows={productSource.rows.slice(0, TOP).map((row) => ({
                      key: String(row.productId),
                      label: String(row.productName),
                      detail: String(row.productCode),
                      selected: String(row.productId) === selectedProduct,
                      onSelect: () => pickProduct(row),
                      selectLabel: `Lọc theo mặt hàng ${productLabel(row)}`,
                      cells: [
                        `${formatQuantity(String(row.soldQuantity))} ${String(row.unitName)}`,
                        formatVND(String(row.salesAmount)),
                        formatVND(String(row.netSalesAmount)),
                      ],
                    }))}
                  />
                }
              >
                <RankedBarChart
                  data={productBars}
                  seriesLabel="Doanh số gộp"
                  selectedId={selectedProduct}
                  onSelect={(datum) => {
                    const row = productSource.rows.find(
                      (item) => String(item.productId) === datum.id,
                    )
                    if (row) pickProduct(row)
                  }}
                />
              </VisualCard>
            )}

            {reportAllowed('sales') && (
              <VisualCard
                className="md:col-span-6 xl:col-span-4"
                title="Doanh số thuần theo đại lý"
                description={`Top ${TOP} · ${periodLabel}${filterNote('sales', filters) ? ` · ${filterNote('sales', filters)}` : ''}`}
                loading={salesReport.loading}
                error={salesReport.error}
                onRetry={salesReport.retry}
                isEmpty={!salesBars.length}
                empty={
                  <EmptyState
                    title="Chưa có doanh số đại lý"
                    description="Không có phiếu xuất trong kỳ đã chọn."
                  />
                }
                table={
                  <MiniTable
                    caption="Doanh số theo đại lý"
                    headers={['Đại lý', 'Số phiếu', 'Doanh số thuần', 'Tỷ lệ']}
                    rows={salesRows.slice(0, TOP).map((row) => ({
                      key: String(row.agencyId),
                      label: String(row.agencyName),
                      detail: String(row.agencyCode),
                      selected: String(row.agencyId) === selectedAgency,
                      onSelect: () => pickAgency(row),
                      selectLabel: `Lọc theo đại lý ${agencyLabel(row)}`,
                      cells: [
                        formatQuantity(String(row.numberOfIssues)),
                        formatVND(String(row.netSalesAmount)),
                        `${formatQuantity(String(row.salesRate))} %`,
                      ],
                    }))}
                  />
                }
              >
                <RankedBarChart
                  data={salesBars}
                  seriesLabel="Doanh số thuần"
                  selectedId={selectedAgency}
                  onSelect={(datum) => pickAgencyBar(salesRows, datum)}
                />
              </VisualCard>
            )}

            {debtSource && (
              <VisualCard
                className="md:col-span-6 xl:col-span-4"
                title="Đại lý nợ nhiều nhất"
                description={
                  debtFromReport
                    ? `Top ${TOP} theo nợ cuối kỳ · ${periodLabel}${debtSource.note ? ` · ${debtSource.note}` : ''}`
                    : `Top ${TOP} · ${debtSource.note}`
                }
                loading={debtSource.loading}
                error={debtSource.error}
                onRetry={debtSource.retry}
                isEmpty={!debtBars.length}
                empty={
                  <EmptyState
                    title="Không có đại lý nào đang nợ"
                    description="Tất cả đại lý đã tất toán công nợ."
                  />
                }
                table={
                  <MiniTable
                    caption="Top đại lý có dư nợ"
                    headers={[
                      'Đại lý',
                      debtFromReport ? 'Nợ cuối kỳ' : 'Dư nợ hiện tại',
                    ]}
                    rows={debtSource.rows.slice(0, TOP).map((row) => ({
                      key: String(row.agencyId),
                      label: String(row.agencyName),
                      detail: String(row.agencyCode),
                      selected: String(row.agencyId) === selectedAgency,
                      onSelect: () => pickAgency(row),
                      selectLabel: `Lọc theo đại lý ${agencyLabel(row)}`,
                      cells: [formatVND(String(row[debtSource.amountKey]))],
                    }))}
                  />
                }
              >
                <RankedBarChart
                  data={debtBars}
                  seriesLabel={debtFromReport ? 'Nợ cuối kỳ' : 'Dư nợ hiện tại'}
                  selectedId={selectedAgency}
                  onSelect={(datum) => pickAgencyBar(debtSource.rows, datum)}
                />
              </VisualCard>
            )}

            {cashSource && (
              <VisualCard
                className="md:col-span-6 xl:col-span-4"
                title="Dòng tiền và dư có"
                description={`${periodLabel}${cashSource.note ? ` · ${cashSource.note}` : ''}`}
                loading={cashSource.loading}
                error={cashSource.error}
                onRetry={cashSource.retry}
                isEmpty={!cashBars.length}
                table={
                  <MiniTable
                    caption="Dòng tiền và dư có"
                    headers={['Chỉ tiêu', 'Số tiền']}
                    rows={cashSource.items.map((item) => ({
                      key: item.key,
                      label: item.label,
                      cells: [formatVND(item.value)],
                    }))}
                  />
                }
              >
                <RankedBarChart data={cashBars} seriesLabel="Số tiền" />
              </VisualCard>
            )}

            {showInventory && (
              <VisualCard
                className="md:col-span-6 xl:col-span-4"
                title="Sức khỏe tồn kho"
                description={
                  reportAllowed('inventory')
                    ? `Mặt hàng tồn thấp nhất cuối ${periodLabel.toLowerCase()}`
                    : 'Tình trạng tồn kho hiện tại'
                }
                loading={
                  reportAllowed('inventory')
                    ? inventoryReport.loading
                    : snapshot.loading
                }
                error={
                  reportAllowed('inventory')
                    ? inventoryReport.error
                    : snapshot.error
                }
                onRetry={
                  reportAllowed('inventory')
                    ? inventoryReport.retry
                    : () => setReload((n) => n + 1)
                }
                isEmpty={!inventory && !stockBars.length}
                table={
                  stockRows.length ? (
                    <MiniTable
                      caption="Mặt hàng tồn thấp nhất"
                      headers={[
                        'Mặt hàng',
                        'Tồn đầu',
                        'Nhập',
                        'Xuất',
                        'Tồn cuối',
                      ]}
                      rows={stockRows.map((row) => ({
                        key: String(row.productId),
                        label: String(row.productName),
                        detail: `${String(row.productCode)} · ${String(row.unitName)}`,
                        selected: String(row.productId) === selectedProduct,
                        onSelect: () => pickProduct(row),
                        selectLabel: `Lọc theo mặt hàng ${productLabel(row)}`,
                        cells: [
                          formatQuantity(String(row.openingStock)),
                          formatQuantity(String(row.receiptQuantity)),
                          formatQuantity(String(row.issueQuantity)),
                          formatQuantity(String(row.closingStock)),
                        ],
                      }))}
                    />
                  ) : undefined
                }
              >
                <div className="space-y-4">
                  {inventory && (
                    <SegmentedBar
                      label="Tỷ lệ mặt hàng tồn thấp"
                      segments={[
                        {
                          key: 'low',
                          label: 'Tồn thấp',
                          value: inventory.lowStockProductCount,
                          display: formatPlain(inventory.lowStockProductCount),
                          color: 'var(--warning)',
                        },
                        {
                          key: 'ok',
                          label: 'Đủ hàng',
                          value: Math.max(
                            0,
                            inventory.productCount -
                              inventory.lowStockProductCount,
                          ),
                          display: formatPlain(
                            Math.max(
                              0,
                              inventory.productCount -
                                inventory.lowStockProductCount,
                            ),
                          ),
                          color: 'var(--success)',
                        },
                      ]}
                    />
                  )}
                  {stockBars.length > 0 && (
                    <RankedBarChart
                      data={stockBars}
                      seriesLabel="Tồn cuối kỳ"
                      color="var(--chart-1)"
                      selectedId={selectedProduct}
                      onSelect={(datum) => {
                        const row = stockRows.find(
                          (item) => String(item.productId) === datum.id,
                        )
                        if (row) pickProduct(row)
                      }}
                    />
                  )}
                </div>
              </VisualCard>
            )}

            {(matrixSources.sales || matrixSources.debt) && (
              <VisualCard
                className="md:col-span-12 xl:col-span-8"
                title="Ma trận đại lý"
                description={`Doanh số và công nợ theo đại lý · ${periodLabel} · thanh dữ liệu theo từng cột`}
                loading={matrixLoading}
                error={matrixError}
                onRetry={() => {
                  if (salesReport.error) salesReport.retry()
                  if (debtReport.error) debtReport.retry()
                }}
                isEmpty={!matrixRows.length}
                empty={
                  <EmptyState
                    title="Không có đại lý phù hợp"
                    description="Không có số liệu đại lý cho bộ lọc hiện tại."
                  />
                }
              >
                <div className="max-h-[420px] overflow-auto rounded-md border">
                  <AgencyMatrix
                    rows={matrixRows}
                    sources={matrixSources}
                    totals={{
                      sales: salesReport.page?.totals,
                      debt: debtReport.page?.totals,
                    }}
                    selectedId={selectedAgency}
                    onSelect={(row) =>
                      toggle('agencyId', {
                        id: row.agencyId,
                        label: `${row.agencyCode} — ${row.agencyName}`,
                      })
                    }
                  />
                </div>
              </VisualCard>
            )}
          </div>
        </>
      )}
    </div>
  )
}
