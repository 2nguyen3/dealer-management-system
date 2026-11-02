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
import { formatDate, formatVND } from '../../lib/formatters'
import type { Agency, PaymentReceipt } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function PaymentReceiptsPage() {
  const { hasPermission } = useAuth()
  const canPrepare = hasPermission('cash.receipt.prepare')
  const canPost = hasPermission('cash.receipt.post')

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    const cached = getCachedData<Agency[] | { items: Agency[] }>('/agencies')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [receipts, setReceipts] = useState<PaymentReceipt[]>(() => {
    const cached = getCachedData<
      PaymentReceipt[] | { items: PaymentReceipt[] }
    >('/payment-receipts')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [isLoading, setIsLoading] = useState(() => receipts.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const [filterAgency, setFilterAgency] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [detailReceipt, setDetailReceipt] = useState<{
    receipt: PaymentReceipt
    etag: string | null
  } | null>(null)

  // Create form
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().split('T')[0] || '',
  )
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>(
    'CASH',
  )
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/payment-receipts')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      bypassCache
        ? apiFetch<PaymentReceipt[] | { items: PaymentReceipt[] }>(
            '/payment-receipts',
          )
        : cachedApiFetch<PaymentReceipt[] | { items: PaymentReceipt[] }>(
            '/payment-receipts',
          ),
    ])
      .then(([aRes, rRes]) => {
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const rItems = Array.isArray(rRes.data)
          ? rRes.data
          : rRes.data.items || []
        setAgencies(aItems)
        setReceipts(rItems)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu thu tiền.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      cachedApiFetch<PaymentReceipt[] | { items: PaymentReceipt[] }>(
        '/payment-receipts',
      ),
    ])
      .then(([aRes, rRes]) => {
        if (!isMounted) return
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const rItems = Array.isArray(rRes.data)
          ? rRes.data
          : rRes.data.items || []
        setAgencies(aItems)
        setReceipts(rItems)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu thu tiền.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Fast in-memory filtering (0ms latency on filter change)
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (filterAgency && r.agencyId !== filterAgency) return false
      if (filterStatus && r.status !== filterStatus) return false
      return true
    })
  }, [receipts, filterAgency, filterStatus])

  const paginatedReceipts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredReceipts.slice(start, start + pageSize)
  }, [filteredReceipts, page, pageSize])

  const openCreateModal = () => {
    setSelectedAgencyId(agencies[0] ? agencies[0].id : '')
    setDocumentDate(new Date().toISOString().split('T')[0] || '')
    setAmount('')
    setPaymentMethod('CASH')
    setNote('')
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!selectedAgencyId) {
      setFormError('Vui lòng chọn đại lý nộp tiền.')
      return
    }

    if (!amount.trim() || Number(amount) <= 0) {
      setFormError('Số tiền thu phải lớn hơn 0.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/payment-receipts', {
        method: 'POST',
        body: {
          agencyId: selectedAgencyId,
          documentDate,
          amount: amount.trim(),
          paymentMethod,
          note: note.trim() || undefined,
        },
      })
      setIsCreateOpen(false)
      setSuccessNotice('Đã tạo bản nháp phiếu thu tiền.')
      invalidateCache('/payment-receipts')
      invalidateCache('/receivables')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo phiếu thu tiền.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly with existing receipt data, loads allocation breakdown in background if needed
  const openDetailModal = (receipt: PaymentReceipt) => {
    setDetailReceipt({ receipt, etag: null })
    if (!receipt.allocations || receipt.allocations.length === 0) {
      apiFetch<PaymentReceipt>(`/payment-receipts/${receipt.id}`)
        .then((res: ApiResponse<PaymentReceipt>) => {
          setDetailReceipt({ receipt: res.data, etag: res.etag })
        })
        .catch(() => {})
    }
  }

  const handlePostReceipt = async () => {
    if (!detailReceipt) return
    setIsSubmitting(true)
    try {
      await apiFetch(`/payment-receipts/${detailReceipt.receipt.id}/post`, {
        method: 'POST',
        ifMatch: detailReceipt.etag || undefined,
      })
      setSuccessNotice(
        `Đã ghi nhận thanh toán cho phiếu thu ${detailReceipt.receipt.code}.`,
      )
      setDetailReceipt(null)
      invalidateCache('/payment-receipts')
      invalidateCache('/receivables')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Không thể ghi sổ phiếu thu.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Phiếu thu tiền</h1>
          <p className="page-desc">
            Ghi nhận các khoản thanh toán công nợ của đại lý (phân bổ tự động
            theo FIFO)
          </p>
        </div>
        {canPrepare && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Lập phiếu thu mới
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successNotice && <Alert type="success">{successNotice}</Alert>}

      <div className="filter-bar">
        <div className="filter-select">
          <Select
            value={filterAgency}
            onChange={(e) => setFilterAgency(e.target.value)}
            options={[
              { value: '', label: 'Tất cả đại lý' },
              ...agencies.map((a) => ({
                value: a.id,
                label: `${a.code} - ${a.name}`,
              })),
            ]}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'DRAFT', label: 'Bản nháp (DRAFT)' },
              { value: 'POSTED', label: 'Đã ghi sổ (POSTED)' },
              { value: 'CANCELED', label: 'Đã hủy (CANCELED)' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách phiếu thu..." />
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="card empty-card">
          <p>Không có phiếu thu tiền nào.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách phiếu thu tiền">
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Đại lý nộp tiền</th>
                <th scope="col">Ngày thu</th>
                <th scope="col">Hình thức</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Số tiền thu
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedReceipts.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono font-bold">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => openDetailModal(r)}
                    >
                      {r.code}
                    </button>
                  </td>
                  <td>
                    <strong>{r.agencyName || `Đại lý #${r.agencyId}`}</strong>
                  </td>
                  <td>{formatDate(r.businessDate || r.documentDate)}</td>
                  <td>
                    {r.paymentMethod === 'CASH'
                      ? 'Tiền mặt'
                      : r.paymentMethod === 'ONLINE'
                        ? 'Trực tuyến'
                        : 'Chuyển khoản'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(r.totalAmount || r.amount)}
                  </td>
                  <td>
                    {r.status === 'POSTED' ? (
                      <Badge variant="success">Đã ghi sổ</Badge>
                    ) : r.status === 'DRAFT' ? (
                      <Badge variant="warning">Bản nháp</Badge>
                    ) : (
                      <Badge variant="neutral">Đã hủy</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetailModal(r)}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination
            onNext={() => setPage((p) => p + 1)}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            hasNext={page * pageSize < filteredReceipts.length}
            hasPrevious={page > 1}
            limit={pageSize}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit)
              setPage(1)
            }}
            totalShowing={filteredReceipts.length}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Lập phiếu thu tiền mới"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Select
            label="Đại lý nộp tiền"
            value={selectedAgencyId}
            onChange={(e) => setSelectedAgencyId(e.target.value)}
            options={agencies.map((a) => ({
              value: a.id,
              label: `${a.code} - ${a.name} (Nợ hiện tại: ${formatVND(a.currentDebt)})`,
            }))}
            required
            autoFocus
          />
          <div className="grid-2">
            <Input
              label="Ngày thu tiền"
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              required
            />
            <Select
              label="Hình thức thanh toán"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as 'CASH' | 'BANK_TRANSFER')
              }
              options={[
                { value: 'CASH', label: 'Tiền mặt' },
                { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
              ]}
              required
            />
          </div>
          <Input
            label="Số tiền thu (VND)"
            type="number"
            min="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ví dụ: 10000000"
            required
          />
          <Input
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nội dung nộp tiền..."
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Tạo phiếu thu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailReceipt}
        onClose={() => setDetailReceipt(null)}
        title={`Chi tiết phiếu thu: ${detailReceipt?.receipt.code}`}
        maxWidth="md"
      >
        {detailReceipt && (
          <div className="receipt-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Số phiếu:</span>
                <span className="detail-value font-mono font-bold">
                  {detailReceipt.receipt.code}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Đại lý:</span>
                <span className="detail-value font-bold">
                  {detailReceipt.receipt.agencyName ||
                    detailReceipt.receipt.agencyId}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ngày thu:</span>
                <span className="detail-value">
                  {formatDate(
                    detailReceipt.receipt.businessDate ||
                      detailReceipt.receipt.documentDate,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Hình thức:</span>
                <span className="detail-value">
                  {detailReceipt.receipt.paymentMethod === 'CASH'
                    ? 'Tiền mặt'
                    : 'Chuyển khoản'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Số tiền:</span>
                <span className="detail-value font-bold text-success">
                  {formatVND(
                    detailReceipt.receipt.totalAmount ||
                      detailReceipt.receipt.amount,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Trạng thái:</span>
                <span className="detail-value">
                  {detailReceipt.receipt.status === 'POSTED' ? (
                    <Badge variant="success">Đã ghi sổ</Badge>
                  ) : detailReceipt.receipt.status === 'DRAFT' ? (
                    <Badge variant="warning">Bản nháp</Badge>
                  ) : (
                    <Badge variant="neutral">Đã hủy</Badge>
                  )}
                </span>
              </div>
              {detailReceipt.receipt.note && (
                <div className="detail-item detail-item--full">
                  <span className="detail-label">Ghi chú:</span>
                  <span className="detail-value">
                    {detailReceipt.receipt.note}
                  </span>
                </div>
              )}
            </div>

            {detailReceipt.receipt.allocations &&
              detailReceipt.receipt.allocations.length > 0 && (
                <div className="lines-detail-section">
                  <h3 className="section-title">
                    Phân bổ thanh toán cho các hóa đơn
                  </h3>
                  <div className="table-responsive">
                    <table className="table table--compact">
                      <thead>
                        <tr>
                          <th scope="col">Mã hóa đơn xuất</th>
                          <th scope="col" style={{ textAlign: 'right' }}>
                            Số tiền trừ nợ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailReceipt.receipt.allocations.map((alloc, idx) => (
                          <tr key={idx}>
                            <td className="font-mono">{alloc.invoiceCode}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatVND(alloc.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            <div className="modal-actions">
              <Button variant="outline" onClick={() => setDetailReceipt(null)}>
                Đóng
              </Button>
              {canPost && detailReceipt.receipt.status === 'DRAFT' && (
                <Button
                  variant="primary"
                  onClick={handlePostReceipt}
                  isLoading={isSubmitting}
                >
                  Ghi sổ phiếu thu
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
