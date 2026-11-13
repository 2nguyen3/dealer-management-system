import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  Hourglass,
  QrCode,
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
import QRCode from 'react-qr-code'
import { useSearchParams } from 'react-router'
import { DateField } from '@/components/blocks/DateField'
import { PageHeader } from '@/components/blocks/PageHeader'
import { SortableHeader } from '@/components/data/SortControls'
import { nextSort, useSort } from '@/components/data/sorting'
import { CountUp } from '@/components/motion/Motion'
import { Badge as ShadcnBadge } from '@/components/shadcn/badge'
import { Button as ShadcnButton } from '@/components/shadcn/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/shadcn/popover'
import { Separator } from '@/components/shadcn/separator'
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
import { formatCompactVND } from '@/lib/chart'
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
import { groupTotals, type FlowStep } from '../payment_receipts/flow'
import { FlowSteps } from '../payment_receipts/FlowSteps'
import { PageSummary } from '../payment_receipts/PageSummary'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { paymentFlowSteps } from './paymentFlow'

const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'] as const
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'var(--warning)',
  SUCCESS: 'var(--success)',
  FAILED: 'var(--destructive)',
  EXPIRED: 'var(--chart-4)',
}
/** Server sort enum for GET /online-payments: createdAt, id (±). */
const DEFAULT_SORT = '-createdAt'
const WIZARD = ['Thông tin', 'Xác nhận', 'Thanh toán'] as const
type CreateStep = 'form' | 'confirm' | 'handoff'

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
  const sorter = useSort(DEFAULT_SORT)
  const onSort = (field: string, first?: 'asc' | 'desc') =>
    sorter.setSort(nextSort(sorter.sort, field, first) || DEFAULT_SORT)
  const list = useSourcePage(
    '/online-payments',
    {
      merchantReference: reference,
      agencyId: agencyFilter,
      status,
      ...range.params,
      sort: sorter.sort,
    },
    payment,
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Row | null>(null)
  const [events, setEvents] = useState<Row[]>([])
  const [eventsMore, setEventsMore] = useState(false)
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>('form')
  const [agencyId, setAgencyId] = useState('')
  const [agencyLabel, setAgencyLabel] = useState('')
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

  /** Opens the create flow; an accepted (202) setup resumes at confirmation. */
  const openCreate = () => {
    setError('')
    if (!pendingSetupId) setNotice('')
    setCreateStep(pendingSetupId ? 'confirm' : 'form')
    setOpen(true)
  }

  const closeCreate = () => {
    setOpen(false)
    if (createStep === 'handoff') {
      setSelected(null)
      setDetail(null)
      setCreateStep('form')
    }
  }

  const review = () => {
    setError('')
    try {
      if (!agencyId) throw new Error('Vui lòng chọn đại lý thanh toán.')
      id(agencyId)
      positiveMoney(amount)
      setCreateStep('confirm')
    } catch (failure) {
      setError(message(failure))
    }
  }

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
      const accepted = response.status === 202
      setOpen(true)
      setCreateStep(accepted ? 'confirm' : 'handoff')
      setPendingSetupId(accepted ? id(item.id) : null)
      setSelected(id(item.id))
      setDetail(item)
      if (!accepted) {
        setAgencyId('')
        setAgencyLabel('')
        setAmount('')
      }
      setNotice(
        accepted
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
  const payable = !!url && detail?.status === 'PENDING'
  const detailSteps = detail
    ? paymentFlowSteps(detail.status, detail.receiptDocumentId)
    : null
  const groups = groupTotals(
    list.items,
    'status',
    'amount',
    PAYMENT_STATUSES,
  ).map((group) => ({
    ...group,
    label: statusLabel(group.key),
    color: STATUS_COLORS[group.key] ?? 'var(--chart-4)',
  }))
  const group = (key: string) => groups.find((entry) => entry.key === key)
  const stopped = (group('FAILED')?.count ?? 0) + (group('EXPIRED')?.count ?? 0)
  const wizardIndex =
    createStep === 'form' ? 0 : createStep === 'confirm' ? 1 : 2

  return (
    <div className="page-container space-y-6">
      <PageHeader
        eyebrow="Tài chính"
        title="Thanh toán trực tuyến"
        description="Tạo giao dịch → đại lý trả trên VNPAY → cổng xác nhận (IPN) → phiếu thu tự động."
        className="mb-0"
        actions={
          canManage && (
            <Button
              icon={<CreditCard className="size-4" />}
              onClick={openCreate}
            >
              Tạo thanh toán mới
            </Button>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}
      {!list.loading && list.items.length > 0 && (
        <PageSummary
          title="Tổng quan giao dịch"
          noun="giao dịch"
          total={list.items.length}
          groups={groups}
          kpis={[
            {
              label: 'Đã ghi nhận',
              icon: <BadgeCheck />,
              value: formatCompactVND(group('SUCCESS')?.amount ?? 0),
              hint: `${group('SUCCESS')?.count ?? 0} giao dịch có phiếu thu`,
            },
            {
              label: 'Chờ cổng xác nhận',
              icon: <Hourglass />,
              value: formatCompactVND(group('PENDING')?.amount ?? 0),
              hint: `${group('PENDING')?.count ?? 0} giao dịch`,
            },
            {
              label: 'Không thành công',
              icon: <CircleX />,
              value: <CountUp value={stopped} />,
              hint: 'Thất bại hoặc hết hạn',
            },
          ]}
        />
      )}
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
        description="Trạng thái theo xác nhận IPN của cổng."
        icon={<Globe />}
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
                <SortableHeader
                  field="createdAt"
                  sort={sorter.sort}
                  onSort={onSort}
                  firstDirection="desc"
                >
                  Tạo lúc
                </SortableHeader>
                <th scope="col">Thời điểm thanh toán</th>
                <th scope="col" className="cell-number">
                  Số tiền
                </th>
                <th scope="col">Tiến trình</th>
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
                    <div className="text-[0.7rem] text-muted-foreground">
                      {String(item.provider)}
                    </div>
                  </td>
                  <td>
                    {typeof item.agencyName === 'string'
                      ? item.agencyName
                      : `#${String(item.agencyId)}`}
                  </td>
                  <td className="tabular-nums">
                    {optionalDateTime(item.createdAt, '—')}
                  </td>
                  <td className="tabular-nums">
                    {optionalDateTime(item.paymentTime, '—')}
                  </td>
                  <td className="cell-number font-medium">
                    {formatVND(String(item.amount))}
                  </td>
                  <td>
                    <MiniFlow
                      steps={paymentFlowSteps(
                        item.status,
                        item.receiptDocumentId,
                      )}
                    />
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
        onClose={closeCreate}
        title="Tạo thanh toán trực tuyến"
        maxWidth={createStep === 'handoff' ? 'lg' : 'md'}
      >
        <div className="space-y-4">
          <WizardSteps current={wizardIndex} />
          {error && <Alert type="error">{error}</Alert>}
          {notice && <Alert type="info">{notice}</Alert>}
          {createStep === 'form' && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                review()
              }}
              className="space-y-4"
            >
              <EntityPicker
                resource="agencies"
                label="Đại lý thanh toán"
                value={agencyId}
                onChange={(value, item) => {
                  setAgencyId(value)
                  setAgencyLabel(item?.label ?? '')
                }}
                required
              />
              <Input
                label="Số tiền thanh toán (VND nguyên)"
                inputMode="numeric"
                className="text-right tabular-nums"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                helperText={
                  /^[1-9][0-9]{0,17}$/.test(amount)
                    ? formatVND(amount)
                    : undefined
                }
                required
              />
              <FormActions>
                <Button type="button" variant="outline" onClick={closeCreate}>
                  Đóng
                </Button>
                <Button type="submit" icon={<ArrowRight className="size-4" />}>
                  Tiếp tục
                </Button>
              </FormActions>
            </form>
          )}
          {createStep === 'confirm' && (
            <form onSubmit={create} className="space-y-4">
              <DetailList
                entries={[
                  ['Đại lý', agencyLabel || `#${agencyId}`],
                  [
                    'Số tiền',
                    <span
                      key="amount"
                      className="text-lg font-semibold tabular-nums"
                    >
                      {/^[1-9][0-9]{0,17}$/.test(amount)
                        ? formatVND(amount)
                        : amount}
                    </span>,
                  ],
                  ['Cổng thanh toán', 'VNPAY'],
                  ['Ghi nhận khi', 'Cổng xác nhận (IPN) thành công'],
                ]}
              />
              <div className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/8 p-3 text-xs text-foreground/80">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-info"
                  aria-hidden="true"
                />
                <span>
                  Trang quay lại từ VNPAY không phải là xác nhận. Chỉ IPN hợp lệ
                  mới lập phiếu thu.
                </span>
              </div>
              <FormActions>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<ArrowLeft className="size-4" />}
                  onClick={() => {
                    setError('')
                    setCreateStep('form')
                  }}
                >
                  Quay lại
                </Button>
                <Button type="button" variant="outline" onClick={closeCreate}>
                  Đóng
                </Button>
                <Button type="submit" isLoading={busy}>
                  {pendingSetupId
                    ? 'Tiếp tục khởi tạo thanh toán'
                    : 'Khởi tạo thanh toán'}
                </Button>
              </FormActions>
            </form>
          )}
          {createStep === 'handoff' && detail && (
            <div className="space-y-4">
              {detailSteps && (
                <FlowSteps label="Tiến trình thanh toán" steps={detailSteps} />
              )}
              <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                {payable ? (
                  <CheckoutQr url={url} size={152} />
                ) : (
                  <div className="flex size-40 items-center justify-center rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                    {detail.status === 'PENDING'
                      ? 'Chưa có liên kết'
                      : 'Không cần thanh toán'}
                  </div>
                )}
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Số tiền cần trả
                    </p>
                    <p className="text-3xl font-semibold tracking-tight tabular-nums">
                      {formatVND(String(detail.amount))}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {String(detail.merchantReference)}
                    </p>
                  </div>
                  {payable && <CheckoutActions url={url} />}
                  <p className="text-xs text-muted-foreground">
                    Gửi mã QR hoặc liên kết cho đại lý. Trạng thái chỉ đổi khi
                    cổng xác nhận.
                  </p>
                </div>
              </div>
              <ActionBar>
                <Button
                  variant="ghost"
                  icon={<RefreshCw className="size-4" />}
                  onClick={() => setVersion((value) => value + 1)}
                >
                  Kiểm tra trạng thái
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    setCreateStep('form')
                  }}
                >
                  Xem chi tiết
                </Button>
                <Button onClick={closeCreate}>Xong</Button>
              </ActionBar>
            </div>
          )}
        </div>
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
            {detailSteps && (
              <FlowSteps label="Tiến trình thanh toán" steps={detailSteps} />
            )}
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
                <Button disabled={busy} onClick={openCreate}>
                  Tiếp tục khởi tạo thanh toán
                </Button>
              )}
              {payable && (
                <Popover>
                  <PopoverTrigger asChild>
                    <ShadcnButton variant="outline">
                      <QrCode className="size-4" aria-hidden="true" />
                      Mã QR
                    </ShadcnButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3">
                    <CheckoutQr url={url} size={176} />
                  </PopoverContent>
                </Popover>
              )}
              {payable && <CheckoutLink url={url} />}
            </ActionBar>
            {canManage && (
              <SectionCard
                title="Phản hồi từ cổng thanh toán"
                description="Đã kiểm tra chữ ký."
                icon={<ShieldCheck />}
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

/** "1 Thông tin — 2 Xác nhận — 3 Thanh toán" header of the create dialog. */
function WizardSteps({ current }: { current: number }) {
  return (
    <ol
      className="flex items-center gap-2"
      aria-label="Các bước tạo thanh toán"
    >
      {WIZARD.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? 'step' : undefined}
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            index > 0 && 'flex-1',
          )}
        >
          {index > 0 && (
            <Separator
              className={cn(
                'mr-1 flex-1 transition-colors duration-500',
                index <= current && 'bg-primary',
              )}
            />
          )}
          <ShadcnBadge
            variant={index <= current ? 'default' : 'outline'}
            className="size-5 justify-center rounded-full p-0 tabular-nums"
          >
            {index < current ? <CircleCheck /> : index + 1}
          </ShadcnBadge>
          <span
            className={cn(
              index === current ? 'text-foreground' : 'text-muted-foreground',
              index !== current && 'hidden sm:inline',
            )}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Four dots in a table cell: the server-derived position in the VNPAY flow. */
function MiniFlow({ steps }: { steps: FlowStep[] | null }) {
  if (!steps) return <span className="text-xs text-muted-foreground">—</span>
  const done = steps.filter((step) => step.state === 'done').length
  const stop = steps.find(
    (step) => step.state === 'failed' || step.state === 'expired',
  )
  const current = steps.find((step) => step.state === 'current')
  const summary = stop
    ? `dừng ở ${stop.label}`
    : current
      ? `đang ở ${current.label}`
      : 'hoàn thành'
  return (
    <span
      role="img"
      aria-label={`Tiến trình ${done}/${steps.length}: ${summary}`}
      title={summary}
      className="inline-flex items-center gap-1"
    >
      {steps.map((step) => (
        <span
          key={step.key}
          className={cn(
            'h-1.5 w-4 rounded-full',
            step.state === 'done' && 'bg-success',
            step.state === 'current' && 'animate-pulse bg-primary',
            step.state === 'upcoming' && 'bg-muted',
            step.state === 'failed' && 'bg-destructive',
            step.state === 'expired' && 'bg-warning',
            step.state === 'skipped' && 'bg-muted opacity-50',
          )}
        />
      ))}
    </span>
  )
}

/** QR of the validated https checkout URL; kept on white so it scans in dark mode. */
function CheckoutQr({ url, size }: { url: string; size: number }) {
  return (
    <figure className="w-fit space-y-1.5">
      <div className="rounded-xl border bg-white p-3 shadow-xs">
        <QRCode
          value={url}
          size={size}
          level="M"
          title="Mã QR trang thanh toán VNPAY"
        />
      </div>
      <figcaption className="text-center text-[0.7rem] text-muted-foreground">
        Quét để mở VNPAY
      </figcaption>
    </figure>
  )
}

function CheckoutLink({ url }: { url: string }) {
  return (
    <ShadcnButton asChild>
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink className="size-4" aria-hidden="true" />
        Mở trang thanh toán
      </a>
    </ShadcnButton>
  )
}

function CheckoutActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <CheckoutLink url={url} />
      <ShadcnButton type="button" variant="outline" onClick={() => void copy()}>
        <Copy className="size-4" aria-hidden="true" />
        {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
      </ShadcnButton>
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
    iconTone: string
  }
> = {
  PENDING: {
    icon: <Clock3 />,
    title: 'Đang chờ cổng thanh toán xác nhận',
    description:
      'Việc quay lại từ trang VNPAY không có nghĩa là đã thanh toán. Chỉ ghi nhận khi cổng gửi xác nhận hợp lệ.',
    tone: 'border-warning/30 bg-warning/8',
    iconTone: 'text-warning',
  },
  SUCCESS: {
    icon: <CircleCheck />,
    title: 'Đã ghi nhận thanh toán',
    description: 'Cổng đã xác nhận; phiếu thu được lập tự động.',
    tone: 'border-success/30 bg-success/8',
    iconTone: 'text-success',
  },
  FAILED: {
    icon: <CircleX />,
    title: 'Thanh toán không thành công',
    description: 'Không có tiền được ghi nhận. Có thể tạo giao dịch mới.',
    tone: 'border-destructive/30 bg-destructive/8',
    iconTone: 'text-destructive',
  },
  EXPIRED: {
    icon: <TimerOff />,
    title: 'Liên kết thanh toán đã hết hạn',
    description: 'Không có tiền được ghi nhận. Tạo giao dịch mới nếu cần.',
    tone: 'border-border bg-muted/60',
    iconTone: 'text-muted-foreground',
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
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-xs [&_svg]:size-5',
            view.iconTone,
          )}
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
        <p className="text-xs font-medium text-muted-foreground">Số tiền</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {amount}
        </p>
      </div>
    </div>
  )
}
