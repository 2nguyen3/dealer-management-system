import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { formatDate, formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import {
  businessDate,
  decimal,
  documentDetail,
  documentSummary,
  id,
  Intent,
  message,
  record,
  positiveMoney,
  vietnamDate,
  type FinancialDocument,
} from './contracts'
import { useSourcePage } from './useSourcePage'

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
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [agencyFilter, setAgencyFilter] = useState('')
  const list = useSourcePage(
    path,
    { q, status, agencyId: agencyFilter, sort: '-businessDate' },
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
      setNotice(
        'Máy chủ đã tiếp nhận thao tác. Đang tải lại trạng thái có thẩm quyền.',
      )
      refresh()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-desc">
            Dữ liệu và phân bổ do máy chủ xác nhận. Không coi timeout hoặc
            chuyển hướng là đã thanh toán.
          </p>
        </div>
        {canPrepare && (
          <Button
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
        )}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      <div className="filter-bar">
        <Input
          label="Tìm chứng từ"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <Input
          label="ID đại lý"
          value={agencyFilter}
          onChange={(event) => setAgencyFilter(event.target.value)}
        />
        <Select
          label="Trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={['', 'DRAFT', 'PENDING', 'POSTED', 'CANCELLED'].map(
            (value) => ({ value, label: value || 'Tất cả' }),
          )}
        />
        <Button onClick={list.reload}>Tải lại</Button>
      </div>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.loading ? (
        <Spinner label="Đang tải chứng từ..." />
      ) : (
        <div className="card">
          <Table caption={title}>
            <thead>
              <tr>
                <th>Số phiếu</th>
                <th>Đại lý</th>
                <th>Ngày nghiệp vụ</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={String(row.id)}>
                  <td>{String(row.code)}</td>
                  <td>{String(row.agencyName ?? row.agencyId)}</td>
                  <td>{formatDate(String(row.businessDate))}</td>
                  <td>{formatVND(String(row.totalAmount))}</td>
                  <td>{String(row.status)}</td>
                  <td>
                    <Button
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
          {!list.items.length && <p>Không có chứng từ phù hợp.</p>}
          <Pagination
            hasNext={list.hasMore}
            hasPrevious={list.hasPrevious}
            onNext={list.next}
            onPrevious={list.previous}
            isLoading={list.loading}
            totalShowing={list.items.length}
          />
        </div>
      )}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={refund ? 'Lập yêu cầu hoàn tiền' : title}
      >
        <form onSubmit={create}>
          {error && <Alert type="error">{error}</Alert>}
          <Input
            label={refund ? 'ID phiếu thu nguồn đã ghi sổ' : 'ID đại lý'}
            value={refund ? originDocumentId : agencyId}
            onChange={(event) =>
              refund
                ? setOriginDocumentId(event.target.value)
                : setAgencyId(event.target.value)
            }
            required
          />
          <Input
            label="Ngày nghiệp vụ"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
          <Input
            label="Số tiền (VND nguyên)"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          {!credit && (
            <Select
              label="Phương thức"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              options={(refund
                ? ['CASH', 'BANK_TRANSFER', 'ONLINE']
                : ['CASH', 'BANK_TRANSFER']
              ).map((value) => ({ value, label: value }))}
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
          <div className="modal-actions">
            <Button type="submit" isLoading={busy}>
              Lưu bản nháp
            </Button>
            <Button onClick={() => setCreateOpen(false)}>Đóng</Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={!!selectedId}
        onClose={() => {
          setSelectedId(null)
          setDetail(null)
        }}
        title={`Chi tiết ${item?.code ?? selectedId ?? ''}`}
        maxWidth="lg"
      >
        {detailError && <Alert type="error">{detailError}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
        {!item ? (
          <Spinner label="Đang tải chi tiết..." />
        ) : (
          <>
            <dl className="detail-grid">
              <dt>Đại lý</dt>
              <dd>
                {item.currentRevision.agencySnapshot?.name ?? item.agencyId}
              </dd>
              <dt>Ngày nghiệp vụ</dt>
              <dd>{formatDate(item.currentRevision.businessDate)}</dd>
              <dt>Số tiền</dt>
              <dd>{formatVND(item.currentRevision.totalAmount)}</dd>
              <dt>Trạng thái chứng từ</dt>
              <dd>{item.status}</dd>
              <dt>Ghi chú</dt>
              <dd>{item.currentRevision.note ?? '-'}</dd>
            </dl>
            {credit && (
              <p>
                Tiền mặt phát sinh: 0 VND. Phân bổ dư có theo FIFO do máy chủ
                thực hiện.
              </p>
            )}
            {!manualReceipt && (
              <Alert type="info">
                Phiếu tự động/trực tuyến chỉ đọc, không chỉnh sửa hoặc ghi sổ
                thủ công.
              </Alert>
            )}
            {refund && (
              <>
                <p>
                  Đang giữ chỗ: {formatVND(item.reservedAmount)}. Đã hoàn:{' '}
                  {formatVND(item.refundedAmount)}. Lần thử:{' '}
                  {item.latestAttemptState ?? 'Chưa có'}.
                </p>
                {unknown && (
                  <Alert type="warning">
                    PENDING/UNKNOWN: tiền vẫn được giữ chỗ. Chỉ đối soát lần thử
                    hiện tại, không hủy hoặc tạo lần thử thứ hai.
                  </Alert>
                )}
              </>
            )}
            {!detail?.etag && (
              <Alert type="warning">
                Thiếu ETag. Tải lại chi tiết trước khi thao tác.
              </Alert>
            )}
            {item.status === 'DRAFT' && manualReceipt && (
              <div className="modal-actions">
                {canPost && (!refund || !reserved) && !unknown && (
                  <Button
                    disabled={!actionable}
                    onClick={() => action(refund ? 'submit' : 'post')}
                  >
                    {refund ? 'Giữ chỗ quỹ' : 'Ghi sổ'}
                  </Button>
                )}
                {refund &&
                  canPost &&
                  reserved &&
                  !unknown &&
                  item.currentRevision.paymentMethod !== 'ONLINE' && (
                    <div>
                      <Input
                        label="Thời điểm đã chi (ISO có múi giờ)"
                        value={paidAt}
                        onChange={(event) => setPaidAt(event.target.value)}
                      />
                      <Input
                        label="Tham chiếu bằng chứng chi tiền"
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                      />
                      <Button
                        disabled={
                          !actionable ||
                          !evidence.trim() ||
                          !/T.*(Z|[+-]\d\d:\d\d)$/.test(paidAt)
                        }
                        onClick={() =>
                          action('confirm-paid', {
                            paidAt,
                            evidenceReference: evidence.trim(),
                          })
                        }
                      >
                        Xác nhận đã chi tiền
                      </Button>
                    </div>
                  )}
                {refund &&
                  canPost &&
                  reserved &&
                  !unknown &&
                  item.currentRevision.paymentMethod === 'ONLINE' &&
                  !item.latestAttemptId && (
                    <Button
                      disabled={!actionable}
                      onClick={() => action('attempts')}
                    >
                      Yêu cầu hoàn trực tuyến
                    </Button>
                  )}
              </div>
            )}
            {refund && canPost && unknown && item.latestAttemptId && (
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
            {canCancel &&
              manualReceipt &&
              item.status !== 'CANCELLED' &&
              item.status !== 'PENDING' &&
              (!refund || (item.status === 'DRAFT' && !unknown)) && (
                <div>
                  <Input
                    label="Lý do hủy"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button
                    variant="danger"
                    disabled={!actionable || !reason.trim()}
                    onClick={() => action('cancel', { reason: reason.trim() })}
                  >
                    Hủy phiếu
                  </Button>
                </div>
              )}
            <Button
              onClick={() => {
                setDetail(null)
                setDetailError('')
                setDetailVersion((value) => value + 1)
              }}
            >
              Tải lại chi tiết
            </Button>
          </>
        )}
      </Modal>
    </div>
  )
}
