// Report chart primitives on shadcn ChartContainer + Recharts. Colours are
// fixed per measure (never per rank); one value axis; tooltips show exact values.
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

export interface ChartSeries {
  key: string
  label: string
  color: string
}

const tick = { fill: CHART_AXIS, fontSize: 11 }

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

function DatumTooltip({ config }: { config: ChartConfig }) {
  return (
    <ChartTooltip
      cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
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
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">
                  {config[key]?.label ?? key}
                </span>
                <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">
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

/** Horizontal ranked bars of one measure (magnitude → single hue). */
export function RankedBarChart({
  data,
  series,
}: {
  data: ChartDatum[]
  series: ChartSeries
}) {
  const config = configOf([series])
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: Math.max(160, data.length * 30 + 32) }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
        accessibilityLayer
      >
        <CartesianGrid horizontal={false} stroke={CHART_GRID} />
        <XAxis
          type="number"
          domain={valueDomain(data, [series.key])}
          tickLine={false}
          axisLine={false}
          tick={tick}
          tickFormatter={(value: number) => formatCompact(value)}
        />
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
          radius={4}
          barSize={14}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}

/** Vertical grouped bars: a few measures side by side per category. */
export function GroupedBarChart({
  data,
  series,
}: {
  data: ChartDatum[]
  series: ChartSeries[]
}) {
  const config = configOf(series)
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        barGap={2}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={tick}
          interval="preserveStartEnd"
          minTickGap={4}
          tickMargin={6}
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
            radius={4}
            maxBarSize={16}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

/** Balance/increase/decrease components of a period, coloured by role. */
export function FlowChart({ data }: { data: ChartDatum[] }) {
  const config: ChartConfig = { value: { label: 'Giá trị' } }
  const roles = Object.keys(flowRoles) as FlowRole[]
  return (
    <div>
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height: Math.max(160, data.length * 32 + 32) }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
          accessibilityLayer
        >
          <CartesianGrid horizontal={false} stroke={CHART_GRID} />
          <XAxis
            type="number"
            domain={valueDomain(data, ['value'])}
            tickLine={false}
            axisLine={false}
            tick={tick}
            tickFormatter={(value: number) => formatCompact(value)}
          />
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
            radius={4}
            barSize={16}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <ul className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        {roles.map((role) => (
          <li key={role} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[2px]"
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
          <th scope="col" className="py-2 pr-3 text-left font-medium">
            {nameHeader}
          </th>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className="py-2 pl-3 text-right font-medium"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.id} className="border-b last:border-0">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal">
              {d.name}
            </th>
            {columns.map((column) => (
              <td
                key={column.key}
                className="py-1.5 pl-3 text-right whitespace-nowrap tabular-nums"
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
