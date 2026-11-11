// Shared "Mebius-style" chart set on the shadcn chart wrapper + Recharts.
// Look: dotted canvas, dashed horizontal grid only, no axis lines, fully
// rounded bars, soft vertical gradients, radial rings with tracks, segmented
// meters, card-native tooltips and a short draw-in animation.
import { motion, useReducedMotion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
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
import { CHART_AXIS, CHART_GRID, chartColor, formatCompact } from '@/lib/chart'
import { cn } from '@/lib/utils'

const TICK = { fill: CHART_AXIS, fontSize: 11 }
const ANIMATION = { isAnimationActive: true, animationDuration: 700 } as const

export interface SeriesSpec {
  key: string
  label: string
  /** Defaults to chart slot by index. */
  color?: string
}

function configOf(series: readonly SeriesSpec[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, index) => [
      s.key,
      { label: s.label, color: s.color ?? chartColor(index) },
    ]),
  )
}

type Row = Record<string, string | number | null | undefined>

/**
 * Vertical bars with fully rounded caps. Grouped by default, `stacked` stacks
 * them (only the top segment is rounded). Hovering a column dims the others.
 */
export function RoundedBarChart({
  data,
  xKey,
  series,
  stacked = false,
  valueFormatter = formatCompact,
  height = 260,
  showLegend = series.length > 1,
  className,
}: {
  data: readonly Row[]
  xKey: string
  series: readonly SeriesSpec[]
  stacked?: boolean
  valueFormatter?: (value: number) => string
  height?: number
  showLegend?: boolean
  className?: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const config = configOf(series)
  return (
    <ChartContainer
      config={config}
      className={cn('bg-dots aspect-auto w-full rounded-lg', className)}
      style={{ height }}
    >
      <BarChart
        data={data as Row[]}
        margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
        barGap={4}
        barCategoryGap="22%"
        onMouseMove={(state) =>
          setActive(
            typeof state?.activeTooltipIndex === 'number'
              ? state.activeTooltipIndex
              : null,
          )
        }
        onMouseLeave={() => setActive(null)}
      >
        <CartesianGrid
          vertical={false}
          stroke={CHART_GRID}
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={TICK}
          tickMargin={8}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={TICK}
          width={52}
          tickFormatter={(value: number) => valueFormatter(value)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value, name, item) => (
                <div className="flex w-full items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="text-muted-foreground">
                    {config[String(name)]?.label ?? name}
                  </span>
                  <span className="ml-auto pl-3 font-semibold tabular-nums">
                    {valueFormatter(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        {showLegend && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, index) => {
          const top = !stacked || index === series.length - 1
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              stackId={stacked ? 'stack' : undefined}
              radius={top ? [8, 8, stacked ? 0 : 8, stacked ? 0 : 8] : 0}
              maxBarSize={stacked ? 34 : 22}
              {...ANIMATION}
            >
              {data.map((_, rowIndex) => (
                <Cell
                  key={rowIndex}
                  fillOpacity={
                    active === null || active === rowIndex ? 1 : 0.35
                  }
                />
              ))}
            </Bar>
          )
        })}
      </BarChart>
    </ChartContainer>
  )
}

/** Smooth area(s) with a soft vertical gradient; `dashedKey` draws a comparison line. */
export function GradientAreaChart({
  data,
  xKey,
  series,
  dashedKey,
  dashedLabel,
  valueFormatter = formatCompact,
  height = 260,
  className,
}: {
  data: readonly Row[]
  xKey: string
  series: readonly SeriesSpec[]
  dashedKey?: string
  dashedLabel?: string
  valueFormatter?: (value: number) => string
  height?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const config = {
    ...configOf(series),
    ...(dashedKey
      ? { [dashedKey]: { label: dashedLabel ?? dashedKey, color: CHART_AXIS } }
      : {}),
  }
  return (
    <ChartContainer
      config={config}
      className={cn('bg-dots aspect-auto w-full rounded-lg', className)}
      style={{ height }}
    >
      <AreaChart
        data={data as Row[]}
        margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.key}
              id={`${uid}-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={`var(--color-${s.key})`}
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor={`var(--color-${s.key})`}
                stopOpacity={0.02}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          vertical={false}
          stroke={CHART_GRID}
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={TICK}
          tickMargin={8}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={TICK}
          width={52}
          tickFormatter={(value: number) => valueFormatter(value)}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: '4 4' }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value, name, item) => (
                <div className="flex w-full items-center gap-2">
                  <span
                    className="h-0.5 w-3 rounded"
                    style={{ background: item.color }}
                  />
                  <span className="text-muted-foreground">
                    {config[String(name)]?.label ?? name}
                  </span>
                  <span className="ml-auto pl-3 font-semibold tabular-nums">
                    {valueFormatter(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        {(series.length > 1 || dashedKey) && (
          <ChartLegend content={<ChartLegendContent />} />
        )}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={`var(--color-${s.key})`}
            strokeWidth={2.25}
            fill={`url(#${uid}-${s.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
            {...ANIMATION}
          />
        ))}
        {dashedKey && (
          <Line
            type="monotone"
            dataKey={dashedKey}
            stroke={CHART_AXIS}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            {...ANIMATION}
          />
        )}
      </AreaChart>
    </ChartContainer>
  )
}

export interface PartDatum {
  key: string
  label: string
  value: number
  color?: string
}

/** Donut with rounded, separated segments and the total in the centre. */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  valueFormatter = formatCompact,
  height = 220,
  className,
}: {
  data: readonly PartDatum[]
  centerLabel: string
  centerValue?: string
  valueFormatter?: (value: number) => string
  height?: number
  className?: string
}) {
  const config: ChartConfig = Object.fromEntries(
    data.map((d, index) => [
      d.key,
      { label: d.label, color: d.color ?? chartColor(index) },
    ]),
  )
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const rows = data.map((d) => ({ ...d, fill: `var(--color-${d.key})` }))
  return (
    <ChartContainer
      config={config}
      className={cn('mx-auto aspect-square w-full', className)}
      style={{ height, maxHeight: height }}
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="key"
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: item.payload?.fill }}
                  />
                  <span className="text-muted-foreground">
                    {item.payload?.label}
                  </span>
                  <span className="ml-auto pl-3 font-semibold tabular-nums">
                    {valueFormatter(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie
          data={rows}
          dataKey="value"
          nameKey="key"
          innerRadius="64%"
          outerRadius="92%"
          paddingAngle={total > 0 && data.length > 1 ? 3 : 0}
          cornerRadius={6}
          strokeWidth={0}
          {...ANIMATION}
        >
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !('cx' in viewBox)) return null
              const { cx = 0, cy = 0 } = viewBox as { cx?: number; cy?: number }
              return (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x={cx}
                    y={cy - 4}
                    className="fill-foreground text-lg font-bold"
                  >
                    {centerValue ?? valueFormatter(total)}
                  </tspan>
                  <tspan
                    x={cx}
                    y={cy + 16}
                    className="fill-muted-foreground text-[11px]"
                  >
                    {centerLabel}
                  </tspan>
                </text>
              )
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

/** Concentric progress rings (0–1 ratios) with tracks, largest ring first. */
export function RadialRings({
  data,
  centerLabel,
  centerValue,
  height = 220,
  className,
}: {
  data: readonly { key: string; label: string; ratio: number; color?: string }[]
  centerLabel?: string
  centerValue?: string
  height?: number
  className?: string
}) {
  const config: ChartConfig = Object.fromEntries(
    data.map((d, index) => [
      d.key,
      { label: d.label, color: d.color ?? chartColor(index) },
    ]),
  )
  const rows = data.map((d) => ({
    key: d.key,
    label: d.label,
    value: Math.max(0, Math.min(1, d.ratio)) * 100,
    fill: `var(--color-${d.key})`,
  }))
  return (
    <ChartContainer
      config={config}
      className={cn('mx-auto aspect-square w-full', className)}
      style={{ height, maxHeight: height }}
    >
      <RadialBarChart
        data={rows}
        innerRadius="38%"
        outerRadius="100%"
        startAngle={90}
        endAngle={-270}
        barSize={10}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="key"
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: item.payload?.fill }}
                  />
                  <span className="text-muted-foreground">
                    {item.payload?.label}
                  </span>
                  <span className="ml-auto pl-3 font-semibold tabular-nums">
                    {Math.round(Number(value))}%
                  </span>
                </div>
              )}
            />
          }
        />
        <RadialBar
          dataKey="value"
          background
          cornerRadius={10}
          {...ANIMATION}
        />
        {(centerLabel || centerValue) && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            <tspan
              x="50%"
              dy="-0.2em"
              className="fill-foreground text-lg font-bold"
            >
              {centerValue}
            </tspan>
            <tspan
              x="50%"
              dy="1.5em"
              className="fill-muted-foreground text-[11px]"
            >
              {centerLabel}
            </tspan>
          </text>
        )}
      </RadialBarChart>
    </ChartContainer>
  )
}

/**
 * Segmented meter: a row of thin vertical bars that fill up to `ratio`
 * ("saving progress" style). Text label stays outside for accessibility.
 */
export function SegmentedMeter({
  ratio,
  segments = 32,
  color = 'var(--chart-1)',
  label,
  className,
}: {
  ratio: number
  segments?: number
  color?: string
  label: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0))
  const filled = Math.round(clamped * segments)
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('flex h-9 items-end gap-[3px]', className)}
    >
      {Array.from({ length: segments }, (_, index) => (
        <motion.span
          key={index}
          className="h-full flex-1 rounded-full"
          style={{
            background: index < filled ? color : 'var(--muted)',
            opacity:
              index < filled
                ? 0.45 + (0.55 * (index + 1)) / Math.max(filled, 1)
                : 1,
          }}
          initial={reduce ? false : { scaleY: 0.2 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: reduce ? 0 : index * 0.012, duration: 0.3 }}
        />
      ))}
    </div>
  )
}

/** Small legend row: swatch, label and value — used beside donuts and rings. */
export function LegendList({
  items,
  className,
}: {
  items: readonly {
    key: string
    label: ReactNode
    value: ReactNode
    color?: string
  }[]
  className?: string
}) {
  return (
    <ul className={cn('grid gap-2 text-sm', className)}>
      {items.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: item.color ?? chartColor(index) }}
            aria-hidden="true"
          />
          <span className="min-w-0 truncate text-muted-foreground">
            {item.label}
          </span>
          <span className="ml-auto font-semibold tabular-nums">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  )
}
