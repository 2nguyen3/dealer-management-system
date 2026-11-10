import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { formatPercent } from '@/lib/chart'
import { cn } from '@/lib/utils'
import { Card } from '../shadcn/card'

export interface KpiDelta {
  /** Relative change, e.g. 0.12 for +12 %. `null` hides the percentage. */
  ratio: number | null
  /** Whether an increase is good (revenue) or bad (debt). Defaults to true. */
  upIsGood?: boolean
  /** Comparison label, e.g. "so với tháng trước". */
  label?: string
}

export interface KpiCardProps {
  label: string
  value: ReactNode
  /** Exact value for screen readers / title when `value` is abbreviated. */
  exactValue?: string
  icon?: ReactNode
  hint?: ReactNode
  delta?: KpiDelta
  /** Sparkline series (chronological). Rendered only with ≥ 2 points. */
  trend?: number[]
  /** CSS colour for the sparkline; defaults to chart slot 1. */
  trendColor?: string
  active?: boolean
  onClick?: () => void
  className?: string
}

function DeltaPill({ delta }: { delta: KpiDelta }) {
  const { ratio, upIsGood = true, label } = delta
  if (ratio === null) {
    return label ? (
      <span className="text-xs text-muted-foreground">{label}</span>
    ) : null
  }
  const flat = Math.abs(ratio) < 0.0005
  const up = ratio > 0
  const good = flat ? null : up === upIsGood
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums',
          good === null && 'bg-muted text-muted-foreground',
          good === true && 'bg-emerald-50 text-emerald-700',
          good === false && 'bg-red-50 text-red-700',
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {up && !flat ? '+' : ''}
        {formatPercent(ratio)}
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  )
}

/** Power BI-style KPI tile: headline value, period delta and sparkline. */
export function KpiCard({
  label,
  value,
  exactValue,
  icon,
  hint,
  delta,
  trend,
  trendColor = 'var(--chart-1)',
  active,
  onClick,
  className,
}: KpiCardProps) {
  const points = (trend ?? []).map((v, i) => ({ i, v }))
  const gradientId = `kpi-${label.replace(/[^a-zA-Z0-9]/g, '')}`
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary [&_svg]:size-4"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className="mt-1 truncate text-2xl leading-tight font-semibold tracking-tight text-foreground tabular-nums"
        title={exactValue}
      >
        {value}
        {exactValue && <span className="sr-only"> ({exactValue})</span>}
      </p>
      <div className="mt-1 flex min-h-5 items-center">
        {delta ? (
          <DeltaPill delta={delta} />
        ) : hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {points.length >= 2 && (
        <div className="-mx-1 mt-2 h-10" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 2, right: 2, bottom: 0, left: 2 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trendColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={trendColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )

  const classes = cn(
    'relative gap-0 overflow-hidden p-4 shadow-xs transition-shadow',
    onClick && 'cursor-pointer hover:shadow-md',
    active && 'ring-2 ring-primary',
    className,
  )

  if (onClick) {
    return (
      <Card className={classes}>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          className="absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="sr-only">Lọc theo {label}</span>
        </button>
        {body}
      </Card>
    )
  }
  return <Card className={classes}>{body}</Card>
}
