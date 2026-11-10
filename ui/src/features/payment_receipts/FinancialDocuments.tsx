import {
  ArrowRightLeft,
  Banknote,
  FilePlus2,
  RefreshCw,
  RotateCcw,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { useSourcePage } from './useSourcePage'

const DOCUMENT_STATUSES = ['DRAFT', 'PENDING', 'POSTED', 'CANCELLED'] as const
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
    ? 'Hoàn tiền đại lý'
    : credit
      ? 'Bù trừ dư có'
      : 'Phiếu thu tiền'
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
    ? 'Hoàn lại tiền cho đại lý từ phiếu thu đã ghi sổ.'
    : credit
      ? 'Dùng số dư có của đại lý để trừ vào công nợ, không phát sinh tiền mặt.'
      : 'Lập, ghi sổ và theo dõi các phiếu thu tiền của đại lý.'
  const HeaderIcon = refund ? Undo2 : credit ? ArrowRightLeft : Banknote
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [agencyFilter, setAgencyFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const range = dateRangeParams(fromDate, toDate)
  const list = useSourcePage(
    path,
    {
      q,
      status,
      agencyId: agencyFilter,
      ...(kind === 'receipt' ? { paymentMethod: methodFilter } : {}),
      ...range.params,
      sort: '-businessDate',
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
        throw new Error('Vui lòng nhập lý do hoàn tiền.')
      setBusy(true)
      const response = await intent.current.send<unknown>(path, {
        method: 'POST',
        body,
      })
      const created = record(response.data)
      id(created.id)
      setNotice('Đã tạo bản nháp. Chưa ghi nhận tiền hoặc thay đổi công nợ.')
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
      setNotice('Đã thực hiện thao tác. Đang cập nhật trạng thái mới nhất.')
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
        eyebrow="Tài chính"
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
                ? 'Lập yêu cầu hoàn tiền'
                : credit
                  ? 'Lập phiếu bù trừ'
                  : 'Lập phiếu thu mới'}
            </Button>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      <FilterBar>
        <Input
          label="Tìm chứng từ"
          placeholder="Số phiếu, ghi chú…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
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
          options={enumOptions(DOCUMENT_STATUSES, statusLabel, 'Tất cả')}
        />
        {kind === 'receipt' && (
          <Select
            label="Hình thức"
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
            options={enumOptions(RECEIPT_METHODS, methodLabel, 'Tất cả')}
          />
        )}
        <DateField
          label="Từ ngày"
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
        title={`Danh sách ${title.toLowerCase()}`}
        description="Sắp xếp theo ngày nghiệp vụ mới nhất."
      >
        {list.loading ? (
          <TableSkeleton label="Đang tải chứng từ..." />
        ) : list.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Không có chứng từ phù hợp."
              description={
                filtered
                  ? 'Thử bỏ bớt điều kiện lọc hoặc đổi khoảng ngày.'
                  : 'Chưa có chứng từ nào được lập.'
              }
            />
          </div>
        ) : (
          <Table caption={`Danh sách ${title.toLowerCase()}`}>
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Đại lý</th>
                <th scope="col">Ngày nghiệp vụ</th>
                {!credit && <th scope="col">Hình thức</th>}
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
                      aria-label={`Chi tiết ${String(row.code)}`}
                      onClick={() => {
                        setDetail(null)
                        setDetailError('')
                        setSelectedId(String(row.id))
                        setReason('')
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
          isLoading={list.loading}
          totalShowing={list.loading ? undefined : list.items.length}
        />
      </TableCard>
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={refund ? 'Lập yêu cầu hoàn tiền' : title}
      >
        <form onSubmit={create} className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {refund ? (
            <EntityPicker
              resource="payment-receipts"
              label="Phiếu thu nguồn (đã ghi sổ)"
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
              label="Đại lý"
              value={agencyId}
              onChange={(value) => setAgencyId(value)}
              required
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              label="Ngày nghiệp vụ"
              value={date}
              onChange={setDate}
              required
            />
            <Input
              label="Số tiền (VND nguyên)"
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
          </div>
          {!credit && (
            <Select
              label="Phương thức"
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
              label="Lý do hoàn tiền"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          )}
          <Input
            label="Ghi chú"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <FormActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Đóng
            </Button>
            <Button type="submit" isLoading={busy}>
              Lưu bản nháp
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
        title={item ? `Chi tiết ${item.code}` : 'Chi tiết chứng từ'}
        maxWidth="lg"
      >
        {detailError && <Alert type="error">{detailError}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
        {!item ? (
          detailError ? null : (
            <div role="status" className="space-y-3">
              <span className="sr-only">Đang tải chi tiết...</span>
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
              amountLabel={refund ? 'Số tiền hoàn' : 'Số tiền'}
              meta={`Ngày nghiệp vụ ${formatDate(item.currentRevision.businessDate)}`}
              tone={
                item.status === 'POSTED'
                  ? 'success'
                  : item.status === 'CANCELLED'
                    ? 'danger'
                    : 'neutral'
              }
            />
            <DetailList entries={detailEntries(item)} />
            {credit && (
              <Alert type="info">
                Không phát sinh tiền mặt. Hệ thống tự trừ vào các khoản nợ cũ
                nhất trước.
              </Alert>
            )}
            {!manualReceipt && (
              <Alert type="info">
                Phiếu thu tự động hoặc trực tuyến chỉ để xem, không sửa hoặc ghi
                sổ thủ công.
              </Alert>
            )}
            {refund && unknown && (
              <Alert type="warning">
                Lần hoàn tiền đang chờ kết quả, số tiền vẫn được giữ. Hãy đối
                soát lần hoàn hiện tại thay vì hủy hoặc tạo lần mới.
              </Alert>
            )}
            {!detail?.etag && (
              <Alert type="warning">
                Chưa thể thao tác trên phiếu này. Vui lòng tải lại chi tiết.
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
                Tải lại chi tiết
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
                  Hủy phiếu
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
                  Đối soát lần thử hiện tại
                </Button>
              )}
              {canRequestOnline && (
                <Button
                  disabled={!actionable}
                  onClick={() => setConfirm('online')}
                >
                  Yêu cầu hoàn trực tuyến
                </Button>
              )}
              {canConfirmPaid && (
                <Button
                  disabled={!actionable}
                  onClick={() => setConfirm('paid')}
                >
                  Xác nhận đã chi tiền
                </Button>
              )}
              {canSubmitPost && (
                <Button
                  disabled={!actionable}
                  onClick={() => setConfirm('post')}
                >
                  {refund ? 'Giữ chỗ quỹ' : 'Ghi sổ'}
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
            title={refund ? 'Giữ chỗ quỹ hoàn tiền' : `Ghi sổ ${item.code}`}
            description={
              refund
                ? `Giữ ${formatVND(item.currentRevision.totalAmount)} cho yêu cầu hoàn tiền ${item.code}. Số tiền này sẽ không thể dùng cho việc khác cho tới khi hoàn tất hoặc hủy.`
                : `Ghi sổ ${item.code} với số tiền ${formatVND(item.currentRevision.totalAmount)}. Công nợ của đại lý sẽ được cập nhật ngay.`
            }
            confirmLabel={refund ? 'Xác nhận giữ chỗ' : 'Xác nhận ghi sổ'}
            busy={busy}
            disabled={!actionable}
            onConfirm={() => void action(refund ? 'submit' : 'post')}
          />
          <ConfirmDialog
            isOpen={confirm === 'online'}
            onClose={() => setConfirm(null)}
            title="Yêu cầu hoàn trực tuyến"
            description="Gửi yêu cầu hoàn tiền tới cổng thanh toán. Kết quả chỉ được ghi nhận khi cổng xác nhận; hãy đối soát nếu kết quả chưa rõ."
            confirmLabel="Gửi yêu cầu hoàn"
            busy={busy}
            disabled={!actionable}
            onConfirm={() => void action('attempts')}
          />
          <ConfirmDialog
            isOpen={confirm === 'paid'}
            onClose={() => setConfirm(null)}
            title="Xác nhận đã chi tiền"
            description={`Ghi nhận đã chi ${formatVND(item.currentRevision.totalAmount)} cho đại lý. Cần thời điểm chi thực tế và tham chiếu bằng chứng.`}
            confirmLabel="Xác nhận đã chi tiền"
            busy={busy}
            disabled={!actionable || !paidReady}
            onConfirm={confirmPaid}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Thời điểm đã chi"
                type="datetime-local"
                helperText="Giờ Việt Nam (GMT+7)"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                required
              />
              <Input
                label="Tham chiếu bằng chứng chi tiền"
                placeholder="Số phiếu chi, mã chuyển khoản…"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                required
              />
            </div>
          </ConfirmDialog>
          <ConfirmDialog
            isOpen={confirm === 'cancel'}
            onClose={() => setConfirm(null)}
            title={`Hủy ${item.code}`}
            description="Phiếu đã hủy không thể khôi phục. Các bút toán liên quan (nếu có) sẽ được đảo."
            confirmLabel="Hủy phiếu"
            danger
            busy={busy}
            disabled={!actionable || !reason.trim()}
            onConfirm={() => void action('cancel', { reason: reason.trim() })}
          >
            <Input
              label="Lý do hủy"
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
    ['Loại chứng từ', kindLabel(item.kind)],
    ['Đại lý', revision.agencySnapshot?.name ?? `#${item.agencyId}`],
  ]
  if (revision.paymentMethod)
    entries.push(['Hình thức', methodLabel(revision.paymentMethod)])
  if (item.receiptType)
    entries.push(['Loại phiếu thu', receiptTypeLabel(item.receiptType)])
  if (item.kind === 'REFUND') {
    if (item.originDocumentId)
      entries.push(['Phiếu thu nguồn', `#${item.originDocumentId}`])
    entries.push(
      ['Đang giữ', formatVND(item.reservedAmount)],
      ['Đã hoàn', formatVND(item.refundedAmount)],
      [
        'Lần hoàn gần nhất',
        item.latestAttemptState ? (
          <StatusBadge key="attempt" status={item.latestAttemptState} />
        ) : (
          'Chưa có'
        ),
      ],
    )
    if (revision.reason) entries.push(['Lý do hoàn tiền', revision.reason])
  }
  entries.push(['Ghi chú', revision.note ?? '—'])
  return entries
}
