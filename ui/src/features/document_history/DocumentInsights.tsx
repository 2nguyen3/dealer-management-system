import { FileStack, Wallet } from 'lucide-react'
import { memo } from 'react'
import { ChartCard } from '../../components/blocks/ChartCard'
import { KpiCard } from '../../components/blocks/KpiCard'
import {
  DonutChart,
  LegendList,
  RoundedBarChart,
} from '../../components/charts/MebiusCharts'
import { CountUp } from '../../components/motion/Motion'
import { Badge as ShadcnBadge } from '../../components/shadcn/badge'
import { Table } from '../../components/ui/Table'
import { formatCompactVND, toNumber } from '../../lib/chart'
import { formatDate, formatVND } from '../../lib/formatters'
import type { DocumentSummary } from './documentContracts'
import { pageTotal, statusParts, valueByDay } from './insightsModel'
import { t } from '@/lib/i18n/core'

/**
 * Visual summary of the loaded list page: KPI tiles, a status donut and value
 * per business date. Every figure is derived from the rows already loaded.
 */
export const DocumentInsights = memo(function DocumentInsights({
  items,
  partial,
}: {
  items: readonly DocumentSummary[]
  /** True when more pages exist, so figures describe this page only. */
  partial: boolean
}) {
  if (!items.length) return null
  const total = pageTotal(items)
  const parts = statusParts(items)
  const days = valueByDay(items)
  const scope = partial ? t('Trang hiện tại') : t('Toàn bộ kết quả')
  return (
    <section
      aria-label={t('Tổng quan danh sách')}
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,13rem)_minmax(0,19rem)_minmax(0,1fr)]"
    >
      <div className="grid gap-4 sm:grid-cols-2 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
        <KpiCard
          label={t('Số chứng từ')}
          value={<CountUp value={items.length} />}
          icon={<FileStack />}
          hint={scope}
        />
        <KpiCard
          label={t('Tổng giá trị')}
          value={
            <CountUp
              value={toNumber(total.toString())}
              format={(value) => formatCompactVND(value)}
            />
          }
          icon={<Wallet />}
          hint={scope}
        />
      </div>
      <ChartCard
        title={t('Trạng thái')}
        actions={
          <ShadcnBadge variant="secondary" className="font-normal">
            {scope}
          </ShadcnBadge>
        }
        contentClassName="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3"
      >
        <DonutChart
          data={parts}
          centerLabel={t('chứng từ')}
          centerValue={String(items.length)}
          valueFormatter={(value) => String(value)}
          height={136}
        />
        <LegendList
          className="text-xs"
          items={parts.map((part) => ({
            key: part.key,
            label: part.label,
            value: part.value,
            color: part.color,
          }))}
        />
      </ChartCard>
      <ChartCard
        title={t('Giá trị theo ngày')}
        isEmpty={days.length === 0}
        table={
          <Table caption={t('Giá trị chứng từ theo ngày')}>
            <thead>
              <tr>
                <th>{t('Ngày')}</th>
                <th className="cell-number">{t('Giá trị')}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day}>
                  <td className="tabular-nums">{formatDate(day.day)}</td>
                  <td className="cell-number">{formatVND(day.exact)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        }
      >
        <RoundedBarChart
          data={days}
          xKey="label"
          series={[
            { key: 'value', label: t('Giá trị'), color: 'var(--chart-1)' },
          ]}
          height={150}
        />
      </ChartCard>
    </section>
  )
})
