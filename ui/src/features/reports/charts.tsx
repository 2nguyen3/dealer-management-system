// Report chart primitives on shadcn ChartContainer + Recharts in the shared
// Mebius look: dotted canvas, dashed horizontal grid only, no axis lines,
// pill bars (on a muted track when horizontal) and hover dimming. Colours are
// fixed per measure (never per rank); tooltips show exact values.
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/shadcn/chart'
import { CHART_AXIS, CHART_GRID, formatCompact } from '../../lib/chart'
import { flowRoles, type ChartDatum, type FlowRole } from './insights'
import { t } from '@/lib/i18n/core'

export interface ChartSeries {
  key: string
  label: string
  color: string
}

const tick = { fill: CHART_AXIS, fontSize: 11 }
const ANIMATION = { isAnimationActive: true, animationDuration: 700 } as const
const TRACK = { fill: 'var(--muted)', radius: 999 }

/** Zero-based nice axis; negative values (e.g. net sales) widen it below 0. */
function valueDomain(
  data: ChartDatum[],
  keys: string[],
): [number | 'auto', 'auto'] {
  const negative = data.some((d) => keys.some((key) => Number(d[key]) < 0))
  return [negative ? 'auto' : 0, 'auto']
}

function configOf(series: ChartSeries[]): ChartConfig {
  return Object.fromEntries(
    series.map(({ key, label, color }) => [key, { label, color }]),
  )
}

/** Index of the hovered category, for dimming the others. */
function useHover() {
  const [active, setActive] = useState<number | null>(null)
  return {
    active,
    handlers: {
      onMouseMove: (state: { activeTooltipIndex?: unknown } | undefined) =>
        setActive(
          typeof state?.activeTooltipIndex === 'number'
            ? state.activeTooltipIndex
            : null,
        ),
      onMouseLeave: () => setActive(null),
    },
    opacity: (index: number) =>
      active === null || active === index ? 1 : 0.32,
  }
}

function DatumTooltip({ config }: { config: ChartConfig }) {
  return (
    <ChartTooltip
      cursor={false}
      content={
        <ChartTooltipContent
          labelFormatter={(_label, payload) =>
            (payload?.[0]?.payload as ChartDatum | undefined)?.name
          }
          formatter={(value, name, item) => {
            const key = String(name)
            const row = item.payload as ChartDatum
            const color = row.fill ?? item.color ?? `var(--color-${key})`
            return (
              <div className="flex w-full items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">
                  {config[key]?.label ?? key}
                </span>
                <span className="ms-auto ps-3 font-semibold text-foreground tabular-nums">
                  {row.display[key] ?? String(value)}
                </span>
              </div>
            )
          }}
        />
      }
    />
  )
}

/** Horizontal ranked pill bars of one measure (magnitude → single hue). */
export function RankedBarChart({
  data,
  series,
}: {
  data: ChartDatum[]
  series: ChartSeries
}) {
  const config = configOf([series])
  const hover = useHover()
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: Math.max(150, data.length * 28 + 16) }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
        barCategoryGap={7}
        accessibilityLayer
        {...hover.handlers}
      >
        <XAxis type="number" hide domain={valueDomain(data, [series.key])} />
        <YAxis
          type="category"
          dataKey="label"
          width={128}
          tickLine={false}
          axisLine={false}
          tick={tick}
          interval={0}
        />
        <DatumTooltip config={config} />
        <Bar
          dataKey={series.key}
          fill={`var(--color-${series.key})`}
          radius={999}
          maxBarSize={14}
          background={TRACK}
          {...ANIMATION}
        >
          {data.map((d, index) => (
            <Cell
              key={d.id}
              fillOpacity={hover.opacity(index)}
              style={{ transition: 'fill-opacity 200ms ease' }}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/** Vertical grouped pill bars: a few measures side by side per category. */
export function GroupedBarChart({
  data,
  series,
}: {
  data: ChartDatum[]
  series: ChartSeries[]
}) {
  const config = configOf(series)
  const hover = useHover()
  return (
    <ChartContainer
      config={config}
      className="bg-dots aspect-auto h-72 w-full rounded-lg"
    >
      <BarChart
        data={data}
        margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
        barGap={3}
        barCategoryGap="24%"
        accessibilityLayer
        {...hover.handlers}
      >
        <CartesianGrid
          vertical={false}
          stroke={CHART_GRID}
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={tick}
          interval="preserveStartEnd"
          minTickGap={4}
          tickMargin={8}
        />
        <YAxis
          domain={valueDomain(
            data,
            series.map((s) => s.key),
          )}
          width={52}
          tickLine={false}
          axisLine={false}
          tick={tick}
          tickFormatter={(value: number) => formatCompact(value)}
        />
        <DatumTooltip config={config} />
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
        {series.map(({ key }) => (
          <Bar
            key={key}
            dataKey={key}
            fill={`var(--color-${key})`}
            radius={999}
            maxBarSize={14}
            {...ANIMATION}
          >
            {data.map((d, index) => (
              <Cell
                key={d.id}
                fillOpacity={hover.opacity(index)}
                style={{ transition: 'fill-opacity 200ms ease' }}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  )
}

/** Balance/increase/decrease components of a period, coloured by role. */
export function FlowChart({ data }: { data: ChartDatum[] }) {
  const config: ChartConfig = { value: { label: t('Giá trị') } }
  const roles = Object.keys(flowRoles) as FlowRole[]
  const hover = useHover()
  return (
    <div>
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height: Math.max(150, data.length * 30 + 16) }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          barCategoryGap={8}
          accessibilityLayer
          {...hover.handlers}
        >
          <XAxis type="number" hide domain={valueDomain(data, ['value'])} />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={tick}
            interval={0}
          />
          <DatumTooltip config={config} />
          <Bar
            dataKey="value"
            radius={999}
            maxBarSize={14}
            background={TRACK}
            {...ANIMATION}
          >
            {data.map((d, index) => (
              <Cell
                key={d.id}
                fill={d.fill}
                fillOpacity={hover.opacity(index)}
                style={{ transition: 'fill-opacity 200ms ease' }}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <ul className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        {roles.map((role) => (
          <li key={role} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: flowRoles[role].color }}
              aria-hidden="true"
            />
            {flowRoles[role].label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Accessible table view of a chart's data with exact values. */
export function ChartDataTable({
  data,
  columns,
  nameHeader,
}: {
  data: ChartDatum[]
  columns: { key: string; label: string }[]
  nameHeader: string
}) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-card">
        <tr className="border-b text-muted-foreground">
          <th scope="col" className="py-2 pe-3 text-start font-medium">
            {nameHeader}
          </th>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className="py-2 ps-3 text-end font-medium"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr
            key={d.id}
            className="border-b transition-colors last:border-0 hover:bg-muted/50"
          >
            <th scope="row" className="py-1.5 pe-3 text-start font-normal">
              {d.name}
            </th>
            {columns.map((column) => (
              <td
                key={column.key}
                className="py-1.5 ps-3 text-end whitespace-nowrap tabular-nums"
              >
                {d.display[column.key] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
