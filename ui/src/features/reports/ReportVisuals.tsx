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
import {
  DonutChart,
  LegendList,
  RadialRings,
} from '../../components/charts/MebiusCharts'
import { CountUp, Stagger, StaggerItem } from '../../components/motion/Motion'
import {
  formatCompactVND,
  formatPercent,
  formatPlain,
  toNumber,
} from '../../lib/chart'
import { formatVND } from '../../lib/formatters'
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
  compositionOf,
  creditFlow,
  debtFlow,
  flowData,
  inventoryCounts,
  rankRows,
  returnRatio,
  type ChartDatum,
  type Composition,
} from './insights'
import { t } from '@/lib/i18n/core'

const FILTERED = t('Tổng đã lọc')
const THIS_PAGE = t('Trang này')

interface Kpi {
  label: string
  value: ReactNode
  exactValue?: string
  hint?: string
  icon: ReactNode
}

function moneyKpi(
  label: string,
  totals: ReportRow | undefined,
  key: string,
  icon: ReactNode,
  hint = FILTERED,
): Kpi {
  const raw = totals?.[key] ?? '0'
  return {
    label,
    value: <CountUp value={toNumber(raw)} format={formatCompactVND} />,
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
  return {
    label,
    value: <CountUp value={toNumber(value)} format={formatPlain} />,
    hint,
    icon,
  }
}

function kpisOf(kind: ReportKind, page: ReportPage): Kpi[] {
  const totals = page.totals
  switch (kind) {
    case 'sales': {
      const ratio = returnRatio(totals)
      return [
        moneyKpi(
          t('Doanh số gộp'),
          totals,
          'salesAmount',
          <TrendingUp />,
          t('Toàn công ty: {companyGrossSales}', {
            companyGrossSales: formatVND(totals?.companyGrossSales ?? '0'),
          }),
        ),
        moneyKpi(
          t('Hàng trả lại'),
          totals,
          'returnAmount',
          <Undo2 />,
          ratio === null
            ? FILTERED
            : t('{ratio} doanh số gộp', { ratio: formatPercent(ratio) }),
        ),
        moneyKpi(t('Doanh số thuần'), totals, 'netSalesAmount', <Banknote />),
        countKpi(
          t('Số phiếu xuất'),
          totals?.numberOfIssues ?? 0,
          <FileText />,
          FILTERED,
        ),
      ]
    }
    case 'debt':
      return [
        moneyKpi(t('Nợ đầu kỳ'), totals, 'openingDebt', <Scale />),
        moneyKpi(t('Phát sinh nợ'), totals, 'debtIncrease', <ArrowUpRight />),
        moneyKpi(t('Tổng giảm nợ'), totals, 'debtDecrease', <ArrowDownLeft />),
        moneyKpi(t('Nợ cuối kỳ'), totals, 'closingDebt', <Wallet />),
      ]
    case 'inventory': {
      const counts = inventoryCounts(page.items)
      const hint = THIS_PAGE
      return [
        countKpi(t('Mặt hàng'), counts.products, <Boxes />, hint),
        countKpi(t('Có nhập/xuất'), counts.moving, <PackageCheck />, hint),
        countKpi(t('Hết tồn cuối kỳ'), counts.outOfStock, <CircleOff />, hint),
        countKpi(
          t('Có điều chỉnh'),
          counts.adjusted,
          <SlidersHorizontal />,
          hint,
        ),
      ]
    }
    case 'product-sales': {
      const ratio = returnRatio(totals)
      return [
        moneyKpi(t('Doanh số gộp'), totals, 'salesAmount', <TrendingUp />),
        moneyKpi(
          t('Hàng trả lại'),
          totals,
          'returnAmount',
          <Undo2 />,
          ratio === null
            ? FILTERED
            : t('{ratio} doanh số gộp', { ratio: formatPercent(ratio) }),
        ),
        moneyKpi(t('Doanh số thuần'), totals, 'netSalesAmount', <Banknote />),
        countKpi(
          t('Mặt hàng có giao dịch'),
          page.items.length,
          <Boxes />,
          THIS_PAGE,
        ),
      ]
    }
    case 'cash-and-credit':
      return [
        moneyKpi(t('Tiền đã thu'), totals, 'cashReceived', <HandCoins />),
        moneyKpi(t('Tiền đã hoàn'), totals, 'cashRefunded', <RotateCcw />),
        moneyKpi(t('Dư có cuối kỳ'), totals, 'closingCredit', <Wallet />),
        moneyKpi(
          t('Dư có khả dụng'),
          totals,
          'currentAvailableCredit',
          <ReceiptText />,
          t('Số dư hiện tại'),
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
    description: t('Top {count} · trang này', { count: data.length }),
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
    description: t('{count} dòng lớn nhất · trang này', { count: data.length }),
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
    description: FILTERED,
    data,
    keys: ['value'],
    nameHeader: t('Thành phần'),
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
          t('Doanh số thuần theo đại lý'),
          series('netSalesAmount', 'var(--chart-1)'),
          t('Đại lý'),
        ),
        grouped(
          kind,
          items,
          t('Doanh số gộp và hàng trả lại'),
          [
            series('salesAmount', 'var(--chart-1)'),
            series('returnAmount', 'var(--chart-2)'),
          ],
          t('Đại lý'),
        ),
      ]
    case 'debt':
      return [
        ranked(
          kind,
          items,
          t('Đại lý nợ nhiều nhất cuối kỳ'),
          series('closingDebt', 'var(--chart-1)'),
          t('Đại lý'),
        ),
        flow(t('Biến động công nợ trong kỳ'), page.totals, debtFlow),
      ]
    case 'inventory':
      return [
        ranked(
          kind,
          items,
          t('Tồn cuối kỳ theo mặt hàng'),
          series('closingStock', 'var(--chart-1)'),
          t('Mặt hàng'),
        ),
        grouped(
          kind,
          items,
          t('Nhập, xuất và trả lại theo mặt hàng'),
          [
            series('receiptQuantity', 'var(--chart-1)'),
            series('issueQuantity', 'var(--chart-2)'),
            series('returnQuantity', 'var(--chart-3)'),
          ],
          t('Mặt hàng'),
          'issueQuantity',
        ),
      ]
    case 'product-sales':
      return [
        ranked(
          kind,
          items,
          t('Mặt hàng doanh số thuần cao nhất'),
          series('netSalesAmount', 'var(--chart-1)'),
          t('Mặt hàng'),
        ),
        ranked(
          kind,
          items,
          t('Mặt hàng bán nhiều nhất (số lượng)'),
          series('soldQuantity', 'var(--chart-3)'),
          t('Mặt hàng'),
        ),
      ]
    case 'cash-and-credit':
      return [
        grouped(
          kind,
          items,
          t('Thu tiền, hoàn tiền và dư có phát sinh'),
          [
            series('cashReceived', 'var(--chart-1)'),
            series('cashRefunded', 'var(--chart-2)'),
            series('creditCreated', 'var(--chart-3)'),
          ],
          t('Đại lý'),
        ),
        flow(t('Biến động dư có trong kỳ'), page.totals, creditFlow),
      ]
  }
}

/** KPI strip of a loaded report page: staggered tiles with counting values. */
export function ReportKpis({
  kind,
  page,
}: {
  kind: ReportKind
  page: ReportPage
}) {
  return (
    <Stagger
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t('Chỉ số chính')}
      role="group"
    >
      {kpisOf(kind, page).map((kpi) => (
        <StaggerItem key={kpi.label}>
          <KpiCard
            label={kpi.label}
            value={kpi.value}
            exactValue={kpi.exactValue}
            hint={kpi.hint}
            icon={kpi.icon}
            className="h-full"
          />
        </StaggerItem>
      ))}
    </Stagger>
  )
}

/** Donut (with centre total) or radial rings plus an exact-value legend. */
function CompositionVisual({ composition }: { composition: Composition }) {
  const { shape, parts, centerLabel, centerValue } = composition
  return (
    <div className="grid items-center gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
      {shape === 'donut' ? (
        <DonutChart
          data={parts}
          centerLabel={centerLabel}
          centerValue={centerValue}
          valueFormatter={formatCompactVND}
          height={200}
        />
      ) : (
        <RadialRings
          data={parts}
          centerLabel={centerLabel}
          centerValue={centerValue}
          height={200}
        />
      )}
      <LegendList
        items={parts.map((part) => ({
          key: part.key,
          label: part.label,
          color: part.color,
          value: (
            <>
              {part.display}
              <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                {formatPercent(part.ratio)}
              </span>
            </>
          ),
        }))}
      />
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
  const composition = compositionOf(kind, page.totals, page.items)
  const compositionRows: ChartDatum[] = composition.parts.map((part) => ({
    id: part.key,
    label: part.label,
    name: part.label,
    display: { value: part.display, ratio: formatPercent(part.ratio) },
  }))
  return (
    <Stagger
      className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
      delay={0.15}
    >
      {chartsOf(kind, page).map((spec) => (
        <StaggerItem key={spec.title}>
          <ChartCard
            title={spec.title}
            description={spec.description}
            className="h-full"
            isEmpty={!spec.data.length || allZero(spec.data, spec.keys)}
            empty={
              <p className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
                {t('Không có giá trị khác 0 để vẽ biểu đồ.')}
              </p>
            }
            table={
              <ChartDataTable
                data={spec.data}
                nameHeader={spec.nameHeader}
                columns={spec.keys.map((key) => ({
                  key,
                  label:
                    key === 'value' ? t('Giá trị') : (columnLabels[key] ?? key),
                }))}
              />
            }
          >
            {spec.chart}
          </ChartCard>
        </StaggerItem>
      ))}
      <StaggerItem className="lg:col-span-2 xl:col-span-1">
        <ChartCard
          title={composition.title}
          description={composition.shape === 'rings' ? THIS_PAGE : FILTERED}
          className="h-full"
          isEmpty={
            composition.shape === 'donut' &&
            composition.parts.every((part) => !part.value)
          }
          empty={
            <p className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
              {t('Chưa có giá trị trong kỳ.')}
            </p>
          }
          table={
            <ChartDataTable
              data={compositionRows}
              nameHeader={t('Thành phần')}
              columns={[
                { key: 'value', label: t('Giá trị') },
                { key: 'ratio', label: t('Tỷ lệ') },
              ]}
            />
          }
        >
          <CompositionVisual composition={composition} />
        </ChartCard>
      </StaggerItem>
    </Stagger>
  )
}
