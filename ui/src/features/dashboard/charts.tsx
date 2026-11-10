// Dashboard chart primitives built on the shadcn chart wrapper + Recharts.
// Marks follow the dataviz spec: thin bars with 4px rounded data ends, 2px
// lines, hairline grid, compact ticks, a tooltip on every chart.
import type { ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/shadcn/chart'
import { CHART_AXIS, CHART_GRID, formatCompact } from '@/lib/chart'
import { cn } from '@/lib/utils'

const TICK = { fill: CHART_AXIS, fontSize: 11 }

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string
  label: ReactNode
  value: ReactNode
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <span
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}

export interface BarDatum {
  id: string
  label: string
  value: number
  /** Exact formatted value for tooltips. */
  display: string
  detail?: string
}

function truncate(value: string, max = 18): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/**
 * Ranked horizontal bars, one hue. With `onSelect` a bar click cross-filters
 * the dashboard; with `selectedId` the other bars are dimmed (highlight).
 */
export function RankedBarChart({
  data,
  seriesLabel,
  color = 'var(--chart-1)',
  selectedId,
  onSelect,
  className,
}: {
  data: BarDatum[]
  seriesLabel: string
  color?: string
  selectedId?: string | null
  onSelect?: (datum: BarDatum) => void
  className?: string
}) {
  const config = { value: { label: seriesLabel, color } } satisfies ChartConfig
  const height = Math.max(160, data.length * 30 + 36)
  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto w-full', className)}
      style={{ height }}
      initialDimension={{ width: 480, height }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
        barCategoryGap={6}
      >
        <CartesianGrid horizontal={false} stroke={CHART_GRID} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatCompact(v)}
          tick={TICK}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={128}
          tick={TICK}
          tickFormatter={(v: string) => truncate(v)}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(_value, _name, item) => {
                const datum = item.payload as BarDatum
                return (
                  <div className="grid gap-1">
                    <span className="font-medium text-foreground">
                      {datum.label}
                    </span>
                    <TooltipRow
                      color={color}
                      label={seriesLabel}
                      value={datum.display}
                    />
                    {datum.detail && (
                      <span className="text-muted-foreground">
                        {datum.detail}
                      </span>
                    )}
                  </div>
                )
              }}
            />
          }
        />
        <Bar
          dataKey="value"
          fill={color}
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          isAnimationActive={false}
          className={onSelect ? 'cursor-pointer' : undefined}
          onClick={
            onSelect
              ? (item) => {
                  const datum = (item as { payload?: BarDatum }).payload
                  if (datum) onSelect(datum)
                }
              : undefined
          }
        >
          {data.map((datum) => (
            <Cell
              key={datum.id}
              fill={color}
              fillOpacity={selectedId && datum.id !== selectedId ? 0.28 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export interface TrendDatum {
  month: string
  label: string
  net: number
  gross: number
  returns: number
  display: Record<'net' | 'gross' | 'returns', string>
}

const trendConfig = {
  net: { label: 'Doanh số thuần', color: 'var(--chart-1)' },
  gross: { label: 'Doanh số gộp', color: 'var(--chart-2)' },
  returns: { label: 'Hàng trả lại', color: 'var(--chart-3)' },
} satisfies ChartConfig

/** Monthly gross/net/returns on one money axis (net drawn last, as a light area). */
export function SalesTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <ChartContainer
      config={trendConfig}
      className="aspect-auto h-[280px] w-full"
      initialDimension={{ width: 640, height: 280 }}
    >
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis
          dataKey="label"
          tick={TICK}
          axisLine={false}
          tickLine={false}
          minTickGap={8}
        />
        <YAxis
          width={52}
          tick={TICK}
          tickFormatter={(v: number) => formatCompact(v)}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_label, payload) =>
                `Tháng ${(payload?.[0]?.payload as TrendDatum | undefined)?.label ?? ''}`
              }
              formatter={(_value, name, item) => {
                const key = String(name) as keyof typeof trendConfig
                const datum = item.payload as TrendDatum
                return (
                  <TooltipRow
                    color={trendConfig[key].color}
                    label={trendConfig[key].label}
                    value={datum.display[key]}
                  />
                )
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="gross"
          type="monotone"
          stroke="var(--color-gross)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
          isAnimationActive={false}
        />
        <Line
          dataKey="returns"
          type="monotone"
          stroke="var(--color-returns)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
          isAnimationActive={false}
        />
        <Area
          dataKey="net"
          type="monotone"
          stroke="var(--color-net)"
          strokeWidth={2}
          fill="var(--color-net)"
          fillOpacity={0.1}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

export interface Segment {
  key: string
  label: string
  value: number
  display: string
  color: string
}

/** Thin part-to-whole bar (one whole, ≤ 6 parts) with a text legend. */
export function SegmentedBar({
  segments,
  label,
}: {
  segments: Segment[]
  label: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const summary = segments
    .map((segment) => `${segment.label}: ${segment.display}`)
    .join(', ')
  return (
    <div className="space-y-2">
      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label}. ${summary}.`}
      >
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(segment.value / total) * 100}%`,
                  background: segment.color,
                }}
                title={`${segment.label}: ${segment.display}`}
              />
            ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[2px]"
              style={{ background: segment.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-medium text-foreground tabular-nums">
              {segment.display}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
