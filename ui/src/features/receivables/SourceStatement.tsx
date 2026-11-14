import { RefreshCw } from 'lucide-react'
import { useId, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartCard } from '@/components/blocks/ChartCard'
import { DateField } from '@/components/blocks/DateField'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/shadcn/chart'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { CHART_AXIS, CHART_GRID, formatCompact } from '@/lib/chart'
import { formatDate, formatQuantity, formatVND } from '@/lib/formatters'
import { kindLabel } from '@/lib/labels'
import {
  businessDate,
  dateRangeParams,
  decimal,
  id,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { TableSkeleton } from '../payment_receipts/financeUi'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { balanceSeries, type BalancePoint } from './statementModel'
import { t } from '@/lib/i18n/core'

/** Inventory statements carry quantities; receivable/credit ones carry money. */
function amount(value: unknown, quantity: boolean): string {
  const raw = decimal(value)
  return quantity ? formatQuantity(raw) : formatVND(raw)
}

function entry(value: unknown): Row {
  const data = record(value)
  id(data.id)
  id(data.sourceDocumentId)
  text(data.sourceDocumentCode)
  businessDate(data.businessDate)
  decimal(data.balanceAfter)
  decimal(data.quantityDelta ?? data.amountDelta)
  if (typeof data.isEffective !== 'boolean')
    throw new Error('Invalid effective entry')
  return data
}

function BalanceChart({
  title,
  points,
  quantity,
}: {
  title: string
  points: BalancePoint[]
  quantity: boolean
}) {
  const config = {
    balance: { label: t('Số dư sau'), color: 'var(--chart-1)' },
  } satisfies ChartConfig
  const fillId = `balance-fill-${useId().replace(/:/g, '')}`
  const label = (raw: string) =>
    quantity ? formatQuantity(raw) : formatVND(raw)
  return (
    <ChartCard
      title={title}
      description={t('Số dư sau mỗi dòng còn hiệu lực trên trang hiện tại.')}
      isEmpty={points.length < 2}
      empty={
        <p className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
          {t('Cần ít nhất hai dòng còn hiệu lực để vẽ diễn biến số dư.')}
        </p>
      }
      table={
        <Table
          caption={t('Bảng số liệu {title}', { title: title.toLowerCase() })}
        >
          <thead>
            <tr>
              <th scope="col">{t('Ngày')}</th>
              <th scope="col">{t('Chứng từ')}</th>
              <th scope="col" className="cell-number">
                {t('Số dư sau')}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key}>
                <td className="tabular-nums">{point.date}</td>
                <td>{point.code}</td>
                <td className="cell-number">{label(point.raw)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      }
    >
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-balance)"
                stopOpacity={0.22}
              />
              <stop
                offset="100%"
                stopColor="var(--color-balance)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_GRID} />
          <XAxis
            dataKey="key"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            tickFormatter={(key: string) =>
              (points.find((point) => point.key === key)?.date ?? '').slice(
                0,
                5,
              )
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            tickFormatter={(value: number) => formatCompact(value)}
          />
          <ChartTooltip
            cursor={{ stroke: CHART_AXIS, strokeDasharray: '3 3' }}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as
                    BalancePoint | undefined
                  return point ? `${point.date} · ${point.code}` : ''
                }}
                formatter={(_, __, item) => {
                  const point = item.payload as BalancePoint
                  return (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {t('Số dư sau')}
                      </span>
                      <span className="font-medium tabular-nums">
                        {label(point.raw)}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          <Area
            dataKey="balance"
            type="stepAfter"
            stroke="var(--color-balance)"
            strokeWidth={2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  )
}

export function SourceStatement({
  path,
  title,
  opening,
  closing,
  chart = false,
  chartTitle = t('Diễn biến số dư'),
  increaseLabel = t('Tăng'),
  decreaseLabel = t('Giảm'),
}: {
  path: string
  title: string
  opening: string
  closing: string
  /** Show a running-balance chart above the entries. */
  chart?: boolean
  chartTitle?: string
  increaseLabel?: string
  decreaseLabel?: string
}) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [effectiveOnly, setEffectiveOnly] = useState('true')
  const range = dateRangeParams(fromDate, toDate)
  const list = useSourcePage(
    path,
    { ...range.params, effectiveOnly, sort: 'businessDate' },
    entry,
  )
  const quantity =
    list.metadata?.unitId !== undefined ||
    list.items.some((item) => item.quantityDelta !== undefined)
  const showKind =
    !quantity && list.items.some((item) => typeof item.kind === 'string')
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
      <h2 className="text-base font-semibold">{title}</h2>
      <div
        data-slot="filter-bar"
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <DateField
          label={t('Từ ngày')}
          value={fromDate}
          onChange={setFromDate}
          max={toDate || undefined}
        />
        <DateField
          label={t('Đến ngày')}
          value={toDate}
          onChange={setToDate}
          min={fromDate || undefined}
          error={range.error || undefined}
        />
        <Select
          label={t('Hiệu lực')}
          value={effectiveOnly}
          onChange={(event) => setEffectiveOnly(event.target.value)}
          options={[
            { value: 'true', label: t('Còn hiệu lực') },
            { value: 'false', label: t('Gồm dòng đảo') },
          ]}
        />
        <Button
          variant="outline"
          icon={<RefreshCw className="size-4" />}
          onClick={list.reload}
        >
          {t('Tải lại')}
        </Button>
      </div>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.metadata && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{t('Đầu kỳ')}</dt>
            <dd className="cell-number text-start text-base font-semibold">
              {amount(list.metadata[opening], quantity)}
            </dd>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{t('Cuối kỳ')}</dt>
            <dd className="cell-number text-start text-base font-semibold">
              {amount(list.metadata[closing], quantity)}
            </dd>
          </div>
          {list.metadata.unitId !== undefined && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{t('Đơn vị')}</dt>
              <dd className="text-base font-semibold">
                #{String(list.metadata.unitId)}
              </dd>
            </div>
          )}
        </dl>
      )}
      {chart && !list.loading && !list.error && (
        <BalanceChart
          title={chartTitle}
          points={balanceSeries(list.items)}
          quantity={quantity}
        />
      )}
      <div className="overflow-hidden rounded-lg border">
        {list.loading ? (
          <TableSkeleton rows={4} label={t('Đang tải sổ...')} />
        ) : list.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={t('Không có biến động trong bộ lọc.')}
              description={t('Thử đổi khoảng ngày hoặc chọn “Gồm dòng đảo”.')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table caption={title}>
              <thead>
                <tr>
                  <th scope="col">{t('Ngày nghiệp vụ')}</th>
                  <th scope="col">{t('Chứng từ nguồn')}</th>
                  {showKind && <th scope="col">{t('Loại')}</th>}
                  <th scope="col" className="cell-number">
                    {increaseLabel}
                  </th>
                  <th scope="col" className="cell-number">
                    {decreaseLabel}
                  </th>
                  <th scope="col" className="cell-number">
                    {t('Số dư sau')}
                  </th>
                  <th scope="col">{t('Hiệu lực')}</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => {
                  const delta = decimal(item.quantityDelta ?? item.amountDelta)
                  const negative = delta.startsWith('-')
                  const zero = /^-?0(\.0+)?$/.test(delta)
                  return (
                    <tr
                      key={String(item.id)}
                      className={item.isEffective ? undefined : 'opacity-60'}
                    >
                      <td className="tabular-nums">
                        {formatDate(String(item.businessDate))}
                      </td>
                      <td>
                        {String(item.sourceDocumentCode)}
                        {item.sourceRevisionNo !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            {t('Phiên bản {sourceRevisionNo}', {
                              sourceRevisionNo: String(item.sourceRevisionNo),
                            })}
                          </div>
                        )}
                      </td>
                      {showKind && <td>{kindLabel(item.kind)}</td>}
                      <td className="cell-number">
                        {!negative && !zero ? amount(delta, quantity) : '—'}
                      </td>
                      <td className="cell-number">
                        {negative && !zero
                          ? amount(delta.slice(1), quantity)
                          : '—'}
                      </td>
                      <td className="cell-number font-medium">
                        {amount(item.balanceAfter, quantity)}
                      </td>
                      <td>
                        {item.isEffective ? (
                          <Badge variant="success">{t('Hiệu lực')}</Badge>
                        ) : (
                          <Badge variant="neutral">{t('Đã đảo')}</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
        <Pagination
          hasNext={list.hasMore}
          hasPrevious={list.hasPrevious}
          onNext={list.next}
          onPrevious={list.previous}
          isLoading={list.loading}
          totalShowing={list.loading ? undefined : list.items.length}
        />
      </div>
    </section>
  )
}
