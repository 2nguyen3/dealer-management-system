import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import {
  decimal,
  id,
  Intent,
  message,
  positiveMoney,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'

function confirmation(value: unknown): Row {
  const data = record(value)
  id(data.id)
  id(data.issueRevisionId)
  id(data.issueDocumentId)
  decimal(data.amount)
  if (
    !['VERIFIED', 'CONSUMED', 'RECEIVED_SEPARATELY'].includes(text(data.state))
  )
    throw new Error('Invalid upfront state')
  return data
}

export function UpfrontPaymentsPage() {
  const { hasPermission } = useAuth()
  const canVerify = hasPermission('cash.upfront.verify')
  const canSeparate = hasPermission('cash.receipt.post')
  const [state, setState] = useState('')
  const [issueFilter, setIssueFilter] = useState('')
  const list = useSourcePage(
    '/upfront-confirmations',
    { state, issueDocumentId: issueFilter },
    confirmation,
  )
  const [revisionId, setRevisionId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [receivedAt, setReceivedAt] = useState('')
  const [evidence, setEvidence] = useState('')
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<{
    item: Row
    etag: string | null
  } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const intent = useRef(new Intent())
  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    let current = true
    apiFetch<unknown>(`/upfront-confirmations/${selected}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const item = confirmation(response.data)
        if (current) setDetail({ item, etag: response.etag })
      })
      .catch((failure: unknown) => {
        if (current) setError(message(failure))
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [selected])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canVerify) return
    setError('')
    try {
      const body = {
        issueRevisionId: id(revisionId),
        amount: positiveMoney(amount),
        method,
        receivedAt,
        evidenceReference: evidence.trim(),
      }
      if (
        !/T.*(Z|[+-]\d\d:\d\d)$/.test(receivedAt) ||
        Number.isNaN(Date.parse(receivedAt)) ||
        !evidence.trim()
      )
        throw new Error(
          'Cần thời điểm thực nhận có múi giờ và tham chiếu bằng chứng.',
        )
      setBusy(true)
      await intent.current.send('/upfront-confirmations', {
        method: 'POST',
        body,
      })
      setNotice(
        'Đã xác minh tiền thực nhận. VERIFIED chưa phải phiếu thu đã ghi sổ.',
      )
      invalidateCache('/upfront-confirmations')
      list.reload()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const separate = async () => {
    if (
      busy ||
      !canSeparate ||
      !detail?.etag ||
      detail.item.state !== 'VERIFIED' ||
      !reason.trim()
    )
      return
    setBusy(true)
    setError('')
    try {
      await intent.current.send(
        `/upfront-confirmations/${selected}/receive-separately`,
        {
          method: 'POST',
          ifMatch: detail.etag,
          body: { reason: reason.trim() },
        },
      )
      setNotice(
        'Đã ghi nhận tiền riêng. Không đồng nghĩa phiếu xuất đã ghi sổ.',
      )
      setDetail(null)
      setSelected('')
      for (const prefix of [
        '/upfront-confirmations',
        '/stock-issues',
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
  return (
    <div className="page-container">
      <h1 className="page-title">Xác nhận thanh toán trả ngay</h1>
      <p>
        Tiền gắn với đúng revision READY. VERIFIED chưa phải phiếu thu; xuất kho
        thất bại không làm mất tiền đã nhận.
      </p>
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}
      {list.error && <Alert type="error">{list.error}</Alert>}
      <div className="filter-bar">
        <Input
          label="ID phiếu xuất"
          value={issueFilter}
          onChange={(event) => setIssueFilter(event.target.value)}
        />
        <Select
          label="Trạng thái"
          value={state}
          onChange={(event) => setState(event.target.value)}
          options={['', 'VERIFIED', 'CONSUMED', 'RECEIVED_SEPARATELY'].map(
            (value) => ({ value, label: value || 'Tất cả' }),
          )}
        />
      </div>
      <Table caption="Các khoản thực nhận">
        <thead>
          <tr>
            <th>ID</th>
            <th>Phiếu xuất / Revision</th>
            <th>Số tiền</th>
            <th>Trạng thái</th>
            <th>Phiếu thu</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((item) => (
            <tr key={String(item.id)}>
              <td>{String(item.id)}</td>
              <td>
                #{String(item.issueDocumentId)} / #
                {String(item.issueRevisionId)}
              </td>
              <td>{formatVND(String(item.amount))}</td>
              <td>{String(item.state)}</td>
              <td>{String(item.receiptDocumentId ?? '-')}</td>
              <td>
                <Button
                  onClick={() => {
                    setDetail(null)
                    setSelected(String(item.id))
                  }}
                >
                  Chi tiết
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination
        hasNext={list.hasMore}
        hasPrevious={list.hasPrevious}
        onNext={list.next}
        onPrevious={list.previous}
        isLoading={list.loading}
      />
      {canVerify && (
        <form onSubmit={submit} className="card">
          <h2>Ghi nhận bằng chứng thực nhận</h2>
          <Input
            label="ID revision phiếu xuất READY"
            value={revisionId}
            onChange={(event) => setRevisionId(event.target.value)}
            required
          />
          <Input
            label="Số tiền (VND nguyên)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <Select
            label="Phương thức"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            options={['CASH', 'BANK_TRANSFER'].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Input
            label="Thời điểm thực nhận (ISO có múi giờ)"
            value={receivedAt}
            onChange={(event) => setReceivedAt(event.target.value)}
            required
          />
          <Input
            label="Tham chiếu bằng chứng"
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            required
          />
          <Button type="submit" isLoading={busy}>
            Xác minh tiền thực nhận
          </Button>
        </form>
      )}
      {detail && (
        <section className="card">
          <h2>Xác nhận #{String(detail.item.id)}</h2>
          <p>
            {String(detail.item.state)}. Bằng chứng:{' '}
            {String(detail.item.evidenceReference ?? '-')}
          </p>
          {canSeparate && detail.item.state === 'VERIFIED' && (
            <>
              <Input
                label="Lý do ghi nhận tiền riêng"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button
                disabled={busy || !detail.etag || !reason.trim()}
                onClick={separate}
              >
                Ghi nhận tiền riêng
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  )
}
