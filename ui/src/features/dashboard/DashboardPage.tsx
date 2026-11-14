import {
  BadgeCheck,
  Banknote,
  ClipboardList,
  Crosshair,
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
import {
  DonutChart,
  GradientAreaChart,
  LegendList,
  SegmentedMeter,
} from '../../components/charts/MebiusCharts'
import { CountUp, Stagger, StaggerItem } from '../../components/motion/Motion'
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
import { InfoTip, RankedBarChart, type BarDatum } from './charts'
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
import { t } from '@/lib/i18n/core'

type Section = keyof typeof sectionGrants

const sectionLabels: Record<Section, string> = {
  agencies: t('Đại lý'),
  inventory: t('Tồn kho'),
  sales: t('Doanh số'),
  receivables: t('Công nợ và tiền'),
  pendingIssueCount: t('Phiếu xuất đang chờ'),
  verifiedUnreceiptedAmount: t('Tiền đã xác minh chưa ghi phiếu thu'),
}

const VS_PREVIOUS = t('so với tháng trước')
const TOP = 10

/** Compact animated money value; the exact amount stays for screen readers. */
function money(value: string) {
  return {
    value: <CountUp value={toNumber(value)} format={formatCompactVND} />,
    exactValue: formatVND(value),
  }
}

function count(value: number) {
  return <CountUp value={value} format={formatPlain} />
}

/** KPI delta props; without a comparable previous month show a plain hint. */
function delta(ratio: number | null, upIsGood: boolean) {
  return ratio === null
    ? { hint: t('Chưa có tháng trước') }
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
      ? t('Theo bộ lọc: {map}', {
          map: applied.map((key) => filterNames[key]).join(', '),
        })
      : '',
    ignored.length
      ? t('Không áp dụng: {map}', {
          map: ignored.map((key) => filterNames[key]).join(', '),
        })
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
  const periodLabel = t('Tháng {monthLabel}', {
    monthLabel: monthLabel(selectedMonth),
  })
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
    wardId:
      reportAllowed('debt') &&
      (grants.has('agency.read') || grants.has('agency.manage')),
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
      setMonthError(t('Chọn tháng hợp lệ.'))
      return
    }
    setMonthError(null)
    setSelectedMonth(value)
  }

  // ---------------------------------------------------------------- KPIs
  const trend = sales?.monthlyTrend ?? []
  const kpis: { key: string; node: ReactNode }[] = []
  if (sales) {
    kpis.push(
      {
        key: 'net',
        node: (
          <KpiCard
            label={t('Doanh số thuần')}
            {...money(sales.net)}
            icon={<TrendingUp />}
            {...delta(trendDelta(trend, selectedMonth, 'net'), true)}
            trend={trend.map((point) => toNumber(point.net))}
          />
        ),
      },
      {
        key: 'returns',
        node: (
          <KpiCard
            label={t('Hàng trả lại')}
            {...money(sales.returns)}
            icon={<Undo2 />}
            {...delta(trendDelta(trend, selectedMonth, 'returns'), false)}
            trend={trend.map((point) => toNumber(point.returns))}
            trendColor="var(--chart-3)"
          />
        ),
      },
    )
  }
  if (receivables) {
    kpis.push(
      {
        key: 'debt',
        node: (
          <KpiCard
            label={t('Công nợ hiện tại')}
            {...money(receivables.currentDebt)}
            icon={<Landmark />}
            hint={t('Dư có {currentCredit}', {
              currentCredit: formatVND(receivables.currentCredit),
            })}
          />
        ),
      },
      {
        key: 'cash',
        node: (
          <KpiCard
            label={t('Tiền thực thu')}
            {...money(receivables.cashReceived)}
            icon={<Banknote />}
            hint={t('Đã hoàn {cashRefunded}', {
              cashRefunded: formatVND(receivables.cashRefunded),
            })}
          />
        ),
      },
    )
  }
  if (agencies) {
    kpis.push({
      key: 'agencies',
      node: (
        <KpiCard
          label={t('Đại lý hoạt động')}
          value={
            <>
              {count(agencies.active)} / {count(agencies.total)}
            </>
          }
          icon={<Store />}
          hint={
            agencies.total
              ? t('{value} tổng số', {
                  value: formatPercent(agencies.active / agencies.total),
                })
              : t('Chưa có đại lý')
          }
        />
      ),
    })
  }
  if (inventory) {
    kpis.push({
      key: 'low-stock',
      node: (
        <KpiCard
          label={t('Mặt hàng tồn thấp')}
          value={count(inventory.lowStockProductCount)}
          icon={<PackageX />}
          hint={t('/ {productCount} mặt hàng · nhập {toNumber}', {
            productCount: formatQuantity(inventory.productCount),
            toNumber: formatCompactVND(toNumber(inventory.receivedAmount)),
          })}
        />
      ),
    })
  }
  if (pendingIssues !== undefined) {
    kpis.push({
      key: 'pending',
      node: (
        <KpiCard
          label={t('Phiếu xuất đang chờ')}
          value={count(pendingIssues)}
          icon={<ClipboardList />}
          hint={t('Chưa ghi sổ')}
        />
      ),
    })
  }
  if (verifiedUnreceipted !== undefined) {
    kpis.push({
      key: 'verified',
      node: (
        <KpiCard
          label={t('Đã xác minh, chưa ghi phiếu thu')}
          {...money(verifiedUnreceipted)}
          icon={<BadgeCheck />}
          hint={t('Chưa tính vào thực thu')}
        />
      ),
    })
  }
  const expectedKpis =
    (can('sales') ? 2 : 0) +
    (can('receivables') ? 2 : 0) +
    (can('agencies') ? 1 : 0) +
    (can('inventory') ? 1 : 0) +
    (can('pendingIssueCount') ? 1 : 0) +
    (can('verifiedUnreceiptedAmount') ? 1 : 0)

  // ---------------------------------------------------------------- visuals
  const trendData = trend.map((point) => ({
    label: shortMonthLabel(point.month),
    gross: toNumber(point.gross),
    net: toNumber(point.net),
    returns: toNumber(point.returns),
  }))
  const salesMix = sales
    ? [
        {
          key: 'net',
          label: t('Doanh số thuần'),
          raw: sales.net,
          value: Math.max(0, toNumber(sales.net)),
          color: 'var(--chart-1)',
        },
        {
          key: 'returns',
          label: t('Hàng trả lại'),
          raw: sales.returns,
          value: Math.max(0, toNumber(sales.returns)),
          color: 'var(--chart-3)',
        },
      ]
    : []
  const salesMixTotal = salesMix.reduce((sum, part) => sum + part.value, 0)

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
          note: t('Toàn công ty'),
        }
      : null
  const productBars: BarDatum[] = (productSource?.rows ?? [])
    .slice(0, TOP)
    .map((row) => ({
      id: String(row.productId),
      label: String(row.productName),
      value: toNumber(row.salesAmount),
      display: formatVND(String(row.salesAmount)),
      detail: t('{productCode} · bán {soldQuantity} {unitName}', {
        productCode: String(row.productCode),
        soldQuantity: formatQuantity(String(row.soldQuantity)),
        unitName: String(row.unitName),
      }),
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
          note: t('Dư nợ hiện tại, toàn công ty'),
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
    detail: t('{agencyCode} · {numberOfIssues} phiếu xuất', {
      agencyCode: String(row.agencyCode),
      numberOfIssues: formatQuantity(String(row.numberOfIssues)),
    }),
  }))

  const cashTotals = cashReport.page?.totals
  const cashSource = reportAllowed('cash-and-credit')
    ? {
        ...cashReport,
        items: cashTotals
          ? (
              [
                ['cashReceived', t('Tiền thực thu')],
                ['cashRefunded', t('Tiền thực hoàn')],
                ['creditCreated', t('Dư có phát sinh')],
                ['creditApplied', t('Dư có đã cấn trừ')],
                ['creditRefunded', t('Dư có đã hoàn')],
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
                  label: t('Tiền thực thu'),
                  value: receivables.cashReceived,
                },
                {
                  key: 'cashRefunded',
                  label: t('Tiền thực hoàn'),
                  value: receivables.cashRefunded,
                },
              ]
            : [],
          note: t('Toàn công ty'),
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
          label: t('Doanh số thuần của đại lý'),
          value: formatVND(String(focusAgencySales.netSalesAmount)),
        },
        {
          label: t('Tỷ lệ doanh số'),
          value: `${formatQuantity(String(focusAgencySales.salesRate))} %`,
        },
      )
    if (focusAgencyDebt)
      focusItems.push({
        label: t('Nợ cuối kỳ của đại lý'),
        value: formatVND(String(focusAgencyDebt.closingDebt)),
      })
    if (cashTotals)
      focusItems.push({
        label: t('Thực thu từ đại lý'),
        value: formatVND(String(cashTotals.cashReceived)),
      })
  }
  if (selectedProduct) {
    if (focusProductSales)
      focusItems.push(
        {
          label: t('Mặt hàng: số lượng bán'),
          value: `${formatQuantity(String(focusProductSales.soldQuantity))} ${String(focusProductSales.unitName)}`,
        },
        {
          label: t('Mặt hàng: doanh số gộp'),
          value: formatVND(String(focusProductSales.salesAmount)),
        },
      )
    if (focusProductStock)
      focusItems.push({
        label: t('Mặt hàng: tồn cuối kỳ'),
        value: `${formatQuantity(String(focusProductStock.closingStock))} ${String(focusProductStock.unitName)}`,
      })
  }

  const refreshing =
    snapshot.loading ||
    [salesReport, debtReport, productReport, cashReport, inventoryReport].some(
      (state) => state.loading,
    )

  const retry = () => setReload((n) => n + 1)
  const inStock = inventory
    ? Math.max(0, inventory.productCount - inventory.lowStockProductCount)
    : 0
  const inStockRatio =
    inventory && inventory.productCount ? inStock / inventory.productCount : 0

  return (
    <div className="space-y-5">
      <PageHeader
        className="mb-0"
        eyebrow={t('Tổng quan điều hành')}
        title={t('Bảng điều khiển')}
        description={t('Nhấn một đại lý hoặc mặt hàng để lọc chéo.')}
        actions={
          admitted && (
            <>
              <p
                role="status"
                className="text-xs text-muted-foreground tabular-nums"
              >
                {data ? (
                  <>
                    {t('{periodLabel} · Cập nhật lúc', { periodLabel })}{' '}
                    <time
                      dateTime={data.asOf}
                      className="font-medium text-foreground"
                    >
                      {formatDateTime(data.asOf)}
                    </time>
                  </>
                ) : snapshot.loading ? (
                  t('Đang tải dữ liệu…')
                ) : (
                  periodLabel
                )}
              </p>
              <InfoTip label={t('Phạm vi số liệu')}>
                {t(
                  'Chỉ số tính cho toàn công ty. Công nợ, đại lý và tồn kho là số hiện tại; doanh số, nhập hàng và thu tiền theo tháng đã chọn.',
                )}
              </InfoTip>
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCw className="size-4" aria-hidden="true" />}
                isLoading={refreshing}
                onClick={retry}
              >
                {t('Làm mới')}
              </Button>
            </>
          )
        }
      />
      {!admitted ? (
        <Alert type="info">
          {t(
            'Bạn không có quyền truy cập bảng điều khiển. Liên hệ quản trị viên nếu cần được cấp quyền.',
          )}
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

          <section aria-label={t('Chỉ số chính')} className="space-y-3">
            {snapshot.error ? (
              <Alert type="error" title={t('Không tải được chỉ số tổng quan')}>
                <span className="block">{snapshot.error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={retry}
                >
                  {t('Thử lại')}
                </Button>
              </Alert>
            ) : snapshot.loading ? (
              <div
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                aria-busy="true"
              >
                <span className="sr-only">
                  {t('Đang tải bảng điều khiển...')}
                </span>
                {Array.from({ length: Math.max(1, expectedKpis) }, (_, i) => (
                  <Card key={i} className="gap-3 p-4 shadow-xs">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-7 w-3/4" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {missing.length > 0 && (
                  <Alert type="info">
                    {t('Chưa có dữ liệu cho: {map}.', {
                      map: missing
                        .map((section) => sectionLabels[section])
                        .join(', '),
                    })}
                  </Alert>
                )}
                {kpis.length > 0 && (
                  <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {kpis.map((kpi) => (
                      <StaggerItem key={kpi.key}>{kpi.node}</StaggerItem>
                    ))}
                  </Stagger>
                )}
              </>
            )}
          </section>

          {focusItems.length > 0 && (
            <section
              aria-label={t('Đối tượng đang chọn')}
              className="bg-water animate-in rounded-xl border border-primary/20 p-4 duration-300 fade-in-0 slide-in-from-top-1"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Crosshair className="size-4 text-primary" aria-hidden="true" />
                {[filters.agencyId?.label, filters.productId?.label]
                  .filter(Boolean)
                  .join(' · ')}
              </h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {focusItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border bg-card/80 px-3 py-2 shadow-xs"
                  >
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

          <Stagger
            className="grid grid-cols-1 gap-4 md:grid-cols-12"
            delay={0.1}
            step={0.06}
          >
            {can('sales') && (
              <StaggerItem className="md:col-span-12 xl:col-span-8">
                <VisualCard
                  title={t('Xu hướng doanh số')}
                  description={t('12 tháng gần nhất · toàn công ty')}
                  loading={snapshot.loading}
                  error={snapshot.error}
                  onRetry={retry}
                  isEmpty={!trendData.length}
                  empty={
                    <EmptyState
                      title={t('Chưa có dữ liệu xu hướng')}
                      description={t(
                        'Không có doanh số trong 12 tháng gần nhất.',
                      )}
                    />
                  }
                  table={
                    <MiniTable
                      caption={t('Xu hướng doanh số')}
                      headers={[
                        t('Tháng'),
                        t('Doanh số gộp'),
                        t('Trả hàng'),
                        t('Doanh số thuần'),
                      ]}
                      rows={trend.map((point) => ({
                        key: point.month,
                        label: monthLabel(point.month),
                        cells: [
                          formatVND(point.gross),
                          formatVND(point.returns),
                          formatVND(point.net),
                        ],
                        values: [
                          toNumber(point.gross),
                          toNumber(point.returns),
                          toNumber(point.net),
                        ],
                      }))}
                    />
                  }
                >
                  <GradientAreaChart
                    data={trendData}
                    xKey="label"
                    series={[
                      {
                        key: 'gross',
                        label: t('Doanh số gộp'),
                        color: 'var(--chart-2)',
                      },
                      {
                        key: 'net',
                        label: t('Doanh số thuần'),
                        color: 'var(--chart-1)',
                      },
                    ]}
                    dashedKey="returns"
                    dashedLabel={t('Hàng trả lại')}
                    tooltipFormatter={(value) => formatVND(value)}
                    height={280}
                  />
                </VisualCard>
              </StaggerItem>
            )}

            {can('sales') && (
              <StaggerItem className="md:col-span-6 xl:col-span-4">
                <VisualCard
                  title={t('Cơ cấu doanh số')}
                  description={t('{periodLabel} · toàn công ty', {
                    periodLabel,
                  })}
                  loading={snapshot.loading}
                  error={snapshot.error}
                  onRetry={retry}
                  isEmpty={!sales || salesMixTotal === 0}
                  empty={
                    <EmptyState
                      title={t('Chưa có doanh số trong tháng')}
                      description={t('Thử chọn tháng khác.')}
                    />
                  }
                  table={
                    sales && (
                      <MiniTable
                        caption={t('Cơ cấu doanh số')}
                        headers={[t('Chỉ tiêu'), t('Số tiền')]}
                        rows={[
                          ...salesMix.map((part) => ({
                            key: part.key,
                            label: part.label,
                            cells: [formatVND(part.raw)],
                          })),
                          {
                            key: 'gross',
                            label: t('Doanh số gộp'),
                            cells: [formatVND(sales.gross)],
                          },
                        ]}
                      />
                    )
                  }
                >
                  {sales && (
                    <div className="grid items-center gap-4">
                      <DonutChart
                        data={salesMix}
                        centerLabel={t('Doanh số gộp')}
                        centerValue={formatCompactVND(toNumber(sales.gross))}
                        valueFormatter={formatCompactVND}
                        height={200}
                      />
                      <LegendList
                        items={salesMix.map((part) => ({
                          key: part.key,
                          label: part.label,
                          color: part.color,
                          value: (
                            <span title={formatVND(part.raw)}>
                              {formatCompactVND(toNumber(part.raw))}
                              <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                                {formatPercent(
                                  salesMixTotal
                                    ? part.value / salesMixTotal
                                    : 0,
                                )}
                              </span>
                            </span>
                          ),
                        }))}
                      />
                    </div>
                  )}
                </VisualCard>
              </StaggerItem>
            )}

            {productSource && (
              <StaggerItem className="md:col-span-6 xl:col-span-4">
                <VisualCard
                  title={t('Mặt hàng bán chạy')}
                  description={t('Top {TOP} · doanh số gộp{value}', {
                    TOP,
                    value: productSource.note ? ` · ${productSource.note}` : '',
                  })}
                  loading={productSource.loading}
                  error={productSource.error}
                  onRetry={productSource.retry}
                  isEmpty={!productBars.length}
                  empty={
                    <EmptyState
                      title={t('Không có mặt hàng bán trong kỳ')}
                      description={t('Thử chọn tháng khác hoặc bỏ bộ lọc.')}
                    />
                  }
                  table={
                    <MiniTable
                      caption={t('Top mặt hàng')}
                      headers={[
                        t('Mặt hàng'),
                        t('Đã bán'),
                        t('Doanh số gộp'),
                        t('Doanh số thuần'),
                      ]}
                      rows={productSource.rows.slice(0, TOP).map((row) => ({
                        key: String(row.productId),
                        label: String(row.productName),
                        detail: String(row.productCode),
                        selected: String(row.productId) === selectedProduct,
                        onSelect: () => pickProduct(row),
                        selectLabel: t('Lọc theo mặt hàng {productLabel}', {
                          productLabel: productLabel(row),
                        }),
                        cells: [
                          `${formatQuantity(String(row.soldQuantity))} ${String(row.unitName)}`,
                          formatVND(String(row.salesAmount)),
                          formatVND(String(row.netSalesAmount)),
                        ],
                        values: [
                          toNumber(row.soldQuantity),
                          toNumber(row.salesAmount),
                          toNumber(row.netSalesAmount),
                        ],
                      }))}
                    />
                  }
                >
                  <RankedBarChart
                    data={productBars}
                    seriesLabel={t('Doanh số gộp')}
                    selectedId={selectedProduct}
                    onSelect={(datum) => {
                      const row = productSource.rows.find(
                        (item) => String(item.productId) === datum.id,
                      )
                      if (row) pickProduct(row)
                    }}
                  />
                </VisualCard>
              </StaggerItem>
            )}

            {reportAllowed('sales') && (
              <StaggerItem className="md:col-span-6 xl:col-span-4">
                <VisualCard
                  title={t('Doanh số thuần theo đại lý')}
                  description={`Top ${TOP}${filterNote('sales', filters) ? ` · ${filterNote('sales', filters)}` : ''}`}
                  loading={salesReport.loading}
                  error={salesReport.error}
                  onRetry={salesReport.retry}
                  isEmpty={!salesBars.length}
                  empty={
                    <EmptyState
                      title={t('Chưa có doanh số đại lý')}
                      description={t('Không có phiếu xuất trong kỳ đã chọn.')}
                    />
                  }
                  table={
                    <MiniTable
                      caption={t('Doanh số theo đại lý')}
                      headers={[
                        t('Đại lý'),
                        t('Số phiếu'),
                        t('Doanh số thuần'),
                        t('Tỷ lệ'),
                      ]}
                      rows={salesRows.slice(0, TOP).map((row) => ({
                        key: String(row.agencyId),
                        label: String(row.agencyName),
                        detail: String(row.agencyCode),
                        selected: String(row.agencyId) === selectedAgency,
                        onSelect: () => pickAgency(row),
                        selectLabel: t('Lọc theo đại lý {agencyLabel}', {
                          agencyLabel: agencyLabel(row),
                        }),
                        cells: [
                          formatQuantity(String(row.numberOfIssues)),
                          formatVND(String(row.netSalesAmount)),
                          `${formatQuantity(String(row.salesRate))} %`,
                        ],
                        values: [
                          toNumber(row.numberOfIssues),
                          toNumber(row.netSalesAmount),
                          toNumber(row.salesRate),
                        ],
                      }))}
                    />
                  }
                >
                  <RankedBarChart
                    data={salesBars}
                    seriesLabel={t('Doanh số thuần')}
                    selectedId={selectedAgency}
                    onSelect={(datum) => pickAgencyBar(salesRows, datum)}
                  />
                </VisualCard>
              </StaggerItem>
            )}

            {debtSource && (
              <StaggerItem className="md:col-span-6 xl:col-span-4">
                <VisualCard
                  title={t('Đại lý nợ nhiều nhất')}
                  description={
                    debtFromReport
                      ? t('Top {TOP} · nợ cuối kỳ{value}', {
                          TOP,
                          value: debtSource.note ? ` · ${debtSource.note}` : '',
                        })
                      : `Top ${TOP} · ${debtSource.note}`
                  }
                  loading={debtSource.loading}
                  error={debtSource.error}
                  onRetry={debtSource.retry}
                  isEmpty={!debtBars.length}
                  empty={
                    <EmptyState
                      title={t('Không có đại lý nào đang nợ')}
                      description={t('Tất cả đại lý đã tất toán công nợ.')}
                    />
                  }
                  table={
                    <MiniTable
                      caption={t('Top đại lý có dư nợ')}
                      headers={[
                        t('Đại lý'),
                        debtFromReport ? t('Nợ cuối kỳ') : t('Dư nợ hiện tại'),
                      ]}
                      rows={debtSource.rows.slice(0, TOP).map((row) => ({
                        key: String(row.agencyId),
                        label: String(row.agencyName),
                        detail: String(row.agencyCode),
                        selected: String(row.agencyId) === selectedAgency,
                        onSelect: () => pickAgency(row),
                        selectLabel: t('Lọc theo đại lý {agencyLabel}', {
                          agencyLabel: agencyLabel(row),
                        }),
                        cells: [formatVND(String(row[debtSource.amountKey]))],
                        values: [toNumber(row[debtSource.amountKey])],
                      }))}
                    />
                  }
                >
                  <RankedBarChart
                    data={debtBars}
                    seriesLabel={
                      debtFromReport ? t('Nợ cuối kỳ') : t('Dư nợ hiện tại')
                    }
                    color="var(--chart-3)"
                    selectedId={selectedAgency}
                    onSelect={(datum) => pickAgencyBar(debtSource.rows, datum)}
                  />
                </VisualCard>
              </StaggerItem>
            )}

            {cashSource && (
              <StaggerItem className="md:col-span-6">
                <VisualCard
                  title={t('Dòng tiền và dư có')}
                  description={cashSource.note ?? periodLabel}
                  loading={cashSource.loading}
                  error={cashSource.error}
                  onRetry={cashSource.retry}
                  isEmpty={!cashBars.length}
                  table={
                    <MiniTable
                      caption={t('Dòng tiền và dư có')}
                      headers={[t('Chỉ tiêu'), t('Số tiền')]}
                      rows={cashSource.items.map((item) => ({
                        key: item.key,
                        label: item.label,
                        cells: [formatVND(item.value)],
                        values: [toNumber(item.value)],
                      }))}
                    />
                  }
                >
                  <RankedBarChart
                    data={cashBars}
                    seriesLabel={t('Số tiền')}
                    color="var(--chart-2)"
                  />
                </VisualCard>
              </StaggerItem>
            )}

            {showInventory && (
              <StaggerItem className="md:col-span-6">
                <VisualCard
                  title={t('Sức khỏe tồn kho')}
                  description={
                    reportAllowed('inventory')
                      ? t('Tồn thấp nhất cuối kỳ')
                      : t('Hiện tại')
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
                    reportAllowed('inventory') ? inventoryReport.retry : retry
                  }
                  isEmpty={!inventory && !stockBars.length}
                  table={
                    stockRows.length ? (
                      <MiniTable
                        caption={t('Mặt hàng tồn thấp nhất')}
                        headers={[
                          t('Mặt hàng'),
                          t('Tồn đầu'),
                          t('Nhập'),
                          t('Xuất'),
                          t('Tồn cuối'),
                        ]}
                        rows={stockRows.map((row) => ({
                          key: String(row.productId),
                          label: String(row.productName),
                          detail: `${String(row.productCode)} · ${String(row.unitName)}`,
                          selected: String(row.productId) === selectedProduct,
                          onSelect: () => pickProduct(row),
                          selectLabel: t('Lọc theo mặt hàng {productLabel}', {
                            productLabel: productLabel(row),
                          }),
                          cells: [
                            formatQuantity(String(row.openingStock)),
                            formatQuantity(String(row.receiptQuantity)),
                            formatQuantity(String(row.issueQuantity)),
                            formatQuantity(String(row.closingStock)),
                          ],
                          values: [
                            toNumber(row.openingStock),
                            toNumber(row.receiptQuantity),
                            toNumber(row.issueQuantity),
                            toNumber(row.closingStock),
                          ],
                        }))}
                      />
                    ) : undefined
                  }
                >
                  <div className="space-y-4">
                    {inventory && (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {t('Mặt hàng đủ hàng')}
                          </span>
                          <span className="text-base font-semibold tabular-nums">
                            {formatPercent(inStockRatio)}
                          </span>
                        </div>
                        <SegmentedMeter
                          ratio={inStockRatio}
                          label={t('Tỷ lệ mặt hàng đủ hàng')}
                          color="var(--success)"
                          className="h-7"
                        />
                        <LegendList
                          className="grid-cols-2 gap-x-6 text-xs"
                          items={[
                            {
                              key: 'low',
                              label: t('Tồn thấp'),
                              value: formatPlain(
                                inventory.lowStockProductCount,
                              ),
                              color: 'var(--warning)',
                            },
                            {
                              key: 'ok',
                              label: t('Đủ hàng'),
                              value: formatPlain(inStock),
                              color: 'var(--success)',
                            },
                          ]}
                        />
                      </div>
                    )}
                    {stockBars.length > 0 && (
                      <RankedBarChart
                        data={stockBars}
                        seriesLabel={t('Tồn cuối kỳ')}
                        color="var(--chart-7)"
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
              </StaggerItem>
            )}

            {(matrixSources.sales || matrixSources.debt) && (
              <StaggerItem className="md:col-span-12">
                <VisualCard
                  title={t('Ma trận đại lý')}
                  description={t(
                    '{periodLabel} · nhấn tiêu đề cột để sắp xếp',
                    { periodLabel },
                  )}
                  loading={matrixLoading}
                  error={matrixError}
                  onRetry={() => {
                    if (salesReport.error) salesReport.retry()
                    if (debtReport.error) debtReport.retry()
                  }}
                  isEmpty={!matrixRows.length}
                  empty={
                    <EmptyState
                      title={t('Không có đại lý phù hợp')}
                      description={t(
                        'Không có số liệu đại lý cho bộ lọc hiện tại.',
                      )}
                    />
                  }
                >
                  <div className="max-h-[420px] overflow-auto rounded-lg border">
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
              </StaggerItem>
            )}
          </Stagger>
        </>
      )}
    </div>
  )
}
