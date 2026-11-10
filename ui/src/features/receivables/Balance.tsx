import { HandCoins, PiggyBank, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/blocks/KpiCard'
import { Progress } from '@/components/shadcn/progress'
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
        <span className="sr-only">Đang tải số dư...</span>
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
  const lastRow = last?.row
  const lastPayment = !canReadReceipts
    ? { value: '—', hint: 'Không có quyền xem phiếu thu' }
    : !last
      ? { value: '…', hint: 'Đang tải…' }
      : last.error
        ? { value: '—', hint: 'Không tải được phiếu thu' }
        : lastRow
          ? {
              ...compact(lastRow.totalAmount),
              hint: `${formatDate(String(lastRow.businessDate))} · ${String(lastRow.code)}`,
            }
          : { value: '—', hint: 'Chưa có phiếu thu đã ghi sổ' }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Công nợ hiện tại"
          icon={<Wallet />}
          {...compact(data.currentDebt)}
          delta={{
            ratio: null,
            upIsGood: false,
            label:
              usage === null
                ? 'Không giới hạn nợ'
                : `${formatPercent(usage)} hạn mức`,
          }}
        />
        <KpiCard
          label="Số dư có khả dụng"
          icon={<PiggyBank />}
          {...compact(data.availableCredit)}
          hint={`Đang giữ ${formatCompactVND(toNumber(String(data.reservedCredit)))}`}
        />
        <KpiCard
          label="Thanh toán gần nhất"
          icon={<HandCoins />}
          value={lastPayment.value}
          exactValue={
            'exactValue' in lastPayment ? lastPayment.exactValue : undefined
          }
          hint={lastPayment.hint}
        />
      </div>
      {usage !== null && (
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">Mức sử dụng hạn mức nợ</span>
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
                ? ' · Vượt hạn mức'
                : usage >= 0.8
                  ? ' · Sắp chạm hạn mức'
                  : ''}
            </span>
          </div>
          <Progress
            value={Math.min(100, usage * 100)}
            aria-label="Mức sử dụng hạn mức nợ"
          />
        </div>
      )}
      <DetailList
        entries={[
          ['currentDebt', 'Dư nợ hiện tại'],
          ['maxDebt', 'Hạn mức nợ'],
          ['remainingCreditLimit', 'Hạn mức còn lại'],
          ['currentCredit', 'Dư có hiện tại'],
          ['reservedCredit', 'Dư có đang giữ'],
          ['availableCredit', 'Dư có khả dụng'],
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
