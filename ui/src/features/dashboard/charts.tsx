// Dashboard chart primitives on the shadcn chart wrapper + Recharts, in the
// shared Mebius look: pill bars on a muted track, no axis lines, hover dims
// the other bars, card-native tooltips with exact values.
import { Info } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/shadcn/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/shadcn/chart'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip'
import { CHART_AXIS } from '@/lib/chart'
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
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto ps-3 font-semibold text-foreground tabular-nums">
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

function truncate(value: string, max = 16): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/**
 * Ranked horizontal pill bars, one hue, on a muted track. Hovering a bar dims
 * the others; with `selectedId` the unselected bars stay dimmed. With
 * `onSelect` a bar click cross-filters the dashboard.
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
  const [hover, setHover] = useState<number | null>(null)
  const config = { value: { label: seriesLabel, color } } satisfies ChartConfig
  const height = Math.max(150, data.length * 28 + 16)
  const negative = data.some((datum) => datum.value < 0)
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
        margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
        barCategoryGap={7}
        onMouseMove={(state) =>
          setHover(
            typeof state?.activeTooltipIndex === 'number'
              ? state.activeTooltipIndex
              : null,
          )
        }
        onMouseLeave={() => setHover(null)}
      >
        <XAxis type="number" hide domain={[negative ? 'auto' : 0, 'auto']} />
        <YAxis
          type="category"
          dataKey="label"
          width={118}
          tick={TICK}
          tickFormatter={(v: string) => truncate(v)}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <ChartTooltip
          cursor={false}
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
          radius={999}
          maxBarSize={14}
          background={{ fill: 'var(--muted)', radius: 999 }}
          isAnimationActive
          animationDuration={700}
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
          {data.map((datum, index) => {
            const dimmed =
              hover !== null
                ? hover !== index
                : !!selectedId && datum.id !== selectedId
            return (
              <Cell
                key={datum.id}
                fill={color}
                fillOpacity={dimmed ? 0.3 : 1}
                style={{ transition: 'fill-opacity 200ms ease' }}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/** Small "i" button whose tooltip carries secondary copy instead of a paragraph. */
export function InfoTip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="rounded-full text-muted-foreground"
          >
            <Info aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
