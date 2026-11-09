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
import { formatDateTime, formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import {
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
import { useSourcePage } from '../payment_receipts/useSourcePage'

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
  const [reference, setReference] = useState('')
  const [agencyFilter, setAgencyFilter] = useState('')
  const [status, setStatus] = useState('')
  const list = useSourcePage(
    '/online-payments',
    { merchantReference: reference, agencyId: agencyFilter, status },
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
  const intent = useRef(new Intent())

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    let current = true
    apiFetch<unknown>(`/online-payments/${selected}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const item = payment(response.data)
        if (current) setDetail(item)
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
      })
      const item = payment(response.data)
      setOpen(false)
      setSelected(id(item.id))
      setDetail(item)
      setNotice(
        response.status === 202
          ? 'Đang khởi tạo checkout. Theo dõi giao dịch hiện tại, không tạo lại.'
          : 'Đã khởi tạo giao dịch, chưa xác nhận nhận tiền.',
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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Thanh toán trực tuyến</h1>
          <p className="page-desc">
            Chuyển hướng và trang return không phải bằng chứng thanh toán. Chỉ
            trạng thái máy chủ đã xác minh mới có thẩm quyền.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>Tạo thanh toán mới</Button>
        )}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}
      <div className="filter-bar">
        <Input
          label="Mã tham chiếu"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
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
          options={['', 'PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].map(
            (value) => ({ value, label: value || 'Tất cả' }),
          )}
        />
        <Button onClick={list.reload}>Tải lại</Button>
      </div>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.loading ? (
        <Spinner />
      ) : (
        <div className="card">
          <Table caption="Giao dịch trực tuyến">
            <thead>
              <tr>
                <th>Mã tham chiếu</th>
                <th>Đại lý</th>
                <th>Cổng</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={String(item.id)}>
                  <td>{String(item.merchantReference)}</td>
                  <td>#{String(item.agencyId)}</td>
                  <td>{String(item.provider)}</td>
                  <td>{formatVND(String(item.amount))}</td>
                  <td>{String(item.status)}</td>
                  <td>
                    <Button
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
          {!list.items.length && <p>Không có giao dịch phù hợp.</p>}
          <Pagination
            hasNext={list.hasMore}
            hasPrevious={list.hasPrevious}
            onNext={list.next}
            onPrevious={list.previous}
            totalShowing={list.items.length}
          />
        </div>
      )}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Tạo thanh toán trực tuyến"
      >
        <form onSubmit={create}>
          {error && <Alert type="error">{error}</Alert>}
          <Input
            label="ID đại lý thanh toán"
            value={agencyId}
            onChange={(event) => setAgencyId(event.target.value)}
            required
          />
          <Input
            label="Số tiền thanh toán (VND nguyên)"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <p>
            Cổng: VNPAY. Chỉ cổng đã được chọn cho hệ thống này; máy chủ kiểm
            tra cấu hình trước khi tạo checkout.
          </p>
          <div className="modal-actions">
            <Button type="submit" isLoading={busy}>
              Khởi tạo thanh toán
            </Button>
            <Button onClick={() => setOpen(false)}>Đóng</Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={!!selected}
        onClose={() => {
          setSelected(null)
          setDetail(null)
        }}
        title="Chi tiết giao dịch"
        maxWidth="lg"
      >
        {!detail ? (
          <Spinner />
        ) : (
          <>
            <p>
              {String(detail.merchantReference)}: {String(detail.status)}
            </p>
            <p>Số tiền: {formatVND(String(detail.amount))}</p>
            <p>
              Phiếu thu xác minh:{' '}
              {detail.receiptDocumentId
                ? `#${String(detail.receiptDocumentId)}`
                : 'Chưa có'}
            </p>
            <p>
              Thời điểm thanh toán:{' '}
              {detail.paymentTime
                ? formatDateTime(String(detail.paymentTime))
                : 'Chưa xác minh'}
            </p>
            {url && detail.status === 'PENDING' && (
              <a href={url} target="_blank" rel="noreferrer">
                Mở trang thanh toán
              </a>
            )}
            {canManage && detail.status !== 'SUCCESS' && (
              <Button disabled={busy} onClick={reconcile}>
                Đối soát giao dịch hiện tại
              </Button>
            )}
            <Button onClick={() => setVersion((value) => value + 1)}>
              Kiểm tra trạng thái
            </Button>
            {canManage && (
              <>
                <h3>Sự kiện đã chuẩn hóa</h3>
                {events.map((event) => (
                  <p key={String(event.id)}>
                    {String(event.eventKey)}: {String(event.providerStatus)}
                  </p>
                ))}
                {eventsMore && (
                  <p>
                    Chỉ hiển thị trang 25 sự kiện đầu, không phải toàn bộ lịch
                    sử.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
