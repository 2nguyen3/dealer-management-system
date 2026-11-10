import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Boxes,
  CircleOff,
  FileText,
  HandCoins,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  TrendingUp,
  Undo2,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { ChartCard } from '../../components/blocks/ChartCard'
import { KpiCard } from '../../components/blocks/KpiCard'
import { formatCompactVND, formatPercent, toNumber } from '../../lib/chart'
import { formatQuantity, formatVND } from '../../lib/formatters'
import type { ReportKind, ReportPage, ReportRow } from './contracts'
import {
  ChartDataTable,
  FlowChart,
  GroupedBarChart,
  RankedBarChart,
  type ChartSeries,
} from './charts'
import { columnLabels } from './display'
import {
  allZero,
  creditFlow,
  debtFlow,
  flowData,
  inventoryCounts,
  rankRows,
  returnRatio,
  type ChartDatum,
} from './insights'

interface Kpi {
  label: string
  value: string
  exactValue?: string
  hint?: string
  icon: ReactNode
}

function moneyKpi(
  label: string,
  totals: ReportRow | undefined,
  key: string,
  icon: ReactNode,
  hint = 'Toàn bộ kết quả đã lọc',
): Kpi {
  const raw = totals?.[key] ?? '0'
  return {
    label,
    value: formatCompactVND(toNumber(raw)),
    exactValue: formatVND(raw),
    hint,
    icon,
  }
}

function countKpi(
  label: string,
  value: number | string,
  icon: ReactNode,
  hint: string,
): Kpi {
  return { label, value: formatQuantity(String(value)), hint, icon }
}

function kpisOf(kind: ReportKind, page: ReportPage): Kpi[] {
  const totals = page.totals
  switch (kind) {
    case 'sales': {
      const ratio = returnRatio(totals)
      return [
        moneyKpi(
          'Doanh số gộp',
          totals,
          'salesAmount',
          <TrendingUp />,
          `Toàn công ty: ${formatVND(totals?.companyGrossSales ?? '0')}`,
        ),
        moneyKpi(
          'Hàng trả lại',
          totals,
          'returnAmount',
          <Undo2 />,
          ratio === null
            ? 'Toàn bộ kết quả đã lọc'
            : `${formatPercent(ratio)} doanh số gộp`,
        ),
        moneyKpi('Doanh số thuần', totals, 'netSalesAmount', <Banknote />),
        countKpi(
          'Số phiếu xuất',
          totals?.numberOfIssues ?? 0,
          <FileText />,
          'Toàn bộ kết quả đã lọc',
        ),
      ]
    }
    case 'debt':
      return [
        moneyKpi('Nợ đầu kỳ', totals, 'openingDebt', <Scale />),
        moneyKpi('Phát sinh nợ', totals, 'debtIncrease', <ArrowUpRight />),
        moneyKpi('Tổng giảm nợ', totals, 'debtDecrease', <ArrowDownLeft />),
        moneyKpi('Nợ cuối kỳ', totals, 'closingDebt', <Wallet />),
      ]
    case 'inventory': {
      const counts = inventoryCounts(page.items)
      const hint = 'Trên trang hiện tại'
      return [
        countKpi('Mặt hàng', counts.products, <Boxes />, hint),
        countKpi('Có nhập/xuất', counts.moving, <PackageCheck />, hint),
        countKpi('Hết tồn cuối kỳ', counts.outOfStock, <CircleOff />, hint),
        countKpi('Có điều chỉnh', counts.adjusted, <SlidersHorizontal />, hint),
      ]
    }
    case 'product-sales': {
      const ratio = returnRatio(totals)
      return [
        moneyKpi('Doanh số gộp', totals, 'salesAmount', <TrendingUp />),
        moneyKpi(
          'Hàng trả lại',
          totals,
          'returnAmount',
          <Undo2 />,
          ratio === null
            ? 'Toàn bộ kết quả đã lọc'
            : `${formatPercent(ratio)} doanh số gộp`,
        ),
        moneyKpi('Doanh số thuần', totals, 'netSalesAmount', <Banknote />),
        countKpi(
          'Mặt hàng có giao dịch',
          page.items.length,
          <Boxes />,
          'Trên trang hiện tại',
        ),
      ]
    }
    case 'cash-and-credit':
      return [
        moneyKpi('Tiền đã thu', totals, 'cashReceived', <HandCoins />),
        moneyKpi('Tiền đã hoàn', totals, 'cashRefunded', <RotateCcw />),
        moneyKpi('Dư có cuối kỳ', totals, 'closingCredit', <Wallet />),
        moneyKpi(
          'Dư có khả dụng',
          totals,
          'currentAvailableCredit',
          <ReceiptText />,
          'Số dư hiện tại',
        ),
      ]
  }
}

function series(key: string, color: string, label?: string): ChartSeries {
  return { key, color, label: label ?? columnLabels[key] ?? key }
}

interface ChartSpec {
  title: string
  description: string
  data: ChartDatum[]
  keys: string[]
  nameHeader: string
  chart: ReactNode
}

function ranked(
  kind: ReportKind,
  items: ReportRow[],
  title: string,
  measure: ChartSeries,
  nameHeader: string,
): ChartSpec {
  const data = rankRows(kind, items, [measure.key])
  return {
    title,
    description: `Top ${data.length} trên trang hiện tại`,
    data,
    keys: [measure.key],
    nameHeader,
    chart: <RankedBarChart data={data} series={measure} />,
  }
}

function grouped(
  kind: ReportKind,
  items: ReportRow[],
  title: string,
  measures: ChartSeries[],
  nameHeader: string,
  measure?: string,
): ChartSpec {
  const keys = measures.map((m) => m.key)
  const data = rankRows(kind, items, keys, { limit: 8, axis: 'code', measure })
  return {
    title,
    description: `${data.length} dòng lớn nhất trên trang hiện tại`,
    data,
    keys,
    nameHeader,
    chart: <GroupedBarChart data={data} series={measures} />,
  }
}

function flow(
  title: string,
  totals: ReportRow | undefined,
  steps: typeof debtFlow,
): ChartSpec {
  const data = flowData(totals, steps)
  return {
    title,
    description: 'Tổng toàn bộ kết quả đã lọc trong kỳ',
    data,
    keys: ['value'],
    nameHeader: 'Thành phần',
    chart: <FlowChart data={data} />,
  }
}

function chartsOf(kind: ReportKind, page: ReportPage): ChartSpec[] {
  const items = page.items
  switch (kind) {
    case 'sales':
      return [
        ranked(
          kind,
          items,
          'Doanh số thuần theo đại lý',
          series('netSalesAmount', 'var(--chart-1)'),
          'Đại lý',
        ),
        grouped(
          kind,
          items,
          'Doanh số gộp và hàng trả lại',
          [
            series('salesAmount', 'var(--chart-1)'),
            series('returnAmount', 'var(--chart-2)'),
          ],
          'Đại lý',
        ),
      ]
    case 'debt':
      return [
        ranked(
          kind,
          items,
          'Đại lý nợ nhiều nhất cuối kỳ',
          series('closingDebt', 'var(--chart-1)'),
          'Đại lý',
        ),
        flow('Biến động công nợ trong kỳ', page.totals, debtFlow),
      ]
    case 'inventory':
      return [
        ranked(
          kind,
          items,
          'Tồn cuối kỳ theo mặt hàng',
          series('closingStock', 'var(--chart-1)'),
          'Mặt hàng',
        ),
        grouped(
          kind,
          items,
          'Nhập, xuất và trả lại theo mặt hàng',
          [
            series('receiptQuantity', 'var(--chart-1)'),
            series('issueQuantity', 'var(--chart-2)'),
            series('returnQuantity', 'var(--chart-3)'),
          ],
          'Mặt hàng',
          'issueQuantity',
        ),
      ]
    case 'product-sales':
      return [
        ranked(
          kind,
          items,
          'Mặt hàng doanh số thuần cao nhất',
          series('netSalesAmount', 'var(--chart-1)'),
          'Mặt hàng',
        ),
        ranked(
          kind,
          items,
          'Mặt hàng bán nhiều nhất (số lượng)',
          series('soldQuantity', 'var(--chart-3)'),
          'Mặt hàng',
        ),
      ]
    case 'cash-and-credit':
      return [
        grouped(
          kind,
          items,
          'Thu tiền, hoàn tiền và dư có phát sinh',
          [
            series('cashReceived', 'var(--chart-1)'),
            series('cashRefunded', 'var(--chart-2)'),
            series('creditCreated', 'var(--chart-3)'),
          ],
          'Đại lý',
        ),
        flow('Biến động dư có trong kỳ', page.totals, creditFlow),
      ]
  }
}

/** KPI strip of a loaded report page. */
export function ReportKpis({
  kind,
  page,
}: {
  kind: ReportKind
  page: ReportPage
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Chỉ số chính"
      role="group"
    >
      {kpisOf(kind, page).map((kpi) => (
        <KpiCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          exactValue={kpi.exactValue}
          hint={kpi.hint}
          icon={kpi.icon}
        />
      ))}
    </div>
  )
}

/** Chart cards (each with a table view) of a loaded report page. */
export function ReportCharts({
  kind,
  page,
}: {
  kind: ReportKind
  page: ReportPage
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {chartsOf(kind, page).map((spec) => (
        <ChartCard
          key={spec.title}
          title={spec.title}
          description={spec.description}
          isEmpty={!spec.data.length || allZero(spec.data, spec.keys)}
          empty={
            <p className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
              Không có giá trị khác 0 để vẽ biểu đồ.
            </p>
          }
          table={
            <ChartDataTable
              data={spec.data}
              nameHeader={spec.nameHeader}
              columns={spec.keys.map((key) => ({
                key,
                label: key === 'value' ? 'Giá trị' : (columnLabels[key] ?? key),
              }))}
            />
          }
        >
          {spec.chart}
        </ChartCard>
      ))}
    </div>
  )
}
