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
import { notifyNextStep } from '@/components/guide/notifyNextStep'
import { t } from '@/lib/i18n/core'
import { reconcileNotice } from '../guide/workflows'
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
import { onlineAmountError, paymentFlowSteps } from './paymentFlow'
import { DebtPanel } from '../document_history/DebtPanel'
import { documentLink } from '../document_history/documentContracts'
import { useAgencyBalance } from '../document_history/useRecords'
import { SafeLink } from '@/components/guide/SafeLink'
import { usePathAllowed } from '../guide/usePathAllowed'

const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'] as const
const AMOUNT = /^[1-9][0-9]{0,17}$/
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'var(--warning)',
  SUCCESS: 'var(--success)',
  FAILED: 'var(--destructive)',
  EXPIRED: 'var(--chart-4)',
}
/** Server sort enum for GET /online-payments: createdAt, id (±). */
const DEFAULT_SORT = '-createdAt'
const WIZARD = [t('Thông tin'), t('Xác nhận'), t('Thanh toán')] as const
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
  if (!(PAYMENT_STATUSES as readonly string[]).includes(text(data.status)))
    throw new Error('Invalid payment status')
  if (!AMOUNT.test(String(data.amount)))
    throw new Error('Invalid payment amount')
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
  const [balanceVersion, setBalanceVersion] = useState(0)
  const agency = useAgencyBalance(open ? agencyId : '', balanceVersion)
  const pathAllowed = usePathAllowed()
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
        throw new Error(t('Mã tham chiếu không hợp lệ.'))
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
        throw new Error(t('Không tìm thấy giao dịch với mã tham chiếu này.'))
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
      if (!agencyId) throw new Error(t('Vui lòng chọn đại lý thanh toán.'))
      id(agencyId)
      if (agency.loading) throw new Error(t('Đang đọc công nợ đại lý...'))
      const amountError = onlineAmountError(
        amount,
        agency.balance?.debt ?? null,
      )
      if (amountError) throw new Error(amountError)
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
      setBalanceVersion((value) => value + 1)
      setCreateStep(accepted ? 'confirm' : 'handoff')
      setPendingSetupId(accepted ? id(item.id) : null)
      setSelected(id(item.id))
      setDetail(item)
      if (!accepted) {
        setAgencyId('')
        setAgencyLabel('')
        setAmount('')
      }
      if (!accepted)
        notifyNextStep({
          done: t('Đã tạo giao dịch thanh toán trực tuyến.'),
          next: t(
            'Bước tiếp: gửi liên kết hoặc mã QR để đại lý trả trên VNPAY. Trang trả về không phải là xác nhận thành công; chờ cổng báo (IPN) hoặc bấm đối soát.',
          ),
        })
      setNotice(
        accepted
          ? t(
              'Đang khởi tạo trang thanh toán. Giữ nguyên nội dung và bấm tiếp tục để hoàn tất cùng giao dịch này, không tạo giao dịch mới.',
            )
          : t(
              'Đã tạo giao dịch. Tiền chỉ được ghi nhận khi cổng thanh toán xác nhận thành công.',
            ),
      )
      invalidateCache('/online-payments')
      list.reload()
    } catch (failure) {
      setError(message(failure))
      // PAYMENT_EXCEEDS_DEBT and similar: show the server's current debt.
      setBalanceVersion((value) => value + 1)
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
      const reconciled = payment(response.data)
      setDetail(reconciled)
      notifyNextStep(reconcileNotice(reconciled.status))
      setVersion((value) => value + 1)
      for (const prefix of [
        '/online-payments',
        '/payment-receipts',
        '/documents',
        '/agencies',
        '/dashboard',
        '/reports',
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
        eyebrow={t('Tài chính')}
        title={t('Thanh toán trực tuyến')}
        description={t(
          'Tạo giao dịch → đại lý trả trên VNPAY → cổng xác nhận (IPN) → phiếu thu tự động.',
        )}
        className="mb-0"
        actions={
          canManage && (
            <Button
              icon={<CreditCard className="size-4" />}
              onClick={openCreate}
            >
              {t('Tạo thanh toán mới')}
            </Button>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}
      {!list.loading && list.items.length > 0 && (
        <PageSummary
          title={t('Tổng quan giao dịch')}
          noun={t('giao dịch')}
          total={list.items.length}
          groups={groups}
          kpis={[
            {
              label: t('Đã ghi nhận'),
              icon: <BadgeCheck />,
              value: formatCompactVND(group('SUCCESS')?.amount ?? 0),
              hint: t('{count} giao dịch có phiếu thu', {
                count: group('SUCCESS')?.count ?? 0,
              }),
            },
            {
              label: t('Chờ cổng xác nhận'),
              icon: <Hourglass />,
              value: formatCompactVND(group('PENDING')?.amount ?? 0),
              hint: t('{count} giao dịch', {
                count: group('PENDING')?.count ?? 0,
              }),
            },
            {
              label: t('Không thành công'),
              icon: <CircleX />,
              value: <CountUp value={stopped} />,
              hint: t('Thất bại hoặc hết hạn'),
            },
          ]}
        />
      )}
      <FilterBar>
        <Input
          label={t('Mã tham chiếu')}
          placeholder={t('Mã tham chiếu chính xác')}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <EntityPicker
          resource="agencies"
          label={t('Đại lý')}
          value={agencyFilter}
          onChange={(value) => setAgencyFilter(value)}
          placeholder={t('Tất cả đại lý')}
        />
        <Select
          label={t('Trạng thái')}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={enumOptions(PAYMENT_STATUSES, statusLabel, t('Tất cả'))}
        />
        <DateField
          label={t('Tạo từ ngày')}
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
        <Button
          variant="outline"
          icon={<RefreshCw className="size-4" />}
          onClick={list.reload}
        >
          {t('Tải lại')}
        </Button>
      </FilterBar>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <TableCard
        title={t('Giao dịch trực tuyến')}
        description={t('Trạng thái theo xác nhận IPN của cổng.')}
        icon={<Globe />}
      >
        {list.loading ? (
          <TableSkeleton label={t('Đang tải giao dịch...')} />
        ) : !list.items.length ? (
          <div className="p-4">
            <EmptyState
              icon={<CreditCard className="size-6" />}
              title={t('Không có giao dịch phù hợp.')}
            />
          </div>
        ) : (
          <Table caption={t('Danh sách giao dịch trực tuyến')}>
            <thead>
              <tr>
                <th scope="col">{t('Mã tham chiếu')}</th>
                <th scope="col">{t('Đại lý')}</th>
                <SortableHeader
                  field="createdAt"
                  sort={sorter.sort}
                  onSort={onSort}
                  firstDirection="desc"
                >
                  {t('Tạo lúc')}
                </SortableHeader>
                <th scope="col">{t('Thời điểm thanh toán')}</th>
                <th scope="col" className="cell-number">
                  {t('Số tiền')}
                </th>
                <th scope="col">{t('Tiến trình')}</th>
                <th scope="col">{t('Trạng thái')}</th>
                <th scope="col" className="cell-actions">
                  {t('Thao tác')}
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
                  <td>{agencyText(item)}</td>
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
                      aria-label={t('Chi tiết {merchantReference}', {
                        merchantReference: String(item.merchantReference),
                      })}
                      onClick={() => {
                        setSelected(String(item.id))
                        setDetail(null)
                        setEvents([])
                        setError('')
                      }}
                    >
                      {t('Chi tiết')}
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
        title={t('Tạo thanh toán trực tuyến')}
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
                label={t('Đại lý thanh toán')}
                value={agencyId}
                onChange={(value, item) => {
                  setAgencyId(value)
                  setAgencyLabel(item?.label ?? '')
                }}
                required
              />
              {agencyId && agency.error && (
                <Alert type="error">{agency.error}</Alert>
              )}
              {agencyId && agency.balance && (
                <DebtPanel
                  debt={agency.balance.debt}
                  maxDebt={agency.balance.maxDebt}
                  change={AMOUNT.test(amount) ? -BigInt(amount) : null}
                />
              )}
              <Input
                label={t('Số tiền thanh toán (VND nguyên)')}
                inputMode="numeric"
                className="text-end tabular-nums"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                helperText={
                  AMOUNT.test(amount)
                    ? formatVND(amount)
                    : t('Không vượt công nợ hiện tại của đại lý.')
                }
                required
              />
              {agency.balance && BigInt(agency.balance.debt) > 0n && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={false}
                  onClick={() => setAmount(agency.balance!.debt)}
                >
                  {t('Thu toàn bộ nợ')}
                </Button>
              )}
              <FormActions>
                <Button type="button" variant="outline" onClick={closeCreate}>
                  {t('Đóng')}
                </Button>
                <Button type="submit" icon={<ArrowRight className="size-4" />}>
                  {t('Tiếp tục')}
                </Button>
              </FormActions>
            </form>
          )}
          {createStep === 'confirm' && (
            <form onSubmit={create} className="space-y-4">
              <DetailList
                entries={[
                  [t('Đại lý'), agencyLabel || `#${agencyId}`],
                  [
                    t('Số tiền'),
                    <span
                      key="amount"
                      className="text-lg font-semibold tabular-nums"
                    >
                      {AMOUNT.test(amount) ? formatVND(amount) : amount}
                    </span>,
                  ],
                  [t('Cổng thanh toán'), 'VNPAY'],
                  [t('Ghi nhận khi'), t('Cổng xác nhận (IPN) thành công')],
                ]}
              />
              <div className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/8 p-3 text-xs text-foreground/80">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-info"
                  aria-hidden="true"
                />
                <span>
                  {t(
                    'Trang quay lại từ VNPAY không phải là xác nhận. Chỉ IPN hợp lệ mới lập phiếu thu.',
                  )}
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
                  {t('Quay lại')}
                </Button>
                <Button type="button" variant="outline" onClick={closeCreate}>
                  {t('Đóng')}
                </Button>
                <Button type="submit" isLoading={busy}>
                  {pendingSetupId
                    ? t('Tiếp tục khởi tạo thanh toán')
                    : t('Khởi tạo thanh toán')}
                </Button>
              </FormActions>
            </form>
          )}
          {createStep === 'handoff' && detail && (
            <div className="space-y-4">
              {detailSteps && (
                <FlowSteps
                  label={t('Tiến trình thanh toán')}
                  steps={detailSteps}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                {payable ? (
                  <CheckoutQr url={url} size={152} />
                ) : (
                  <div className="flex size-40 items-center justify-center rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                    {detail.status === 'PENDING'
                      ? t('Chưa có liên kết')
                      : t('Không cần thanh toán')}
                  </div>
                )}
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('Số tiền cần trả')}
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
                    {t(
                      'Gửi mã QR hoặc liên kết cho đại lý. Trạng thái chỉ đổi khi cổng xác nhận.',
                    )}
                  </p>
                </div>
              </div>
              <ActionBar>
                <Button
                  variant="ghost"
                  icon={<RefreshCw className="size-4" />}
                  onClick={() => setVersion((value) => value + 1)}
                >
                  {t('Kiểm tra trạng thái')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    setCreateStep('form')
                  }}
                >
                  {t('Xem chi tiết')}
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
        title={t('Chi tiết giao dịch')}
        maxWidth="lg"
      >
        {!detail ? (
          <div role="status" className="space-y-3">
            <span className="sr-only">{t('Đang tải chi tiết...')}</span>
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
              <FlowSteps
                label={t('Tiến trình thanh toán')}
                steps={detailSteps}
              />
            )}
            <DetailList
              entries={[
                [
                  t('Mã tham chiếu'),
                  <span key="ref" className="font-mono text-xs">
                    {String(detail.merchantReference)}
                  </span>,
                ],
                [t('Đại lý'), agencyText(detail)],
                [t('Cổng thanh toán'), String(detail.provider)],
                [
                  t('Mã giao dịch cổng'),
                  typeof detail.providerTransactionId === 'string'
                    ? detail.providerTransactionId
                    : t('Chưa có'),
                ],
                [
                  t('Phiếu thu'),
                  <ReceiptLink
                    key="receipt"
                    payment={detail}
                    allowed={pathAllowed}
                  />,
                ],
                [
                  t('Thời điểm thanh toán'),
                  optionalDateTime(detail.paymentTime, t('Chưa xác nhận')),
                ],
                [t('Hết hạn lúc'), optionalDateTime(detail.expiresAt, '—')],
              ]}
            />
            <ActionBar>
              <Button
                variant="ghost"
                icon={<RefreshCw className="size-4" />}
                onClick={() => setVersion((value) => value + 1)}
              >
                {t('Kiểm tra trạng thái')}
              </Button>
              {canManage && detail.status === 'PENDING' && (
                <Button variant="outline" disabled={busy} onClick={reconcile}>
                  {t('Đối soát giao dịch hiện tại')}
                </Button>
              )}
              {canManage && selected === pendingSetupId && (
                <Button disabled={busy} onClick={openCreate}>
                  {t('Tiếp tục khởi tạo thanh toán')}
                </Button>
              )}
              {payable && (
                <Popover>
                  <PopoverTrigger asChild>
                    <ShadcnButton variant="outline">
                      <QrCode className="size-4" aria-hidden="true" />
                      {t('Mã QR')}
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
                title={t('Phản hồi từ cổng thanh toán')}
                description={t('Đã kiểm tra chữ ký.')}
                icon={<ShieldCheck />}
              >
                {events.length ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table caption={t('Lịch sử phản hồi từ cổng thanh toán')}>
                      <thead>
                        <tr>
                          <th scope="col">{t('Thời điểm')}</th>
                          <th scope="col">{t('Mã giao dịch cổng')}</th>
                          <th scope="col" className="cell-number">
                            {t('Số tiền')}
                          </th>
                          <th scope="col">{t('Kết quả')}</th>
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
                    {t('Chưa có phản hồi nào.')}
                  </p>
                )}
                {eventsMore && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('Chỉ hiển thị 25 phản hồi đầu tiên.')}
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

function agencyText(payment: Row) {
  const name = typeof payment.agencyName === 'string' ? payment.agencyName : ''
  const code = typeof payment.agencyCode === 'string' ? payment.agencyCode : ''
  if (name && code) return `${code} · ${name}`
  return name || code || `#${String(payment.agencyId)}`
}

/** The automatic receipt (PT-…) of a successful payment, linked when allowed. */
function ReceiptLink({
  payment,
  allowed,
}: {
  payment: Row
  allowed: (path: string) => boolean
}) {
  if (
    typeof payment.receiptDocumentId !== 'string' ||
    !payment.receiptDocumentId
  )
    return <>{t('Chưa có')}</>
  const label =
    typeof payment.receiptCode === 'string' && payment.receiptCode
      ? payment.receiptCode
      : `#${payment.receiptDocumentId}`
  const to = documentLink('PAYMENT_RECEIPT', payment.receiptDocumentId)
  return allowed(to) ? (
    <SafeLink to={to} className="font-medium text-primary hover:underline">
      {label}
    </SafeLink>
  ) : (
    <>{label}</>
  )
}

/** "1 Thông tin — 2 Xác nhận — 3 Thanh toán" header of the create dialog. */
function WizardSteps({ current }: { current: number }) {
  return (
    <ol
      className="flex items-center gap-2"
      aria-label={t('Các bước tạo thanh toán')}
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
                'me-1 flex-1 transition-colors duration-500',
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
    ? t('dừng ở {label}', { label: stop.label })
    : current
      ? t('đang ở {label}', { label: current.label })
      : t('hoàn thành')
  return (
    <span
      role="img"
      aria-label={t('Tiến trình {done}/{count}: {summary}', {
        done,
        count: steps.length,
        summary,
      })}
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
          title={t('Mã QR trang thanh toán VNPAY')}
        />
      </div>
      <figcaption className="text-center text-[0.7rem] text-muted-foreground">
        {t('Quét để mở VNPAY')}
      </figcaption>
    </figure>
  )
}

function CheckoutLink({ url }: { url: string }) {
  return (
    <ShadcnButton asChild>
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink className="size-4" aria-hidden="true" />
        {t('Mở trang thanh toán')}
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
        {copied ? t('Đã sao chép') : t('Sao chép liên kết')}
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
    title: t('Đang chờ cổng thanh toán xác nhận'),
    description: t(
      'Việc quay lại từ trang VNPAY không có nghĩa là đã thanh toán. Chỉ ghi nhận khi cổng gửi xác nhận hợp lệ.',
    ),
    tone: 'border-warning/30 bg-warning/8',
    iconTone: 'text-warning',
  },
  SUCCESS: {
    icon: <CircleCheck />,
    title: t('Đã ghi nhận thanh toán'),
    description: t('Cổng đã xác nhận; phiếu thu được lập tự động.'),
    tone: 'border-success/30 bg-success/8',
    iconTone: 'text-success',
  },
  FAILED: {
    icon: <CircleX />,
    title: t('Thanh toán không thành công'),
    description: t('Không có tiền được ghi nhận. Có thể tạo giao dịch mới.'),
    tone: 'border-destructive/30 bg-destructive/8',
    iconTone: 'text-destructive',
  },
  EXPIRED: {
    icon: <TimerOff />,
    title: t('Liên kết thanh toán đã hết hạn'),
    description: t('Không có tiền được ghi nhận. Tạo giao dịch mới nếu cần.'),
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
      <div className="shrink-0 sm:text-end">
        <p className="text-xs font-medium text-muted-foreground">
          {t('Số tiền')}
        </p>
        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {amount}
        </p>
      </div>
    </div>
  )
}
