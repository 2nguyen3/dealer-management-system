import {
  ArrowRightLeft,
  Banknote,
  CircleDollarSign,
  FileClock,
  FilePlus2,
  RefreshCw,
  RotateCcw,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DateField } from '@/components/blocks/DateField'
import { PageHeader } from '@/components/blocks/PageHeader'
import { SortableHeader } from '@/components/data/SortControls'
import { nextSort, useSort } from '@/components/data/sorting'
import { CountUp } from '@/components/motion/Motion'
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
import { formatDate, formatVND } from '@/lib/formatters'
import {
  enumOptions,
  kindLabel,
  methodLabel,
  receiptTypeLabel,
  statusLabel,
} from '@/lib/labels'
import { useAuth } from '../authentication/useAuth'
import {
  businessDate,
  dateRangeParams,
  decimal,
  documentDetail,
  documentSummary,
  id,
  Intent,
  message,
  record,
  positiveMoney,
  vietnamDate,
  vietnamInstant,
  type FinancialDocument,
} from './contracts'
import { DetailList, type DetailEntry } from './DetailList'
import {
  ActionBar,
  ConfirmDialog,
  DetailHeader,
  FilterBar,
  FormActions,
  TableCard,
  TableSkeleton,
} from './financeUi'
import { NextActionCallout } from '@/components/guide/NextActionCallout'
import { notifyNextStep } from '@/components/guide/notifyNextStep'
import { t } from '@/lib/i18n/core'
import { financialNext, financialNotice } from '../guide/workflows'
import { documentLifecycle, groupTotals } from './flow'
import { FlowSteps } from './FlowSteps'
import { PageSummary } from './PageSummary'
import { useSourcePage } from './useSourcePage'

const DOCUMENT_STATUSES = ['DRAFT', 'PENDING', 'POSTED', 'CANCELLED'] as const
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'var(--chart-4)',
  PENDING: 'var(--warning)',
  POSTED: 'var(--success)',
  CANCELLED: 'var(--destructive)',
}
/** Server sort enum: businessDate, totalAmount, createdAt, id (±). */
const DEFAULT_SORT = '-businessDate'
const RECEIPT_METHODS = ['CASH', 'BANK_TRANSFER', 'ONLINE'] as const

type Confirm = 'post' | 'paid' | 'online' | 'cancel'

export function FinancialDocuments({
  kind,
}: {
  kind: 'receipt' | 'credit' | 'refund'
}) {
  const { hasPermission } = useAuth()
  const refund = kind === 'refund'
  const credit = kind === 'credit'
  const path = refund
    ? '/refunds'
    : credit
      ? '/credit-applications'
      : '/payment-receipts'
  const title = refund
    ? t('Hoàn tiền đại lý')
    : credit
      ? t('Bù trừ dư có')
      : t('Phiếu thu tiền')
  const canPrepare = hasPermission(
    refund
      ? 'cash.refund.prepare'
      : credit
        ? 'credit.apply'
        : 'cash.receipt.prepare',
  )
  const canPost = hasPermission(
    refund ? 'cash.refund.post' : credit ? 'credit.apply' : 'cash.receipt.post',
  )
  const canCancel = hasPermission('documents.cancel') && (!refund || canPost)
  const description = refund
    ? t('Lập yêu cầu → giữ chỗ quỹ → chi tiền → hoàn tất.')
    : credit
      ? t('Lập nháp → bù trừ dư có → công nợ giảm. Không phát sinh tiền mặt.')
      : t('Lập nháp → ghi sổ → công nợ cập nhật.')
  const HeaderIcon = refund ? Undo2 : credit ? ArrowRightLeft : Banknote
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [agencyFilter, setAgencyFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const range = dateRangeParams(fromDate, toDate)
  const sorter = useSort(DEFAULT_SORT)
  const onSort = (field: string, first?: 'asc' | 'desc') =>
    sorter.setSort(nextSort(sorter.sort, field, first) || DEFAULT_SORT)
  const list = useSourcePage(
    path,
    {
      q,
      status,
      agencyId: agencyFilter,
      ...(kind === 'receipt' ? { paymentMethod: methodFilter } : {}),
      ...range.params,
      sort: sorter.sort,
    },
    documentSummary,
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    item: FinancialDocument
    etag: string | null
  } | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailVersion, setDetailVersion] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [agencyId, setAgencyId] = useState('')
  const [originDocumentId, setOriginDocumentId] = useState('')
  const [date, setDate] = useState(vietnamDate)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [evidence, setEvidence] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const intent = useRef(new Intent())

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    let current = true
    apiFetch<unknown>(`${path}/${selectedId}`, { signal: controller.signal })
      .then((response) => {
        const item = documentDetail(response.data)
        if (current) setDetail({ item, etag: response.etag })
      })
      .catch((failure: unknown) => {
        if (current) setDetailError(message(failure))
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [path, selectedId, detailVersion])

  const refresh = () => {
    for (const prefix of [
      path,
      '/receivables',
      '/agencies',
      '/credit-lots',
      '/documents',
      '/refunds',
    ])
      invalidateCache(prefix)
    list.reload()
    setDetail(null)
    setDetailVersion((value) => value + 1)
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canPrepare) return
    setError('')
    setNotice('')
    try {
      const body = {
        ...(refund
          ? { originDocumentId: id(originDocumentId), reason: reason.trim() }
          : { agencyId: id(agencyId) }),
        businessDate: businessDate(date),
        amount: positiveMoney(amount),
        ...(!credit ? { paymentMethod: method } : {}),
        note: note.trim() || null,
      }
      if (refund && !reason.trim())
        throw new Error(t('Vui lòng nhập lý do hoàn tiền.'))
      setBusy(true)
      const response = await intent.current.send<unknown>(path, {
        method: 'POST',
        body,
      })
      const created = record(response.data)
      id(created.id)
      setNotice(t('Đã tạo bản nháp. Chưa ghi nhận tiền hoặc thay đổi công nợ.'))
      notifyNextStep(
        financialNotice(
          kind,
          'create',
          typeof created.code === 'string' ? created.code : '',
        ),
      )
      setCreateOpen(false)
      setSelectedId(id(created.id))
      refresh()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  const action = async (
    name: string,
    body?: unknown,
    actionPath?: string,
    match = true,
  ) => {
    if (busy || !detail || !detail.etag) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await intent.current.send(
        actionPath ?? `${path}/${detail.item.id}/${name}`,
        {
          method: 'POST',
          body,
          ...(match ? { ifMatch: detail.etag } : {}),
        },
      )
      setNotice(t('Đã thực hiện thao tác. Đang cập nhật trạng thái mới nhất.'))
      notifyNextStep(
        financialNotice(
          kind,
          actionPath ? 'reconcile' : name,
          detail.item.code,
        ),
      )
      refresh()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const confirmPaid = () => {
    let instant: string
    try {
      instant = vietnamInstant(paidAt)
    } catch (failure) {
      setError(message(failure))
      setConfirm(null)
      return
    }
    void action('confirm-paid', {
      paidAt: instant,
      evidenceReference: evidence.trim(),
    })
  }

  const item = detail?.item
  const reserved =
    item?.reservedAmount !== undefined && decimal(item.reservedAmount) !== '0'
  const unknown =
    item?.latestAttemptState === 'UNKNOWN' ||
    item?.latestAttemptState === 'PENDING'
  const manualReceipt =
    !item ||
    item.kind !== 'PAYMENT_RECEIPT' ||
    item.receiptType === 'DEBT_COLLECTION'
  const actionable = !!detail?.etag && !busy
  const canSubmitPost =
    !!item &&
    item.status === 'DRAFT' &&
    manualReceipt &&
    canPost &&
    (!refund || !reserved) &&
    !unknown
  const canConfirmPaid =
    !!item &&
    item.status === 'DRAFT' &&
    refund &&
    canPost &&
    reserved &&
    !unknown &&
    item.currentRevision.paymentMethod !== 'ONLINE'
  const canRequestOnline =
    !!item &&
    item.status === 'DRAFT' &&
    refund &&
    canPost &&
    reserved &&
    !unknown &&
    item.currentRevision.paymentMethod === 'ONLINE' &&
    !item.latestAttemptId
  const canReconcile = refund && canPost && unknown && !!item?.latestAttemptId
  const canCancelItem =
    !!item &&
    canCancel &&
    manualReceipt &&
    item.status !== 'CANCELLED' &&
    item.status !== 'PENDING' &&
    (!refund || (item.status === 'DRAFT' && !unknown))
  const paidReady =
    !!evidence.trim() && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(paidAt)
  const groups = groupTotals(
    list.items,
    'status',
    'totalAmount',
    DOCUMENT_STATUSES,
  ).map((group) => ({
    ...group,
    label: statusLabel(group.key),
    color: STATUS_COLORS[group.key] ?? 'var(--chart-4)',
  }))
  const pageAmount = groups.reduce((sum, group) => sum + group.amount, 0)
  const postedGroup = groups.find((group) => group.key === 'POSTED')
  const draftGroup = groups.find((group) => group.key === 'DRAFT')
  const filtered = !!(
    q ||
    status ||
    agencyFilter ||
    methodFilter ||
    fromDate ||
    toDate
  )

  return (
    <div className="page-container space-y-6">
      <PageHeader
        eyebrow={t('Tài chính')}
        title={title}
        description={description}
        className="mb-0"
        actions={
          canPrepare && (
            <Button
              icon={<FilePlus2 className="size-4" />}
              onClick={() => {
                setCreateOpen(true)
                setError('')
              }}
            >
              {refund
                ? t('Lập yêu cầu hoàn tiền')
                : credit
                  ? t('Lập phiếu bù trừ')
                  : t('Lập phiếu thu mới')}
            </Button>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      {!list.loading && list.items.length > 0 && (
        <PageSummary
          title={t('Tổng quan chứng từ')}
          noun={t('chứng từ')}
          total={list.items.length}
          groups={groups}
          kpis={[
            {
              label: t('Tổng giá trị'),
              icon: <HeaderIcon />,
              value: formatCompactVND(pageAmount),
              hint: t('{count} chứng từ', { count: list.items.length }),
            },
            {
              label: refund
                ? t('Giá trị đã hoàn')
                : credit
                  ? t('Giá trị đã bù trừ')
                  : t('Giá trị đã ghi sổ'),
              icon: <CircleDollarSign />,
              value: formatCompactVND(postedGroup?.amount ?? 0),
              hint: t('{count} chứng từ', { count: postedGroup?.count ?? 0 }),
            },
            {
              label: t('Nháp chờ xử lý'),
              icon: <FileClock />,
              value: <CountUp value={draftGroup?.count ?? 0} />,
              hint: formatCompactVND(draftGroup?.amount ?? 0),
            },
          ]}
        />
      )}
      <FilterBar>
        <Input
          label={t('Tìm chứng từ')}
          placeholder={t('Số phiếu, ghi chú…')}
          value={q}
          onChange={(event) => setQ(event.target.value)}
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
          options={enumOptions(DOCUMENT_STATUSES, statusLabel, t('Tất cả'))}
        />
        {kind === 'receipt' && (
          <Select
            label={t('Hình thức')}
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
            options={enumOptions(RECEIPT_METHODS, methodLabel, t('Tất cả'))}
          />
        )}
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
        <Button
          variant="outline"
          icon={<RefreshCw className="size-4" />}
          onClick={list.reload}
        >
          {t('Tải lại')}
        </Button>
      </FilterBar>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <TableCard title={t('Danh sách {title}', { title: title.toLowerCase() })}>
        {list.loading ? (
          <TableSkeleton label={t('Đang tải chứng từ...')} />
        ) : list.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={t('Không có chứng từ phù hợp.')}
              description={
                filtered
                  ? t('Thử bỏ bớt điều kiện lọc hoặc đổi khoảng ngày.')
                  : t('Chưa có chứng từ nào được lập.')
              }
            />
          </div>
        ) : (
          <Table
            caption={t('Danh sách {title}', { title: title.toLowerCase() })}
          >
            <thead>
              <tr>
                <th scope="col">{t('Số phiếu')}</th>
                <th scope="col">{t('Đại lý')}</th>
                <SortableHeader
                  field="businessDate"
                  sort={sorter.sort}
                  onSort={onSort}
                  firstDirection="desc"
                >
                  {t('Ngày nghiệp vụ')}
                </SortableHeader>
                {!credit && <th scope="col">{t('Hình thức')}</th>}
                <SortableHeader
                  field="totalAmount"
                  sort={sorter.sort}
                  onSort={onSort}
                  align="right"
                  firstDirection="desc"
                >
                  {t('Số tiền')}
                </SortableHeader>
                <th scope="col">{t('Trạng thái')}</th>
                <th scope="col" className="cell-actions">
                  {t('Thao tác')}
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    <span className="font-semibold">{String(row.code)}</span>
                    {typeof row.receiptType === 'string' && (
                      <div className="text-xs text-muted-foreground">
                        {receiptTypeLabel(row.receiptType)}
                      </div>
                    )}
                  </td>
                  <td className="max-w-56 truncate">
                    {typeof row.agencyName === 'string'
                      ? row.agencyName
                      : `#${String(row.agencyId)}`}
                  </td>
                  <td className="tabular-nums">
                    {formatDate(String(row.businessDate))}
                  </td>
                  {!credit && <td>{methodLabel(row.paymentMethod)}</td>}
                  <td className="cell-number font-medium">
                    {formatVND(String(row.totalAmount))}
                  </td>
                  <td>
                    <StatusBadge status={String(row.status)} />
                  </td>
                  <td className="cell-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={t('Chi tiết {code}', {
                        code: String(row.code),
                      })}
                      onClick={() => {
                        setDetail(null)
                        setDetailError('')
                        setSelectedId(String(row.id))
                        setReason('')
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
          isLoading={list.loading}
          totalShowing={list.loading ? undefined : list.items.length}
        />
      </TableCard>
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={refund ? t('Lập yêu cầu hoàn tiền') : title}
      >
        <form onSubmit={create} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {refund ? (
            <EntityPicker
              resource="payment-receipts"
              label={t('Phiếu thu nguồn (đã ghi sổ)')}
              value={originDocumentId}
              onChange={(value) => setOriginDocumentId(value)}
              params={
                agencyFilter
                  ? { status: 'POSTED', agencyId: agencyFilter }
                  : { status: 'POSTED' }
              }
              required
            />
          ) : (
            <EntityPicker
              resource="agencies"
              label={t('Đại lý')}
              value={agencyId}
              onChange={(value) => setAgencyId(value)}
              required
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              label={t('Ngày nghiệp vụ')}
              value={date}
              onChange={setDate}
              required
            />
            <Input
              label={t('Số tiền (VND nguyên)')}
              inputMode="numeric"
              className="text-end tabular-nums"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              helperText={
                /^[1-9][0-9]{0,17}$/.test(amount)
                  ? formatVND(amount)
                  : undefined
              }
              required
            />
          </div>
          {!credit && (
            <Select
              label={t('Phương thức')}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              options={(refund
                ? ['CASH', 'BANK_TRANSFER', 'ONLINE']
                : ['CASH', 'BANK_TRANSFER']
              ).map((value) => ({ value, label: methodLabel(value) }))}
            />
          )}
          {refund && (
            <Input
              label={t('Lý do hoàn tiền')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          )}
          <Input
            label={t('Ghi chú')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <FormActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              {t('Đóng')}
            </Button>
            <Button type="submit" isLoading={busy}>
              {t('Lưu bản nháp')}
            </Button>
          </FormActions>
        </form>
      </Modal>
      <Modal
        isOpen={!!selectedId}
        onClose={() => {
          setSelectedId(null)
          setDetail(null)
        }}
        title={
          item
            ? t('Chi tiết {code}', { code: item.code })
            : t('Chi tiết chứng từ')
        }
        maxWidth="lg"
      >
        {detailError && <Alert type="error">{detailError}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
        {!item ? (
          detailError ? null : (
            <div role="status" className="space-y-3">
              <span className="sr-only">{t('Đang tải chi tiết...')}</span>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )
        ) : (
          <div className="space-y-4">
            <DetailHeader
              icon={<HeaderIcon />}
              code={item.code}
              badge={<StatusBadge status={item.status} />}
              amount={formatVND(item.currentRevision.totalAmount)}
              amountLabel={refund ? t('Số tiền hoàn') : t('Số tiền')}
              meta={t('Ngày nghiệp vụ {businessDate}', {
                businessDate: formatDate(item.currentRevision.businessDate),
              })}
              tone={
                item.status === 'POSTED'
                  ? 'success'
                  : item.status === 'CANCELLED'
                    ? 'danger'
                    : 'neutral'
              }
            />
            <FlowSteps
              label={t('Vòng đời chứng từ')}
              steps={documentLifecycle(kind, item)}
            />
            <NextActionCallout
              action={financialNext(kind, item, {
                post: canPost,
                manual: manualReceipt,
                reserved,
                unknown,
              })}
            />
            <DetailList entries={detailEntries(item)} />
            {credit && (
              <Alert type="info">
                {t('Không phát sinh tiền mặt; trừ vào khoản nợ cũ nhất trước.')}
              </Alert>
            )}
            {!manualReceipt && (
              <Alert type="info">
                {t(
                  'Phiếu thu tự động/trực tuyến: chỉ xem, không ghi sổ thủ công.',
                )}
              </Alert>
            )}
            {refund && unknown && (
              <Alert type="warning">
                {t(
                  'Lần hoàn tiền đang chờ kết quả, số tiền vẫn được giữ. Hãy đối soát lần hoàn hiện tại thay vì hủy hoặc tạo lần mới.',
                )}
              </Alert>
            )}
            {!detail?.etag && (
              <Alert type="warning">
                {t(
                  'Chưa thể thao tác trên phiếu này. Vui lòng tải lại chi tiết.',
                )}
              </Alert>
            )}
            <ActionBar>
              <Button
                variant="ghost"
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  setDetail(null)
                  setDetailError('')
                  setDetailVersion((value) => value + 1)
                }}
              >
                {t('Tải lại chi tiết')}
              </Button>
              {canCancelItem && (
                <Button
                  variant="danger"
                  disabled={!actionable}
                  onClick={() => {
                    setReason('')
                    setConfirm('cancel')
                  }}
                >
                  {t('Hủy phiếu')}
                </Button>
              )}
              {canReconcile && (
                <Button
                  disabled={!actionable}
                  onClick={() =>
                    action(
                      '',
                      undefined,
                      `/refund-attempts/${item.latestAttemptId}/reconcile`,
                      false,
                    )
                  }
                >
                  {t('Đối soát lần thử hiện tại')}
                </Button>
              )}
              {canRequestOnline && (
                <Button
                  disabled={!actionable}
                  onClick={() => setConfirm('online')}
                >
                  {t('Yêu cầu hoàn trực tuyến')}
                </Button>
              )}
              {canConfirmPaid && (
                <Button
                  disabled={!actionable}
                  onClick={() => setConfirm('paid')}
                >
                  {t('Xác nhận đã chi tiền')}
                </Button>
              )}
              {canSubmitPost && (
                <Button
                  disabled={!actionable}
                  onClick={() => setConfirm('post')}
                >
                  {refund ? t('Giữ chỗ quỹ') : t('Ghi sổ')}
                </Button>
              )}
            </ActionBar>
          </div>
        )}
      </Modal>
      {item && (
        <>
          <ConfirmDialog
            isOpen={confirm === 'post'}
            onClose={() => setConfirm(null)}
            title={
              refund
                ? t('Giữ chỗ quỹ hoàn tiền')
                : t('Ghi sổ {code}', { code: item.code })
            }
            description={
              refund
                ? t(
                    'Giữ {totalAmount} cho yêu cầu hoàn tiền {code}. Số tiền này sẽ không thể dùng cho việc khác cho tới khi hoàn tất hoặc hủy.',
                    {
                      totalAmount: formatVND(item.currentRevision.totalAmount),
                      code: item.code,
                    },
                  )
                : t(
                    'Ghi sổ {code} với số tiền {totalAmount}. Công nợ của đại lý sẽ được cập nhật ngay. {value}',
                    {
                      code: item.code,
                      totalAmount: formatVND(item.currentRevision.totalAmount),
                      value: credit
                        ? t(
                            'Dư có của đại lý giảm; khoản bù trừ trừ vào hóa đơn (phiếu xuất) còn nợ cũ nhất trước.',
                          )
                        : t(
                            'Tiền được phân bổ vào hóa đơn (phiếu xuất) còn nợ cũ nhất trước (FIFO); số tiền vượt công nợ hiện tại sẽ bị từ chối.',
                          ),
                    },
                  )
            }
            confirmLabel={refund ? t('Xác nhận giữ chỗ') : t('Xác nhận ghi sổ')}
            busy={busy}
            disabled={!actionable}
            onConfirm={() => void action(refund ? 'submit' : 'post')}
          />
          <ConfirmDialog
            isOpen={confirm === 'online'}
            onClose={() => setConfirm(null)}
            title={t('Yêu cầu hoàn trực tuyến')}
            description={t(
              'Gửi yêu cầu hoàn tiền tới cổng thanh toán. Kết quả chỉ được ghi nhận khi cổng xác nhận; hãy đối soát nếu kết quả chưa rõ.',
            )}
            confirmLabel={t('Gửi yêu cầu hoàn')}
            busy={busy}
            disabled={!actionable}
            onConfirm={() => void action('attempts')}
          />
          <ConfirmDialog
            isOpen={confirm === 'paid'}
            onClose={() => setConfirm(null)}
            title={t('Xác nhận đã chi tiền')}
            description={t(
              'Ghi nhận đã chi {totalAmount} cho đại lý. Cần thời điểm chi thực tế và tham chiếu bằng chứng.',
              { totalAmount: formatVND(item.currentRevision.totalAmount) },
            )}
            confirmLabel={t('Xác nhận đã chi tiền')}
            busy={busy}
            disabled={!actionable || !paidReady}
            onConfirm={confirmPaid}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('Thời điểm đã chi')}
                type="datetime-local"
                helperText={t('Giờ Việt Nam (GMT+7)')}
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                required
              />
              <Input
                label={t('Tham chiếu bằng chứng chi tiền')}
                placeholder={t('Số phiếu chi, mã chuyển khoản…')}
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                required
              />
            </div>
          </ConfirmDialog>
          <ConfirmDialog
            isOpen={confirm === 'cancel'}
            onClose={() => setConfirm(null)}
            title={t('Hủy {code}', { code: item.code })}
            description={t(
              'Phiếu đã hủy không thể khôi phục. Các bút toán liên quan (nếu có) sẽ được đảo.',
            )}
            confirmLabel={t('Hủy phiếu')}
            danger
            busy={busy}
            disabled={!actionable || !reason.trim()}
            onConfirm={() => void action('cancel', { reason: reason.trim() })}
          >
            <Input
              label={t('Lý do hủy')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </ConfirmDialog>
        </>
      )}
    </div>
  )
}

function detailEntries(item: FinancialDocument): DetailEntry[] {
  const revision = item.currentRevision
  const entries: DetailEntry[] = [
    [t('Loại chứng từ'), kindLabel(item.kind)],
    [t('Đại lý'), revision.agencySnapshot?.name ?? `#${item.agencyId}`],
  ]
  if (revision.paymentMethod)
    entries.push([t('Hình thức'), methodLabel(revision.paymentMethod)])
  if (item.receiptType)
    entries.push([t('Loại phiếu thu'), receiptTypeLabel(item.receiptType)])
  if (item.kind === 'REFUND') {
    if (item.originDocumentId)
      entries.push([t('Phiếu thu nguồn'), `#${item.originDocumentId}`])
    entries.push(
      [t('Đang giữ'), formatVND(item.reservedAmount)],
      [t('Đã hoàn'), formatVND(item.refundedAmount)],
      [
        t('Lần hoàn gần nhất'),
        item.latestAttemptState ? (
          <StatusBadge key="attempt" status={item.latestAttemptState} />
        ) : (
          t('Chưa có')
        ),
      ],
    )
    if (revision.reason) entries.push([t('Lý do hoàn tiền'), revision.reason])
  }
  entries.push([t('Ghi chú'), revision.note ?? '—'])
  return entries
}
