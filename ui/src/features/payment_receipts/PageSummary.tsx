import { KpiCard, type KpiCardProps } from '@/components/blocks/KpiCard'
import { DonutChart, LegendList } from '@/components/charts/MebiusCharts'
import { Stagger, StaggerItem } from '@/components/motion/Motion'
import { Badge } from '@/components/shadcn/badge'
import { Card } from '@/components/shadcn/card'
import { formatCompactVND } from '@/lib/chart'

export interface SummaryGroup {
  key: string
  label: string
  count: number
  amount: number
  color: string
}

/**
 * KPI strip + status donut for the rows on the current page only. Clearly
 * labelled as page data so it is never mistaken for a server-wide total.
 */
export function PageSummary({
  title,
  noun,
  total,
  groups,
  kpis,
}: {
  title: string
  /** Row noun for the centre label, e.g. "giao dịch". */
  noun: string
  total: number
  groups: readonly SummaryGroup[]
  kpis: readonly KpiCardProps[]
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge
          variant="outline"
          className="border-info/30 bg-info/10 text-info"
          title="Chỉ tính các dòng đang hiển thị trên trang này"
        >
          Trang hiện tại · {total} {noun}
        </Badge>
      </div>
      <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.5fr)]">
        {kpis.map((kpi) => (
          <StaggerItem key={kpi.label}>
            <KpiCard {...kpi} className="h-full" />
          </StaggerItem>
        ))}
        <StaggerItem className="sm:col-span-2 xl:col-span-1">
          <Card className="h-full flex-row items-center gap-3 p-3 shadow-xs">
            <DonutChart
              data={groups.map((group) => ({
                key: group.key,
                label: group.label,
                value: group.count,
                color: group.color,
              }))}
              centerValue={String(total)}
              centerLabel={noun}
              valueFormatter={(value) => String(Math.round(value))}
              height={128}
              className="max-w-32 shrink-0"
            />
            <LegendList
              className="min-w-0 flex-1 gap-1.5 text-xs"
              items={groups.map((group) => ({
                key: group.key,
                label: group.label,
                color: group.color,
                value: `${group.count} · ${formatCompactVND(group.amount)}`,
              }))}
            />
          </Card>
        </StaggerItem>
      </Stagger>
    </section>
  )
}
