import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PlusIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch, type ApiResponse } from '../../lib/api'
import { cachedApiFetch, getCachedData, invalidateCache } from '../../lib/cache'
import { formatDateTime, formatVND } from '../../lib/formatters'
import type { Agency, AgencyBalance, OnlinePayment } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function OnlinePaymentsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('payments.online')

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    const cached = getCachedData<Agency[] | { items: Agency[] }>('/agencies')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [payments, setPayments] = useState<OnlinePayment[]>(() => {
    const cached = getCachedData<OnlinePayment[] | { items: OnlinePayment[] }>(
      '/online-payments',
    )
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [balances, setBalances] = useState<Record<string, AgencyBalance>>({})
  const [isLoading, setIsLoading] = useState(() => payments.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAgency, setFilterAgency] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Detail Modal
  const [detailItem, setDetailItem] = useState<OnlinePayment | null>(null)
  const [detailEvents, setDetailEvents] = useState<
    Array<{
      id: string
      eventType: string
      payload?: string
      createdAt: string
    }>
  >([])
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isReconciling, setIsReconciling] = useState(false)

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  const [provider, setProvider] = useState('SANDBOX')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [createdCheckoutUrl, setCreatedCheckoutUrl] = useState<string | null>(
    null,
  )

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/online-payments')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      bypassCache
        ? apiFetch<OnlinePayment[] | { items: OnlinePayment[] }>(
            '/online-payments',
          )
        : cachedApiFetch<OnlinePayment[] | { items: OnlinePayment[] }>(
            '/online-payments',
          ),
      cachedApiFetch<AgencyBalance[] | { items: AgencyBalance[] }>(
        '/receivables/balances',
      ).catch(() => ({ data: [] as AgencyBalance[] })),
    ])
      .then(([aRes, pRes, bRes]) => {
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const pItems = Array.isArray(pRes.data)
          ? pRes.data
          : pRes.data.items || []
        const bItems = Array.isArray(bRes.data)
          ? bRes.data
          : 'items' in bRes.data
            ? bRes.data.items || []
            : []

        setAgencies(aItems)
        setPayments(pItems)

        const bMap: Record<string, AgencyBalance> = {}
        for (const b of bItems) {
          bMap[b.agencyId] = b
        }
        setBalances(bMap)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách giao dịch trực tuyến.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      cachedApiFetch<OnlinePayment[] | { items: OnlinePayment[] }>(
        '/online-payments',
      ).catch(() => ({ data: [] as OnlinePayment[] })),
      cachedApiFetch<AgencyBalance[] | { items: AgencyBalance[] }>(
        '/receivables/balances',
      ).catch(() => ({ data: [] as AgencyBalance[] })),
    ])
      .then(([aRes, pRes, bRes]) => {
        if (!isMounted) return
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const pItems = Array.isArray(pRes.data)
          ? pRes.data
          : 'items' in pRes.data
            ? pRes.data.items || []
            : []
        const bItems = Array.isArray(bRes.data)
          ? bRes.data
          : 'items' in bRes.data
            ? bRes.data.items || []
            : []

        setAgencies(aItems)
        setPayments(pItems)

        const bMap: Record<string, AgencyBalance> = {}
        for (const b of bItems) {
          bMap[b.agencyId] = b
        }
        setBalances(bMap)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách giao dịch trực tuyến.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Agency selection balance
  const selectedAgencyBalance = selectedAgencyId
    ? balances[selectedAgencyId]
    : undefined

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      if (filterAgency && String(item.agencyId) !== filterAgency) {
        return false
      }
      if (filterStatus && item.status !== filterStatus) {
        return false
      }
      if (filterProvider && item.provider !== filterProvider) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchRef = item.merchantReference?.toLowerCase().includes(q)
        const matchId = item.id?.toLowerCase().includes(q)
        const matchAgency = item.agencyName?.toLowerCase().includes(q)
        if (!matchRef && !matchId && !matchAgency) return false
      }
      return true
    })
  }, [payments, filterAgency, filterStatus, filterProvider, searchQuery])

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredPayments.slice(start, start + pageSize)
  }, [filteredPayments, page, pageSize])

  const openDetail = (item: OnlinePayment) => {
    setActionError(null)
    setActionNotice(null)
    setDetailItem(item)
    setDetailEvents([])
    setIsDetailLoading(true)

    Promise.all([
      apiFetch<OnlinePayment>(`/online-payments/${item.id}`).catch(() => ({
        data: item,
      })),
      apiFetch<
        Array<{
          id: string
          eventType: string
          payload?: string
          createdAt: string
        }>
      >(`/online-payments/${item.id}/events`).catch(() => ({ data: [] })),
    ])
      .then(([pRes, eRes]) => {
        setDetailItem(pRes.data)
        setDetailEvents(Array.isArray(eRes.data) ? eRes.data : [])
      })
      .finally(() => {
        setIsDetailLoading(false)
      })
  }

  const handleReconcile = async (paymentId: string) => {
    setActionError(null)
    setActionNotice(null)
    setIsReconciling(true)
    try {
      const res: ApiResponse<OnlinePayment> = await apiFetch(
        `/online-payments/${paymentId}/reconcile`,
        {
          method: 'POST',
          idempotencyKey: crypto.randomUUID(),
        },
      )
      setDetailItem(res.data)
      setActionNotice(
        `Đối soát thành công! Trạng thái hiện tại: ${res.data.status}.`,
      )
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message || 'Không thể thực hiện đối soát giao dịch.')
    } finally {
      setIsReconciling(false)
    }
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedAgencyId) {
      setFormError('Vui lòng chọn đại lý.')
      return
    }
    const cleanAmount = amount.replace(/\D/g, '')
    if (!cleanAmount || cleanAmount === '0') {
      setFormError('Vui lòng nhập số tiền thanh toán hợp lệ.')
      return
    }

    setFormError(null)
    setIsSubmitting(true)
    setCreatedCheckoutUrl(null)

    try {
      const res: ApiResponse<OnlinePayment> = await apiFetch(
        '/online-payments',
        {
          method: 'POST',
          idempotencyKey: crypto.randomUUID(),
          body: {
            agencyId: selectedAgencyId,
            provider,
            amount: cleanAmount,
          },
        },
      )

      setSuccessNotice('Khởi tạo giao dịch thanh toán trực tuyến thành công.')
      if (res.data?.checkoutUrl) {
        setCreatedCheckoutUrl(res.data.checkoutUrl)
      } else {
        setIsCreateOpen(false)
      }
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể khởi tạo giao dịch.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success">Thành công</Badge>
      case 'PENDING':
        return <Badge variant="warning">Đang chờ</Badge>
      case 'FAILED':
        return <Badge variant="danger">Thất bại</Badge>
      case 'EXPIRED':
        return <Badge variant="neutral">Hết hạn</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Thanh toán trực tuyến</h1>
          <p className="page-desc">
            Khởi tạo link/QR thanh toán nợ đại lý qua cổng thanh toán sandbox và
            theo dõi đối soát giao dịch
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={() => {
              setFormError(null)
              setCreatedCheckoutUrl(null)
              setSelectedAgencyId('')
              setAmount('')
              setIsCreateOpen(true)
            }}
          >
            <PlusIcon size={16} /> Tạo thanh toán mới
          </Button>
        )}
      </div>

      {successNotice && <Alert type="success">{successNotice}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      <div className="card filter-bar">
        <div className="filter-inputs">
          <Input
            placeholder="Tìm theo mã giao dịch, đại lý..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
          <Select
            value={filterAgency}
            onChange={(e) => {
              setFilterAgency(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả đại lý' },
              ...agencies.map((a) => ({
                value: a.id,
                label: `${a.code} - ${a.name}`,
              })),
            ]}
          />
          <Select
            value={filterProvider}
            onChange={(e) => {
              setFilterProvider(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả cổng thanh toán' },
              { value: 'SANDBOX', label: 'Cổng Sandbox' },
              { value: 'VNPAY', label: 'VNPay' },
              { value: 'MOMO', label: 'MoMo' },
              { value: 'VIETQR', label: 'VietQR' },
            ]}
          />
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'PENDING', label: 'Đang chờ (PENDING)' },
              { value: 'SUCCESS', label: 'Thành công (SUCCESS)' },
              { value: 'FAILED', label: 'Thất bại (FAILED)' },
              { value: 'EXPIRED', label: 'Hết hạn (EXPIRED)' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách giao dịch trực tuyến..." />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="card empty-card">
          <p>Không có giao dịch thanh toán trực tuyến nào phù hợp.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách giao dịch thanh toán trực tuyến">
            <thead>
              <tr>
                <th scope="col">Mã giao dịch</th>
                <th scope="col">Đại lý</th>
                <th scope="col">Cổng</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Số tiền
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thời gian tạo</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono font-bold">
                    {p.merchantReference || p.id}
                  </td>
                  <td>
                    <strong>{p.agencyName || `Đại lý #${p.agencyId}`}</strong>
                  </td>
                  <td>
                    <span className="badge badge--neutral">{p.provider}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(p.amount)}
                  </td>
                  <td>{getStatusBadge(p.status)}</td>
                  <td>{formatDateTime(p.createdAt)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        justifyContent: 'center',
                      }}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openDetail(p)}
                      >
                        Chi tiết
                      </Button>
                      {p.checkoutUrl && p.status === 'PENDING' && (
                        <a
                          href={p.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn--primary btn--sm"
                          style={{ textDecoration: 'none' }}
                        >
                          Mở link
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination
            limit={pageSize}
            onLimitChange={(size: number) => {
              setPageSize(size)
              setPage(1)
            }}
            totalShowing={paginatedItems.length}
            hasPrevious={page > 1}
            hasNext={page * pageSize < filteredPayments.length}
            onPrevious={() => setPage((pr) => Math.max(1, pr - 1))}
            onNext={() => setPage((pr) => pr + 1)}
          />
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <Modal
          isOpen={true}
          title={`Chi tiết giao dịch #${detailItem.merchantReference || detailItem.id}`}
          onClose={() => setDetailItem(null)}
          maxWidth="lg"
        >
          {actionNotice && <Alert type="success">{actionNotice}</Alert>}
          {actionError && <Alert type="error">{actionError}</Alert>}

          {isDetailLoading ? (
            <div className="modal-loading">
              <Spinner label="Đang tải chi tiết giao dịch..." />
            </div>
          ) : (
            <div className="detail-modal-body">
              <div className="detail-grid">
                <div>
                  <span className="detail-label">Mã giao dịch:</span>
                  <span className="font-mono font-bold">{detailItem.id}</span>
                </div>
                <div>
                  <span className="detail-label">Mã tham chiếu:</span>
                  <span className="font-mono">
                    {detailItem.merchantReference || '—'}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Đại lý:</span>
                  <span>
                    {detailItem.agencyName || `Đại lý #${detailItem.agencyId}`}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Cổng thanh toán:</span>
                  <span>{detailItem.provider}</span>
                </div>
                <div>
                  <span className="detail-label">Số tiền giao dịch:</span>
                  <span
                    className="font-bold text-success"
                    style={{ fontSize: '1.1rem' }}
                  >
                    {formatVND(detailItem.amount)}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Trạng thái:</span>
                  <span>{getStatusBadge(detailItem.status)}</span>
                </div>
                <div>
                  <span className="detail-label">
                    Mã đối tác (Provider ID):
                  </span>
                  <span className="font-mono">
                    {detailItem.providerTransactionId || 'Chưa nhận'}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Thời điểm thanh toán:</span>
                  <span>
                    {detailItem.paymentTime
                      ? formatDateTime(detailItem.paymentTime)
                      : 'Chưa hoàn tất'}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Phiếu thu ghi nhận:</span>
                  <span>
                    {detailItem.receiptDocumentId ? (
                      <span className="font-mono font-bold text-primary">
                        {detailItem.receiptDocumentCode ||
                          `#${detailItem.receiptDocumentId}`}
                      </span>
                    ) : (
                      'Chưa lập (chờ thanh toán thành công)'
                    )}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Hạn thanh toán:</span>
                  <span>
                    {detailItem.expiresAt
                      ? formatDateTime(detailItem.expiresAt)
                      : '—'}
                  </span>
                </div>
              </div>

              {detailItem.checkoutUrl && detailItem.status === 'PENDING' && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.75rem',
                    background: 'var(--color-bg-subtle, #f8f9fa)',
                    borderRadius: '6px',
                  }}
                >
                  <span className="detail-label">Đường dẫn thanh toán:</span>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      marginTop: '0.25rem',
                    }}
                  >
                    <Input
                      value={detailItem.checkoutUrl}
                      readOnly
                      style={{ fontSize: '0.875rem' }}
                    />
                    <a
                      href={detailItem.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--primary btn--sm"
                      style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}
                    >
                      Mở trang
                    </a>
                  </div>
                </div>
              )}

              {/* Event Log Section */}
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                  Lịch sử sự kiện (Webhook & Đối soát)
                </h3>
                {detailEvents.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--color-text-muted, #6c757d)',
                      fontSize: '0.875rem',
                    }}
                  >
                    Chưa có sự kiện callback webhook nào từ cổng thanh toán.
                  </p>
                ) : (
                  <Table caption="Nhật ký sự kiện">
                    <thead>
                      <tr>
                        <th>Sự kiện</th>
                        <th>Thời gian</th>
                        <th>Nội dung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailEvents.map((ev) => (
                        <tr key={ev.id}>
                          <td>
                            <span className="badge badge--neutral">
                              {ev.eventType}
                            </span>
                          </td>
                          <td>{formatDateTime(ev.createdAt)}</td>
                          <td
                            className="font-mono"
                            style={{ fontSize: '0.8rem' }}
                          >
                            {ev.payload || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                {canManage && detailItem.status === 'PENDING' && (
                  <Button
                    variant="primary"
                    isLoading={isReconciling}
                    onClick={() => handleReconcile(detailItem.id)}
                  >
                    Kiểm tra đối soát ngay
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDetailItem(null)}>
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={true}
          title="Tạo thanh toán trực tuyến"
          onClose={() => setIsCreateOpen(false)}
          maxWidth="md"
        >
          {createdCheckoutUrl ? (
            <div>
              <Alert type="success">
                Đã khởi tạo link thanh toán thành công! Bạn có thể chuyển hướng
                đại lý tới cổng thanh toán.
              </Alert>
              <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                <label className="form-label">Link thanh toán:</label>
                <Input value={createdCheckoutUrl} readOnly />
              </div>
              <div className="modal-actions">
                <a
                  href={createdCheckoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn--primary"
                  style={{ textDecoration: 'none' }}
                >
                  Đến trang thanh toán
                </a>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsCreateOpen(false)
                    setCreatedCheckoutUrl(null)
                  }}
                >
                  Đóng
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit}>
              {formError && <Alert type="error">{formError}</Alert>}

              <div className="form-group">
                <Select
                  id="online-agency"
                  label="Đại lý thanh toán"
                  value={selectedAgencyId}
                  onChange={(e) => setSelectedAgencyId(e.target.value)}
                  options={[
                    { value: '', label: '-- Chọn đại lý --' },
                    ...agencies.map((a) => ({
                      value: a.id,
                      label: `${a.code} - ${a.name}`,
                    })),
                  ]}
                  required
                />
              </div>

              {selectedAgencyBalance && (
                <div
                  style={{
                    background: 'var(--color-bg-subtle, #f8f9fa)',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span>Dư nợ hiện tại:</span>
                    <strong className="text-danger">
                      {formatVND(selectedAgencyBalance.currentDebt)}
                    </strong>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setAmount(selectedAgencyBalance.currentDebt || '0')
                    }
                  >
                    Thanh toán toàn bộ nợ
                  </Button>
                </div>
              )}

              <div className="form-group">
                <Select
                  id="online-provider"
                  label="Cổng thanh toán"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  options={[
                    { value: 'SANDBOX', label: 'Cổng Sandbox thử nghiệm' },
                    { value: 'VNPAY', label: 'VNPay Cổng nội địa' },
                    { value: 'MOMO', label: 'Ví điện tử MoMo' },
                    { value: 'VIETQR', label: 'Mã chuẩn VietQR' },
                  ]}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="online-amount">
                  Số tiền thanh toán (₫) (*)
                </label>
                <Input
                  id="online-amount"
                  type="text"
                  placeholder="Nhập số tiền..."
                  value={amount ? Number(amount).toLocaleString('vi-VN') : ''}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                >
                  Khởi tạo thanh toán
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Hủy bỏ
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}
