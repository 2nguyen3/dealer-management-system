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
import type { Agency, AgencyBalance, CreditLot, Refund } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function RefundsPage() {
  const { hasPermission } = useAuth()
  const canPrepare = hasPermission('cash.refund.prepare')
  const canPost = hasPermission('cash.refund.post')

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    const cached = getCachedData<Agency[] | { items: Agency[] }>('/agencies')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [refunds, setRefunds] = useState<Refund[]>(() => {
    const cached = getCachedData<Refund[] | { items: Refund[] }>('/refunds')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [balances, setBalances] = useState<Record<string, AgencyBalance>>({})
  const [creditLots, setCreditLots] = useState<CreditLot[]>([])
  const [isLoading, setIsLoading] = useState(() => refunds.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAgency, setFilterAgency] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Detail Modal
  const [detailItem, setDetailItem] = useState<{
    refund: Refund
    etag: string | null
  } | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  const [originDocumentId, setOriginDocumentId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().split('T')[0] || '',
  )
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/refunds')
      invalidateCache('/agency-credit/lots')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      bypassCache
        ? apiFetch<Refund[] | { items: Refund[] }>('/refunds')
        : cachedApiFetch<Refund[] | { items: Refund[] }>('/refunds'),
      cachedApiFetch<AgencyBalance[] | { items: AgencyBalance[] }>(
        '/receivables/balances',
      ).catch(() => ({ data: [] as AgencyBalance[] })),
      cachedApiFetch<CreditLot[] | { items: CreditLot[] }>(
        '/agency-credit/lots',
      ).catch(() => ({ data: [] as CreditLot[] })),
    ])
      .then(([aRes, rRes, bRes, lRes]) => {
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const rItems = Array.isArray(rRes.data)
          ? rRes.data
          : rRes.data.items || []
        const bItems = Array.isArray(bRes.data)
          ? bRes.data
          : 'items' in bRes.data
            ? bRes.data.items || []
            : []
        const lItems = Array.isArray(lRes.data)
          ? lRes.data
          : 'items' in lRes.data
            ? lRes.data.items || []
            : []

        setAgencies(aItems)
        setRefunds(rItems)
        setCreditLots(lItems)

        const bMap: Record<string, AgencyBalance> = {}
        for (const b of bItems) {
          bMap[b.agencyId] = b
        }
        setBalances(bMap)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu hoàn tiền.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      cachedApiFetch<Refund[] | { items: Refund[] }>('/refunds').catch(() => ({
        data: [] as Refund[],
      })),
      cachedApiFetch<AgencyBalance[] | { items: AgencyBalance[] }>(
        '/receivables/balances',
      ).catch(() => ({ data: [] as AgencyBalance[] })),
      cachedApiFetch<CreditLot[] | { items: CreditLot[] }>(
        '/agency-credit/lots',
      ).catch(() => ({ data: [] as CreditLot[] })),
    ])
      .then(([aRes, rRes, bRes, lRes]) => {
        if (!isMounted) return
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const rItems = Array.isArray(rRes.data)
          ? rRes.data
          : 'items' in rRes.data
            ? rRes.data.items || []
            : []
        const bItems = Array.isArray(bRes.data)
          ? bRes.data
          : 'items' in bRes.data
            ? bRes.data.items || []
            : []
        const lItems = Array.isArray(lRes.data)
          ? lRes.data
          : 'items' in lRes.data
            ? lRes.data.items || []
            : []

        setAgencies(aItems)
        setRefunds(rItems)
        setCreditLots(lItems)

        const bMap: Record<string, AgencyBalance> = {}
        for (const b of bItems) {
          bMap[b.agencyId] = b
        }
        setBalances(bMap)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu hoàn tiền.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Agency selection balance & lots
  const selectedAgencyBalance = selectedAgencyId
    ? balances[selectedAgencyId]
    : undefined

  const agencyCreditLots = useMemo(() => {
    if (!selectedAgencyId) return []
    return creditLots.filter((lot) => String(lot.agencyId) === selectedAgencyId)
  }, [creditLots, selectedAgencyId])

  // Filtered list
  const filteredRefunds = useMemo(() => {
    return refunds.filter((item) => {
      if (filterAgency && String(item.agencyId) !== filterAgency) {
        return false
      }
      if (filterStatus && item.status !== filterStatus) {
        return false
      }
      const method =
        item.paymentMethod ||
        item.method ||
        item.currentRevision?.paymentMethod ||
        ''
      if (filterMethod && method !== filterMethod) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = item.code?.toLowerCase().includes(q)
        const matchAgency = item.agencyName?.toLowerCase().includes(q)
        const matchReason = item.reason?.toLowerCase().includes(q)
        if (!matchCode && !matchAgency && !matchReason) return false
      }
      return true
    })
  }, [refunds, filterAgency, filterStatus, filterMethod, searchQuery])

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRefunds.slice(start, start + pageSize)
  }, [filteredRefunds, page, pageSize])

  const openDetail = (item: Refund) => {
    setActionError(null)
    setDetailItem({ refund: item, etag: null })
    setIsDetailLoading(true)

    apiFetch<Refund>(`/refunds/${item.id}`)
      .then((res: ApiResponse<Refund>) => {
        setDetailItem({
          refund: res.data,
          etag: res.etag || null,
        })
      })
      .catch(() => {
        // Keep initial item if fetch fails
      })
      .finally(() => {
        setIsDetailLoading(false)
      })
  }

  const handleSubmitRefund = async () => {
    if (!detailItem) return
    setActionError(null)
    setIsActionLoading(true)
    try {
      await apiFetch(`/refunds/${detailItem.refund.id}/submit`, {
        method: 'POST',
        ifMatch: detailItem.etag || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      setSuccessNotice(
        `Đã giữ chỗ quỹ thành công cho phiếu hoàn ${detailItem.refund.code}.`,
      )
      setDetailItem(null)
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message || 'Không thể giữ chỗ quỹ cho phiếu hoàn.')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleConfirmPaid = async () => {
    if (!detailItem) return
    setActionError(null)
    setIsActionLoading(true)
    try {
      await apiFetch(`/refunds/${detailItem.refund.id}/confirm-paid`, {
        method: 'POST',
        ifMatch: detailItem.etag || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      setSuccessNotice(
        `Xác nhận đã chi tiền hoàn thành công cho phiếu ${detailItem.refund.code}.`,
      )
      setDetailItem(null)
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message || 'Không thể xác nhận chi tiền hoàn.')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCancelRefund = async () => {
    if (!detailItem) return
    if (!confirm('Bạn có chắc chắn muốn hủy phiếu hoàn tiền này không?')) return
    setActionError(null)
    setIsActionLoading(true)
    try {
      await apiFetch(`/refunds/${detailItem.refund.id}/cancel`, {
        method: 'POST',
        ifMatch: detailItem.etag || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      setSuccessNotice(`Đã hủy phiếu hoàn tiền ${detailItem.refund.code}.`)
      setDetailItem(null)
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message || 'Không thể hủy phiếu hoàn tiền.')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedAgencyId) {
      setFormError('Vui lòng chọn đại lý cần hoàn tiền.')
      return
    }
    if (!originDocumentId) {
      setFormError('Vui lòng chọn chứng từ thu nguồn cần hoàn.')
      return
    }
    const cleanAmount = amount.replace(/\D/g, '')
    if (!cleanAmount || cleanAmount === '0') {
      setFormError('Vui lòng nhập số tiền hoàn lớn hơn 0.')
      return
    }
    if (!reason.trim()) {
      setFormError('Vui lòng nhập lý do hoàn tiền.')
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    try {
      await apiFetch('/refunds', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: {
          originDocumentId,
          businessDate,
          amount: cleanAmount,
          paymentMethod,
          reason: reason.trim(),
          note: note.trim() || undefined,
        },
      })

      setSuccessNotice('Tạo yêu cầu hoàn tiền thành công.')
      setIsCreateOpen(false)
      setSelectedAgencyId('')
      setOriginDocumentId('')
      setAmount('')
      setReason('')
      setNote('')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo yêu cầu hoàn tiền.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'POSTED':
        return <Badge variant="success">Đã hoàn tiền</Badge>
      case 'SUBMITTED':
        return <Badge variant="info">Đã giữ chỗ quỹ</Badge>
      case 'DRAFT':
        return <Badge variant="warning">Bản nháp</Badge>
      case 'CANCELLED':
      case 'CANCELED':
        return <Badge variant="neutral">Đã hủy</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  const getMethodLabel = (method?: string) => {
    switch (method) {
      case 'CASH':
        return 'Tiền mặt'
      case 'BANK_TRANSFER':
        return 'Chuyển khoản'
      case 'ONLINE':
        return 'Trực tuyến'
      default:
        return method || '—'
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hoàn tiền đại lý</h1>
          <p className="page-desc">
            Quản lý việc hoàn trả số tiền dư có cho đại lý bằng tiền mặt, chuyển
            khoản hoặc cổng thanh toán trực tuyến
          </p>
        </div>
        {canPrepare && (
          <Button
            variant="primary"
            onClick={() => {
              setFormError(null)
              setSelectedAgencyId('')
              setOriginDocumentId('')
              setAmount('')
              setReason('')
              setNote('')
              setIsCreateOpen(true)
            }}
          >
            <PlusIcon size={16} /> Lập yêu cầu hoàn tiền
          </Button>
        )}
      </div>

      {successNotice && <Alert type="success">{successNotice}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      <div className="card filter-bar">
        <div className="filter-inputs">
          <Input
            placeholder="Tìm theo mã phiếu, lý do, đại lý..."
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
            value={filterMethod}
            onChange={(e) => {
              setFilterMethod(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả phương thức' },
              { value: 'CASH', label: 'Tiền mặt' },
              { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
              { value: 'ONLINE', label: 'Trực tuyến' },
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
              { value: 'DRAFT', label: 'Bản nháp (DRAFT)' },
              { value: 'SUBMITTED', label: 'Đã giữ chỗ quỹ (SUBMITTED)' },
              { value: 'PAID', label: 'Đã hoàn tiền (PAID)' },
              { value: 'CANCELLED', label: 'Đã hủy (CANCELLED)' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách phiếu hoàn tiền..." />
        </div>
      ) : filteredRefunds.length === 0 ? (
        <div className="card empty-card">
          <p>Không có phiếu hoàn tiền nào phù hợp.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách phiếu hoàn tiền">
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Đại lý</th>
                <th scope="col">Hình thức</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Số tiền hoàn
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Ngày nghiệp vụ</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((r) => {
                const method =
                  r.paymentMethod ||
                  r.method ||
                  r.currentRevision?.paymentMethod
                const amt =
                  r.totalAmount ||
                  r.amount ||
                  r.currentRevision?.totalAmount ||
                  '0'
                const date =
                  r.businessDate ||
                  r.currentRevision?.businessDate ||
                  r.documentDate
                return (
                  <tr key={r.id}>
                    <td className="font-mono font-bold">{r.code}</td>
                    <td>
                      <strong>
                        {r.agencyName ||
                          r.currentRevision?.agencySnapshot?.name ||
                          `Đại lý #${r.agencyId}`}
                      </strong>
                    </td>
                    <td>
                      <span className="badge badge--neutral">
                        {getMethodLabel(method)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatVND(amt)}
                    </td>
                    <td>{getStatusBadge(r.status)}</td>
                    <td>{formatDate(date)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openDetail(r)}
                      >
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                )
              })}
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
            hasNext={page * pageSize < filteredRefunds.length}
            onPrevious={() => setPage((pr) => Math.max(1, pr - 1))}
            onNext={() => setPage((pr) => pr + 1)}
          />
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <Modal
          isOpen={true}
          title={`Chi tiết phiếu hoàn ${detailItem.refund.code}`}
          onClose={() => setDetailItem(null)}
          maxWidth="lg"
        >
          {actionError && <Alert type="error">{actionError}</Alert>}

          {isDetailLoading ? (
            <div className="modal-loading">
              <Spinner label="Đang tải chi tiết phiếu hoàn..." />
            </div>
          ) : (
            <div className="detail-modal-body">
              <div className="detail-grid">
                <div>
                  <span className="detail-label">Số chứng từ:</span>
                  <span className="font-mono font-bold">
                    {detailItem.refund.code}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Trạng thái:</span>
                  <span>{getStatusBadge(detailItem.refund.status)}</span>
                </div>
                <div>
                  <span className="detail-label">Đại lý thụ hưởng:</span>
                  <span>
                    {detailItem.refund.agencyName ||
                      detailItem.refund.currentRevision?.agencySnapshot?.name ||
                      `Đại lý #${detailItem.refund.agencyId}`}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Chứng từ gốc:</span>
                  <span className="font-mono">
                    {detailItem.refund.originDocumentCode ||
                      (detailItem.refund.originDocumentId
                        ? `#${detailItem.refund.originDocumentId}`
                        : '—')}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Phương thức hoàn:</span>
                  <span>
                    {getMethodLabel(
                      detailItem.refund.paymentMethod ||
                        detailItem.refund.method ||
                        detailItem.refund.currentRevision?.paymentMethod,
                    )}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Ngày nghiệp vụ:</span>
                  <span>
                    {formatDate(
                      detailItem.refund.businessDate ||
                        detailItem.refund.currentRevision?.businessDate,
                    )}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Số tiền yêu cầu hoàn:</span>
                  <span
                    className="font-bold text-danger"
                    style={{ fontSize: '1.1rem' }}
                  >
                    {formatVND(
                      detailItem.refund.totalAmount ||
                        detailItem.refund.amount ||
                        detailItem.refund.currentRevision?.totalAmount ||
                        '0',
                    )}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Số tiền đang giữ chỗ:</span>
                  <span className="font-bold">
                    {formatVND(detailItem.refund.reservedAmount || '0')}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Số tiền đã thực chi:</span>
                  <span className="font-bold text-success">
                    {formatVND(detailItem.refund.refundedAmount || '0')}
                  </span>
                </div>
                <div>
                  <span className="detail-label">
                    Lần thử trực tuyến gần nhất:
                  </span>
                  <span>
                    {detailItem.refund.latestAttemptState ? (
                      <span className="badge badge--neutral">
                        {detailItem.refund.latestAttemptState}
                      </span>
                    ) : (
                      'Chưa có lần thử'
                    )}
                  </span>
                </div>
              </div>

              {(detailItem.refund.reason ||
                detailItem.refund.currentRevision?.reason) && (
                <div style={{ marginTop: '1rem' }}>
                  <span className="detail-label">Lý do hoàn tiền:</span>
                  <p className="detail-note">
                    {detailItem.refund.reason ||
                      detailItem.refund.currentRevision?.reason}
                  </p>
                </div>
              )}

              {detailItem.refund.note && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span className="detail-label">Ghi chú bổ sung:</span>
                  <p className="detail-note">{detailItem.refund.note}</p>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                {canPost && detailItem.refund.status === 'DRAFT' && (
                  <Button
                    variant="primary"
                    isLoading={isActionLoading}
                    onClick={handleSubmitRefund}
                  >
                    Giữ chỗ quỹ (Nộp duyệt)
                  </Button>
                )}
                {canPost && detailItem.refund.status === 'SUBMITTED' && (
                  <Button
                    variant="primary"
                    isLoading={isActionLoading}
                    onClick={handleConfirmPaid}
                  >
                    Xác nhận đã chi tiền hoàn
                  </Button>
                )}
                {(canPrepare || canPost) &&
                  (detailItem.refund.status === 'DRAFT' ||
                    detailItem.refund.status === 'SUBMITTED') && (
                    <Button
                      variant="danger"
                      isLoading={isActionLoading}
                      onClick={handleCancelRefund}
                    >
                      Hủy phiếu hoàn
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
          title="Lập yêu cầu hoàn tiền"
          onClose={() => setIsCreateOpen(false)}
          maxWidth="md"
        >
          <form onSubmit={handleCreateSubmit}>
            {formError && <Alert type="error">{formError}</Alert>}

            <div className="form-group">
              <Select
                id="refund-agency"
                label="Đại lý yêu cầu hoàn"
                value={selectedAgencyId}
                onChange={(e) => {
                  setSelectedAgencyId(e.target.value)
                  setOriginDocumentId('')
                }}
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
                  <span>Dư có khả dụng hiện tại:</span>
                  <strong className="text-success">
                    {formatVND(selectedAgencyBalance.availableCredit)}
                  </strong>
                </div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>Dư nợ đại lý:</span>
                  <strong className="text-danger">
                    {formatVND(selectedAgencyBalance.currentDebt)}
                  </strong>
                </div>
              </div>
            )}

            <div className="form-group">
              <Select
                id="refund-origin"
                label="Chứng từ thu nguồn (Dư có)"
                value={originDocumentId}
                onChange={(e) => setOriginDocumentId(e.target.value)}
                options={[
                  { value: '', label: '-- Chọn lô dư có nguồn --' },
                  ...agencyCreditLots.map((lot) => ({
                    value: lot.sourceDocumentId || lot.id,
                    label: `Lô #${lot.id} - ${lot.sourceDocumentCode || 'CT'} (Khả dụng: ${formatVND(lot.availableAmount || lot.balance || '0')})`,
                  })),
                  ...(agencyCreditLots.length === 0 && selectedAgencyId
                    ? [
                        {
                          value: 'manual-source',
                          label: 'Lô dư có phát sinh kỳ đối soát hiện hành',
                        },
                      ]
                    : []),
                ]}
                required
              />
            </div>

            <div className="form-group">
              <Select
                id="refund-method"
                label="Phương thức chi hoàn"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[
                  { value: 'CASH', label: 'Tiền mặt' },
                  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
                  { value: 'ONLINE', label: 'Cổng thanh toán trực tuyến' },
                ]}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="refund-date">Ngày nghiệp vụ (*)</label>
              <Input
                id="refund-date"
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="refund-amount">Số tiền hoàn (₫) (*)</label>
              <Input
                id="refund-amount"
                type="text"
                placeholder="Nhập số tiền hoàn..."
                value={amount ? Number(amount).toLocaleString('vi-VN') : ''}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="refund-reason">Lý do hoàn tiền (*)</label>
              <Input
                id="refund-reason"
                type="text"
                placeholder="Ví dụ: Đại lý thanh toán thừa hoặc hoàn tiền hàng trả lại..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="refund-note">Ghi chú bổ sung</label>
              <Input
                id="refund-note"
                type="text"
                placeholder="Nhập ghi chú thêm nếu có..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Tạo yêu cầu hoàn
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
        </Modal>
      )}
    </div>
  )
}
