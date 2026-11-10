import {
  CircleCheck,
  CircleX,
  Clock3,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TimerOff,
} from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router'
import { DateField } from '@/components/blocks/DateField'
import { PageHeader } from '@/components/blocks/PageHeader'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { EntityPicker } from '@/components/ui/EntityPicker'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table } from '@/components/ui/Table'
import { apiFetch } from '@/lib/api'
import { invalidateCache } from '@/lib/cache'
import { formatDateTime, formatVND } from '@/lib/formatters'
import { enumOptions, statusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useAuth } from '../authentication/useAuth'
import {
  dateRangeParams,
  decimal,
  id,
  Intent,
  message,
  page,
  positiveMoney,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { DetailList } from '../payment_receipts/DetailList'
import {
  ActionBar,
  FilterBar,
  FormActions,
  SectionCard,
  TableCard,
  TableSkeleton,
} from '../payment_receipts/financeUi'
import { useSourcePage } from '../payment_receipts/useSourcePage'

const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'] as const

function optionalDateTime(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? formatDateTime(value) : fallback
}

function payment(value: unknown): Row {
  const data = record(value)
  id(data.id)
  id(data.agencyId)
  decimal(data.amount)
  text(data.provider)
  text(data.merchantReference)
  if (!['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].includes(text(data.status)))
    throw new Error('Invalid payment status')
  if (data.status === 'SUCCESS') {
    id(data.receiptDocumentId)
    text(data.paymentTime)
    text(data.providerTransactionId)
  } else if (data.receiptDocumentId !== null)
    throw new Error('Unverified payment cannot have a receipt')
  return data
}

function eventSummary(value: unknown): Row {
  const data = record(value)
  id(data.id)
  text(data.providerStatus)
  record(data.verifiedData)
  return data
}

function checkoutUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

export function OnlinePaymentsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('payments.online')
  const [searchParams] = useSearchParams()
  const requestedPaymentId = searchParams.get('paymentId')
  const requestedReference = searchParams.get('merchantReference')
  const [reference, setReference] = useState(requestedReference ?? '')
  const [agencyFilter, setAgencyFilter] = useState('')
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const range = dateRangeParams(
    fromDate,
    toDate,
    ['createdFrom', 'createdTo'],
    true,
  )
  const list = useSourcePage(
    '/online-payments',
    {
      merchantReference: reference,
      agencyId: agencyFilter,
      status,
      ...range.params,
    },
    payment,
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Row | null>(null)
  const [events, setEvents] = useState<Row[]>([])
  const [eventsMore, setEventsMore] = useState(false)
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState(false)
  const [agencyId, setAgencyId] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingSetupId, setPendingSetupId] = useState<string | null>(null)
  const intent = useRef(new Intent())
  const reloadList = useEffectEvent(() => {
    invalidateCache('/online-payments')
    list.reload()
  })

  useEffect(() => {
    if (requestedPaymentId === null && requestedReference === null) return
    const controller = new AbortController()
    let current = true
    const locate = async () => {
      if (requestedPaymentId === null && !requestedReference)
        throw new Error('Mã tham chiếu không hợp lệ.')
      const response = await apiFetch<unknown>(
        requestedPaymentId !== null
          ? `/online-payments/${id(requestedPaymentId)}`
          : `/online-payments?merchantReference=${encodeURIComponent(requestedReference!)}&limit=25`,
        { signal: controller.signal },
      )
      const item =
        requestedPaymentId !== null
          ? payment(response.data)
          : page(response.data, payment).items.find(
              (item) => item.merchantReference === requestedReference,
            )
      if (!item)
        throw new Error('Không tìm thấy giao dịch với mã tham chiếu này.')
      if (current) {
        setSelected(id(item.id))
        setDetail(item)
        setEvents([])
        setEventsMore(false)
        setError('')
        if (requestedReference) setReference(requestedReference)
      }
    }
    void locate().catch((failure: unknown) => {
      if (current) {
        setSelected(null)
        setDetail(null)
        setError(message(failure))
      }
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [requestedPaymentId, requestedReference])

  useEffect(() => {
    if (!selected) return
    const refresh = () => setVersion((value) => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [selected])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    let current = true
    apiFetch<unknown>(`/online-payments/${selected}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const item = payment(response.data)
        if (current) {
          setDetail(item)
          reloadList()
        }
      })
      .catch((failure: unknown) => {
        if (current) setError(message(failure))
      })
    if (canManage)
      apiFetch<unknown>(`/online-payments/${selected}/events?limit=25`, {
        signal: controller.signal,
      })
        .then((response) => {
          const result = page(response.data, eventSummary)
          if (current) {
            setEvents(result.items)
            setEventsMore(result.pagination.hasMore)
          }
        })
        .catch((failure: unknown) => {
          if (current) setError(message(failure))
        })
    return () => {
      current = false
      controller.abort()
    }
  }, [selected, version, canManage])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canManage) return
    setError('')
    setNotice('')
    try {
      const body = {
        agencyId: id(agencyId),
        provider: 'VNPAY',
        amount: positiveMoney(amount),
      }
      setBusy(true)
      const response = await intent.current.send<unknown>('/online-payments', {
        method: 'POST',
        body,
        retainAccepted: true,
      })
      const item = payment(response.data)
      setOpen(response.status === 202)
      setPendingSetupId(response.status === 202 ? id(item.id) : null)
      setSelected(id(item.id))
      setDetail(item)
      setNotice(
        response.status === 202
          ? 'Đang khởi tạo trang thanh toán. Giữ nguyên nội dung và bấm tiếp tục để hoàn tất cùng giao dịch này, không tạo giao dịch mới.'
          : 'Đã tạo giao dịch. Tiền chỉ được ghi nhận khi cổng thanh toán xác nhận thành công.',
      )
      invalidateCache('/online-payments')
      list.reload()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  const reconcile = async () => {
    if (!selected || busy || !canManage) return
    setBusy(true)
    setError('')
    try {
      const response = await intent.current.send<unknown>(
        `/online-payments/${selected}/reconcile`,
        { method: 'POST' },
      )
      setDetail(payment(response.data))
      setVersion((value) => value + 1)
      for (const prefix of [
        '/online-payments',
        '/payment-receipts',
        '/agencies',
        '/receivables',
      ])
        invalidateCache(prefix)
      list.reload()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const url = checkoutUrl(detail?.checkoutUrl)

  return (
    <div className="page-container space-y-6">
      <PageHeader
        eyebrow="Tài chính"
        title="Thanh toán trực tuyến"
        description="Tạo liên kết thanh toán VNPAY cho đại lý và theo dõi kết quả. Giao dịch chỉ được tính là đã thanh toán khi hệ thống xác nhận thành công."
        className="mb-0"
        actions={
          canManage && (
            <Button
              icon={<CreditCard className="size-4" />}
              onClick={() => setOpen(true)}
            >
              Tạo thanh toán mới
            </Button>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}
      <FilterBar>
        <Input
          label="Mã tham chiếu"
          placeholder="Mã tham chiếu chính xác"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <EntityPicker
          resource="agencies"
          label="Đại lý"
          value={agencyFilter}
          onChange={(value) => setAgencyFilter(value)}
          placeholder="Tất cả đại lý"
        />
        <Select
          label="Trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={enumOptions(PAYMENT_STATUSES, statusLabel, 'Tất cả')}
        />
        <DateField
          label="Tạo từ ngày"
          value={fromDate}
          onChange={setFromDate}
          max={toDate || undefined}
        />
        <DateField
          label="Đến ngày"
          value={toDate}
          onChange={setToDate}
          min={fromDate || undefined}
          error={range.error || undefined}
        />
        <Button
          variant="outline"
          icon={<RefreshCw className="size-4" />}
          onClick={list.reload}
        >
          Tải lại
        </Button>
      </FilterBar>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <TableCard
        title="Giao dịch trực tuyến"
        description="Trạng thái lấy từ hệ thống sau khi cổng thanh toán xác nhận, không lấy từ trang quay lại."
      >
        {list.loading ? (
          <TableSkeleton label="Đang tải giao dịch..." />
        ) : !list.items.length ? (
          <div className="p-4">
            <EmptyState
              icon={<CreditCard className="size-6" />}
              title="Không có giao dịch phù hợp."
            />
          </div>
        ) : (
          <Table caption="Danh sách giao dịch trực tuyến">
            <thead>
              <tr>
                <th scope="col">Mã tham chiếu</th>
                <th scope="col">Đại lý</th>
                <th scope="col">Cổng</th>
                <th scope="col">Thời điểm thanh toán</th>
                <th scope="col" className="cell-number">
                  Số tiền
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="cell-actions">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={String(item.id)}>
                  <td>
                    <span className="font-mono text-xs">
                      {String(item.merchantReference)}
                    </span>
                  </td>
                  <td>
                    {typeof item.agencyName === 'string'
                      ? item.agencyName
                      : `#${String(item.agencyId)}`}
                  </td>
                  <td>{String(item.provider)}</td>
                  <td className="tabular-nums">
                    {optionalDateTime(item.paymentTime, '—')}
                  </td>
                  <td className="cell-number font-medium">
                    {formatVND(String(item.amount))}
                  </td>
                  <td>
                    <StatusBadge status={String(item.status)} />
                  </td>
                  <td className="cell-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Chi tiết ${String(item.merchantReference)}`}
                      onClick={() => {
                        setSelected(String(item.id))
                        setDetail(null)
                        setEvents([])
                        setError('')
                      }}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination
          hasNext={list.hasMore}
          hasPrevious={list.hasPrevious}
          onNext={list.next}
          onPrevious={list.previous}
          totalShowing={list.loading ? undefined : list.items.length}
        />
      </TableCard>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Tạo thanh toán trực tuyến"
      >
        <form onSubmit={create} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {notice && <Alert type="info">{notice}</Alert>}
          <EntityPicker
            resource="agencies"
            label="Đại lý thanh toán"
            value={agencyId}
            onChange={(value) => setAgencyId(value)}
            required
          />
          <Input
            label="Số tiền thanh toán (VND nguyên)"
            inputMode="numeric"
            className="text-right tabular-nums"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            helperText={
              /^[1-9][0-9]{0,17}$/.test(amount) ? formatVND(amount) : undefined
            }
            required
          />
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-muted-foreground">
              Cổng thanh toán: VNPAY. Đại lý thanh toán trên trang của cổng;
              tiền chỉ được ghi nhận khi hệ thống nhận xác nhận hợp lệ.
            </p>
          </div>
          <FormActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Đóng
            </Button>
            <Button type="submit" isLoading={busy}>
              {pendingSetupId
                ? 'Tiếp tục khởi tạo thanh toán'
                : 'Khởi tạo thanh toán'}
            </Button>
          </FormActions>
        </form>
      </Modal>
      <Modal
        isOpen={!!selected && !open}
        onClose={() => {
          setSelected(null)
          setDetail(null)
        }}
        title="Chi tiết giao dịch"
        maxWidth="lg"
      >
        {!detail ? (
          <div role="status" className="space-y-3">
            <span className="sr-only">Đang tải chi tiết...</span>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <PaymentStatusPanel
              status={String(detail.status)}
              amount={formatVND(String(detail.amount))}
            />
            <DetailList
              entries={[
                [
                  'Mã tham chiếu',
                  <span key="ref" className="font-mono text-xs">
                    {String(detail.merchantReference)}
                  </span>,
                ],
                ['Đại lý', `#${String(detail.agencyId)}`],
                ['Cổng thanh toán', String(detail.provider)],
                [
                  'Mã giao dịch cổng',
                  typeof detail.providerTransactionId === 'string'
                    ? detail.providerTransactionId
                    : 'Chưa có',
                ],
                [
                  'Phiếu thu',
                  detail.receiptDocumentId
                    ? `#${String(detail.receiptDocumentId)}`
                    : 'Chưa có',
                ],
                [
                  'Thời điểm thanh toán',
                  optionalDateTime(detail.paymentTime, 'Chưa xác nhận'),
                ],
                ['Hết hạn lúc', optionalDateTime(detail.expiresAt, '—')],
              ]}
            />
            <ActionBar>
              <Button
                variant="ghost"
                icon={<RefreshCw className="size-4" />}
                onClick={() => setVersion((value) => value + 1)}
              >
                Kiểm tra trạng thái
              </Button>
              {canManage && detail.status !== 'SUCCESS' && (
                <Button variant="outline" disabled={busy} onClick={reconcile}>
                  Đối soát giao dịch hiện tại
                </Button>
              )}
              {canManage && selected === pendingSetupId && (
                <Button disabled={busy} onClick={() => setOpen(true)}>
                  Tiếp tục khởi tạo thanh toán
                </Button>
              )}
              {url && detail.status === 'PENDING' && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Mở trang thanh toán
                </a>
              )}
            </ActionBar>
            {canManage && (
              <SectionCard
                title="Lịch sử phản hồi từ cổng thanh toán"
                description="Các phản hồi đã được hệ thống kiểm tra chữ ký."
              >
                {events.length ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table caption="Lịch sử phản hồi từ cổng thanh toán">
                      <thead>
                        <tr>
                          <th scope="col">Thời điểm</th>
                          <th scope="col">Mã giao dịch cổng</th>
                          <th scope="col" className="cell-number">
                            Số tiền
                          </th>
                          <th scope="col">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((event) => {
                          const verified = record(event.verifiedData)
                          return (
                            <tr key={String(event.id)}>
                              <td className="tabular-nums">
                                {optionalDateTime(event.createdAt, '—')}
                              </td>
                              <td>
                                {typeof verified.providerTransactionId ===
                                'string'
                                  ? verified.providerTransactionId
                                  : '—'}
                              </td>
                              <td className="cell-number">
                                {typeof verified.amount === 'string'
                                  ? formatVND(verified.amount)
                                  : '—'}
                              </td>
                              <td>
                                <StatusBadge
                                  status={String(event.providerStatus)}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có phản hồi nào.
                  </p>
                )}
                {eventsMore && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Chỉ hiển thị 25 phản hồi đầu tiên.
                  </p>
                )}
              </SectionCard>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

const STATUS_VIEWS: Record<
  string,
  {
    icon: ReactNode
    title: string
    description: string
    tone: string
  }
> = {
  PENDING: {
    icon: <Clock3 />,
    title: 'Đang chờ cổng thanh toán xác nhận',
    description:
      'Việc quay lại từ trang VNPAY không có nghĩa là đã thanh toán. Hệ thống chỉ ghi nhận tiền khi nhận được xác nhận hợp lệ từ cổng; hãy kiểm tra trạng thái hoặc đối soát.',
    tone: 'border-amber-200 bg-amber-50/70 text-amber-700',
  },
  SUCCESS: {
    icon: <CircleCheck />,
    title: 'Đã ghi nhận thanh toán',
    description:
      'Cổng thanh toán đã xác nhận giao dịch và hệ thống đã lập phiếu thu tự động.',
    tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
  },
  FAILED: {
    icon: <CircleX />,
    title: 'Thanh toán không thành công',
    description:
      'Cổng thanh toán báo giao dịch thất bại. Không có tiền được ghi nhận; có thể tạo giao dịch mới.',
    tone: 'border-red-200 bg-red-50/70 text-red-700',
  },
  EXPIRED: {
    icon: <TimerOff />,
    title: 'Liên kết thanh toán đã hết hạn',
    description:
      'Liên kết không còn dùng được và không có tiền được ghi nhận. Hãy tạo giao dịch mới nếu cần.',
    tone: 'border-border bg-muted/60 text-muted-foreground',
  },
}

/** Server-confirmed payment state with icon, explanation and amount. */
function PaymentStatusPanel({
  status,
  amount,
}: {
  status: string
  amount: string
}) {
  const view = STATUS_VIEWS[status] ?? STATUS_VIEWS.PENDING!
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        view.tone,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-xs [&_svg]:size-5"
          aria-hidden="true"
        >
          {view.icon}
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{view.title}</span>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-foreground/75">{view.description}</p>
        </div>
      </div>
      <div className="shrink-0 sm:text-right">
        <p className="text-xs font-medium text-foreground/70">Số tiền</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {amount}
        </p>
      </div>
    </div>
  )
}
