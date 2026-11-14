import type { ReactNode } from 'react'
import { ChartCard } from '@/components/blocks/ChartCard'
import { KpiCard, type KpiDelta } from '@/components/blocks/KpiCard'
import {
  DonutChart,
  LegendList,
  SegmentedMeter,
  type PartDatum,
} from '@/components/charts/MebiusCharts'
import { CountUp, Stagger, StaggerItem } from '@/components/motion/Motion'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { formatPercent, formatPlain } from '@/lib/chart'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n/core'

/**
 * Animated summary strip above a list. `partial` marks figures computed from
 * the loaded page only (more pages exist), so they are never read as totals.
 */
export function SummaryGrid({
  label,
  partial,
  children,
  className,
}: {
  label: string
  partial?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-label={label} className="relative">
      <Badge
        variant={partial ? 'info' : 'neutral'}
        className="absolute -top-2.5 end-3 z-20 bg-card text-[11px]"
      >
        {partial ? t('Trang hiện tại') : t('Toàn bộ danh sách')}
      </Badge>
      <Stagger
        className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}
      >
        {children}
      </Stagger>
    </section>
  )
}

/** Small KPI tile with a count-up value. */
export function StatTile({
  label,
  value,
  format = formatPlain,
  icon,
  hint,
  delta,
  className,
}: {
  label: string
  value: number
  format?: (value: number) => string
  icon?: ReactNode
  hint?: ReactNode
  delta?: KpiDelta
  className?: string
}) {
  return (
    <StaggerItem className={className}>
      <KpiCard
        label={label}
        value={<CountUp value={value} format={format} />}
        icon={icon}
        hint={hint}
        delta={delta}
        className="h-full"
      />
    </StaggerItem>
  )
}

/** Chart card spanning two grid columns, with a chart ⇄ table switch. */
export function ChartTile({
  title,
  table,
  children,
  isEmpty,
  className,
}: {
  title: string
  table?: ReactNode
  children: ReactNode
  isEmpty?: boolean
  className?: string
}) {
  return (
    <StaggerItem className={cn('col-span-2', className)}>
      <ChartCard
        title={title}
        table={table}
        isEmpty={isEmpty}
        className="h-full"
        empty={
          <p className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t('Chưa có số liệu.')}
          </p>
        }
      >
        {children}
      </ChartCard>
    </StaggerItem>
  )
}

/** Two-column accessible table used as the table view of a chart. */
export function MiniTable({
  caption,
  head,
  rows,
}: {
  caption: string
  head: [string, string]
  rows: readonly (readonly [ReactNode, ReactNode])[]
}) {
  return (
    <Table caption={caption}>
      <thead>
        <tr>
          <th scope="col">{head[0]}</th>
          <th scope="col" className="cell-number text-end">
            {head[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, value], index) => (
          <tr key={index}>
            <td>{name}</td>
            <td className="cell-number text-end tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

/** Donut + legend in one chart tile. */
export function DonutTile({
  title,
  data,
  centerLabel,
  head,
  format = formatPlain,
  className,
}: {
  title: string
  data: readonly PartDatum[]
  centerLabel: string
  head: [string, string]
  format?: (value: number) => string
  className?: string
}) {
  const total = data.reduce((sum, part) => sum + part.value, 0)
  return (
    <ChartTile
      title={title}
      className={className}
      isEmpty={!data.length || total <= 0}
      table={
        <MiniTable
          caption={title}
          head={head}
          rows={data.map((part) => [part.label, format(part.value)])}
        />
      }
    >
      <div className="grid items-center gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <DonutChart
          data={data}
          centerLabel={centerLabel}
          centerValue={format(total)}
          valueFormatter={format}
          height={144}
        />
        <LegendList
          items={data.map((part) => ({
            key: part.key,
            label: part.label,
            value: format(part.value),
            color: part.color,
          }))}
        />
      </div>
    </ChartTile>
  )
}

/** Segmented meter tile: ratio headline, meter and a two-line legend. */
export function MeterTile({
  title,
  ratio,
  caption,
  color,
  legend,
  className,
}: {
  title: string
  ratio: number
  caption: string
  color?: string
  legend?: readonly { key: string; label: ReactNode; value: ReactNode }[]
  className?: string
}) {
  return (
    <ChartTile title={title} className={className}>
      <div className="space-y-3">
        <p className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {formatPercent(ratio)}
          </span>
          <span className="text-xs text-muted-foreground">{caption}</span>
        </p>
        <SegmentedMeter ratio={ratio} label={title} color={color} />
        {legend && legend.length > 0 && (
          <LegendList
            className="grid-cols-2"
            items={legend.map((item, index) => ({
              ...item,
              color: index === 0 ? (color ?? 'var(--chart-1)') : 'var(--muted)',
            }))}
          />
        )}
      </div>
    </ChartTile>
  )
}
