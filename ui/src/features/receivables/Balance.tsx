import { HandCoins, PiggyBank, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/blocks/KpiCard'
import {
  DonutChart,
  LegendList,
  SegmentedMeter,
} from '@/components/charts/MebiusCharts'
import { Card } from '@/components/shadcn/card'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Alert } from '@/components/ui/Alert'
import { apiFetch } from '@/lib/api'
import { formatCompactVND, formatPercent, toNumber } from '@/lib/chart'
import { formatDate, formatVND } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuth } from '../authentication/useAuth'
import { DetailList } from '../payment_receipts/DetailList'
import {
  decimal,
  documentSummary,
  id,
  message,
  page,
  queryPath,
  record,
  type Row,
} from '../payment_receipts/contracts'
import { t } from '@/lib/i18n/core'

const RECEIPT_READERS = [
  'debt.read',
  'cash.receipt.prepare',
  'cash.receipt.post',
] as const

/** Latest posted payment receipt of the agency; `null` when there is none. */
function useLastPayment(agencyId: string, enabled: boolean) {
  const [state, setState] = useState<{
    agency: string
    row?: Row | null
    error?: string
  }>({ agency: '' })
  useEffect(() => {
    if (!enabled) return
    let current = true
    const controller = new AbortController()
    apiFetch<unknown>(
      queryPath('/payment-receipts', {
        agencyId: id(agencyId),
        status: 'POSTED',
        sort: '-businessDate',
        limit: '1',
      }),
      { signal: controller.signal },
    )
      .then((response) => {
        const rows = page(response.data, documentSummary).items
        if (current) setState({ agency: agencyId, row: rows[0] ?? null })
      })
      .catch((error: unknown) => {
        if (current) setState({ agency: agencyId, error: message(error) })
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [agencyId, enabled])
  return state.agency === agencyId ? state : undefined
}

function compact(value: unknown) {
  const raw = String(value)
  return { value: formatCompactVND(toNumber(raw)), exactValue: formatVND(raw) }
}

export function Balance({ agencyId }: { agencyId: string }) {
  const { hasPermission } = useAuth()
  const canReadReceipts = hasPermission([...RECEIPT_READERS])
  const [state, setState] = useState<{
    agency: string
    data?: Row
    error?: string
  }>({ agency: '' })
  const last = useLastPayment(agencyId, canReadReceipts)
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    apiFetch<unknown>(`/agencies/${id(agencyId)}/balance`, {
      signal: controller.signal,
    })
      .then((response) => {
        const data = record(response.data)
        for (const field of [
          'currentDebt',
          'currentCredit',
          'reservedCredit',
          'availableCredit',
          'maxDebt',
          'remainingCreditLimit',
        ])
          decimal(data[field])
        if (current) setState({ agency: agencyId, data })
      })
      .catch((error: unknown) => {
        if (current) setState({ agency: agencyId, error: message(error) })
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [agencyId])
  if (state.agency !== agencyId)
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">{t('Đang tải số dư...')}</span>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-10" />
      </div>
    )
  if (state.error) return <Alert type="error">{state.error}</Alert>
  const data = state.data!
  const debt = toNumber(String(data.currentDebt))
  const limit = toNumber(String(data.maxDebt))
  const usage = limit > 0 ? debt / limit : null
  const credit = toNumber(String(data.currentCredit))
  const usageColor =
    usage === null
      ? 'var(--chart-4)'
      : usage >= 1
        ? 'var(--destructive)'
        : usage >= 0.8
          ? 'var(--warning)'
          : 'var(--chart-1)'
  const creditParts = [
    {
      key: 'available',
      label: t('Khả dụng'),
      value: toNumber(String(data.availableCredit)),
      color: 'var(--success)',
    },
    {
      key: 'reserved',
      label: t('Đang giữ chỗ'),
      value: toNumber(String(data.reservedCredit)),
      color: 'var(--chart-3)',
    },
  ]
  const lastRow = last?.row
  const lastPayment = !canReadReceipts
    ? { value: '—', hint: t('Không có quyền xem phiếu thu') }
    : !last
      ? { value: '…', hint: t('Đang tải…') }
      : last.error
        ? { value: '—', hint: t('Không tải được phiếu thu') }
        : lastRow
          ? {
              ...compact(lastRow.totalAmount),
              hint: `${formatDate(String(lastRow.businessDate))} · ${String(lastRow.code)}`,
            }
          : { value: '—', hint: t('Chưa có phiếu thu đã ghi sổ') }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={t('Công nợ hiện tại')}
          icon={<Wallet />}
          {...compact(data.currentDebt)}
          delta={{
            ratio: null,
            upIsGood: false,
            label:
              usage === null
                ? t('Không giới hạn nợ')
                : t('{usage} hạn mức', { usage: formatPercent(usage) }),
          }}
        />
        <KpiCard
          label={t('Số dư có khả dụng')}
          icon={<PiggyBank />}
          {...compact(data.availableCredit)}
          hint={t('Đang giữ {toNumber}', {
            toNumber: formatCompactVND(toNumber(String(data.reservedCredit))),
          })}
        />
        <KpiCard
          label={t('Thanh toán gần nhất')}
          icon={<HandCoins />}
          value={lastPayment.value}
          exactValue={
            'exactValue' in lastPayment ? lastPayment.exactValue : undefined
          }
          hint={lastPayment.hint}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3 p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{t('Sử dụng hạn mức')}</span>
            {usage !== null && (
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  usage >= 1
                    ? 'text-destructive'
                    : usage >= 0.8
                      ? 'text-warning'
                      : 'text-foreground',
                )}
              >
                {formatPercent(usage)}
                {usage >= 1
                  ? t(' · Vượt hạn mức')
                  : usage >= 0.8
                    ? t(' · Sắp chạm hạn mức')
                    : ''}
              </span>
            )}
          </div>
          {usage === null ? (
            <p className="flex h-9 items-center text-sm text-muted-foreground">
              {t('Đại lý không đặt hạn mức nợ.')}
            </p>
          ) : (
            <SegmentedMeter
              ratio={usage}
              color={usageColor}
              label={t('Mức sử dụng hạn mức nợ')}
            />
          )}
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{t('Đã dùng {debt}', { debt: formatCompactVND(debt) })}</span>
            <span>
              {t('Còn {toNumber}', {
                toNumber: formatCompactVND(
                  toNumber(String(data.remainingCreditLimit)),
                ),
              })}
            </span>
          </div>
        </Card>
        <Card className="gap-2 p-4 shadow-xs">
          <span className="text-sm font-medium">{t('Cơ cấu dư có')}</span>
          {credit > 0 ? (
            <div className="flex items-center gap-3">
              <DonutChart
                data={creditParts}
                centerValue={formatCompactVND(credit)}
                centerLabel={t('dư có')}
                valueFormatter={formatCompactVND}
                height={112}
                className="max-w-28 shrink-0"
              />
              <LegendList
                className="min-w-0 flex-1 gap-1.5 text-xs"
                items={creditParts.map((part) => ({
                  key: part.key,
                  label: part.label,
                  color: part.color,
                  value: formatCompactVND(part.value),
                }))}
              />
            </div>
          ) : (
            <p className="flex h-28 items-center justify-center text-sm text-muted-foreground">
              {t('Chưa có dư có.')}
            </p>
          )}
        </Card>
      </div>
      <DetailList
        entries={[
          ['currentDebt', t('Dư nợ hiện tại')],
          ['maxDebt', t('Hạn mức nợ')],
          ['remainingCreditLimit', t('Hạn mức còn lại')],
          ['currentCredit', t('Dư có hiện tại')],
          ['reservedCredit', t('Dư có đang giữ')],
          ['availableCredit', t('Dư có khả dụng')],
        ].map(([field, label]) => [
          label!,
          <span key={field} className="tabular-nums">
            {formatVND(String(data[field!]))}
          </span>,
        ])}
      />
    </div>
  )
}
