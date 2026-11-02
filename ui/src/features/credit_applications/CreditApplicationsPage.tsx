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
import type { Agency, AgencyBalance, CreditApplication } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function CreditApplicationsPage() {
  const { hasPermission } = useAuth()
  const canApply = hasPermission('credit.apply')

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    const cached = getCachedData<Agency[] | { items: Agency[] }>('/agencies')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [applications, setApplications] = useState<CreditApplication[]>(() => {
    const cached = getCachedData<
      CreditApplication[] | { items: CreditApplication[] }
    >('/credit-applications')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [balances, setBalances] = useState<Record<string, AgencyBalance>>({})
  const [isLoading, setIsLoading] = useState(() => applications.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Filtering & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAgency, setFilterAgency] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Detail Modal
  const [detailItem, setDetailItem] = useState<{
    application: CreditApplication
    etag: string | null
  } | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Create Form Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().split('T')[0] || '',
  )
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/credit-applications')
      invalidateCache('/receivables/balances')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      bypassCache
        ? apiFetch<CreditApplication[] | { items: CreditApplication[] }>(
            '/credit-applications',
          )
        : cachedApiFetch<CreditApplication[] | { items: CreditApplication[] }>(
            '/credit-applications',
          ),
      cachedApiFetch<AgencyBalance[] | { items: AgencyBalance[] }>(
        '/receivables/balances',
      ).catch(() => ({ data: [] as AgencyBalance[] })),
    ])
      .then(([aRes, cRes, bRes]) => {
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const cItems = Array.isArray(cRes.data)
          ? cRes.data
          : cRes.data.items || []
        const bItems = Array.isArray(bRes.data)
          ? bRes.data
          : 'items' in bRes.data
            ? bRes.data.items || []
            : []

        setAgencies(aItems)
        setApplications(cItems)

        const bMap: Record<string, AgencyBalance> = {}
        for (const b of bItems) {
          bMap[b.agencyId] = b
        }
        setBalances(bMap)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu bù trừ dư có.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies'),
      cachedApiFetch<CreditApplication[] | { items: CreditApplication[] }>(
        '/credit-applications',
      ),
      cachedApiFetch<AgencyBalance[] | { items: AgencyBalance[] }>(
        '/receivables/balances',
      ).catch(() => ({ data: [] as AgencyBalance[] })),
    ])
      .then(([aRes, cRes, bRes]) => {
        if (!isMounted) return
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const cItems = Array.isArray(cRes.data)
          ? cRes.data
          : cRes.data.items || []
        const bItems = Array.isArray(bRes.data)
          ? bRes.data
          : 'items' in bRes.data
            ? bRes.data.items || []
            : []

        setAgencies(aItems)
        setApplications(cItems)

        const bMap: Record<string, AgencyBalance> = {}
        for (const b of bItems) {
          bMap[b.agencyId] = b
        }
        setBalances(bMap)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu bù trừ dư có.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Agency selection in form
  const selectedAgencyBalance = selectedAgencyId
    ? balances[selectedAgencyId]
    : undefined

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (filterAgency && String(app.agencyId) !== filterAgency) {
        return false
      }
      if (filterStatus && app.status !== filterStatus) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = app.code?.toLowerCase().includes(q)
        const matchAgency = app.agencyName?.toLowerCase().includes(q)
        if (!matchCode && !matchAgency) return false
      }
      return true
    })
  }, [applications, filterAgency, filterStatus, searchQuery])

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredApplications.slice(start, start + pageSize)
  }, [filteredApplications, page, pageSize])

  const openDetail = (item: CreditApplication) => {
    setActionError(null)
    setIsDetailLoading(true)
    setDetailItem({ application: item, etag: null })

    apiFetch<CreditApplication>(`/credit-applications/${item.id}`)
      .then((res: ApiResponse<CreditApplication>) => {
        setDetailItem({
          application: res.data,
          etag: res.etag || null,
        })
      })
      .catch(() => {
        // Keep current item if detail fetch fails
      })
      .finally(() => {
        setIsDetailLoading(false)
      })
  }

  const handlePost = async () => {
    if (!detailItem) return
    setActionError(null)
    try {
      await apiFetch(`/credit-applications/${detailItem.application.id}/post`, {
        method: 'POST',
        ifMatch: detailItem.etag || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      setSuccessNotice(
        `Đã ghi sổ thành công phiếu bù trừ ${detailItem.application.code}.`,
      )
      setDetailItem(null)
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message || 'Không thể ghi sổ phiếu bù trừ.')
    }
  }

  const handleCancel = async () => {
    if (!detailItem) return
    if (!confirm('Bạn có chắc chắn muốn hủy phiếu bù trừ này không?')) return
    setActionError(null)
    try {
      await apiFetch(
        `/credit-applications/${detailItem.application.id}/cancel`,
        {
          method: 'POST',
          ifMatch: detailItem.etag || undefined,
          idempotencyKey: crypto.randomUUID(),
        },
      )
      setSuccessNotice(`Đã hủy phiếu bù trừ ${detailItem.application.code}.`)
      setDetailItem(null)
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setActionError(e.message || 'Không thể hủy phiếu bù trừ.')
    }
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedAgencyId) {
      setFormError('Vui lòng chọn đại lý cần bù trừ.')
      return
    }
    const cleanAmount = amount.replace(/\D/g, '')
    if (!cleanAmount || cleanAmount === '0') {
      setFormError('Vui lòng nhập số tiền bù trừ lớn hơn 0.')
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    try {
      await apiFetch('/credit-applications', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: {
          agencyId: selectedAgencyId,
          businessDate,
          amount: cleanAmount,
          note: note.trim() || undefined,
        },
      })

      setSuccessNotice('Tạo phiếu bù trừ dư có thành công.')
      setIsCreateOpen(false)
      setSelectedAgencyId('')
      setAmount('')
      setNote('')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo phiếu bù trừ.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuggestMax = () => {
    if (!selectedAgencyBalance) return
    const avail = BigInt(selectedAgencyBalance.availableCredit || '0')
    const debt = BigInt(selectedAgencyBalance.currentDebt || '0')
    const maxApplicable = avail < debt ? avail : debt
    setAmount(maxApplicable > 0n ? maxApplicable.toString() : '0')
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bù trừ dư có</h1>
          <p className="page-desc">
            Sử dụng số tiền dư có khả dụng để cấn trừ nợ của đại lý theo thứ tự
            hóa đơn FIFO
          </p>
        </div>
        {canApply && (
          <Button
            variant="primary"
            onClick={() => {
              setFormError(null)
              setIsCreateOpen(true)
            }}
          >
            <PlusIcon size={16} /> Lập phiếu bù trừ
          </Button>
        )}
      </div>

      {successNotice && <Alert type="success">{successNotice}</Alert>}

      {error && <Alert type="error">{error}</Alert>}

      <div className="card filter-bar">
        <div className="filter-inputs">
          <Input
            placeholder="Tìm theo mã phiếu, tên đại lý..."
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
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'DRAFT', label: 'Bản nháp' },
              { value: 'POSTED', label: 'Đã ghi sổ' },
              { value: 'CANCELLED', label: 'Đã hủy' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách phiếu bù trừ..." />
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="card empty-card">
          <p>Không tìm thấy phiếu bù trừ nào phù hợp.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách phiếu bù trừ dư có">
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Đại lý</th>
                <th scope="col">Ngày nghiệp vụ</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Số tiền bù trừ
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((app) => (
                <tr key={app.id}>
                  <td className="font-mono font-bold">{app.code}</td>
                  <td>
                    <strong>
                      {app.agencyName ||
                        app.currentRevision?.agencySnapshot?.name ||
                        `Đại lý #${app.agencyId}`}
                    </strong>
                  </td>
                  <td>
                    {formatDate(
                      app.businessDate ||
                        app.currentRevision?.businessDate ||
                        app.documentDate,
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(
                      app.totalAmount ||
                        app.creditUsedAmount ||
                        app.currentRevision?.totalAmount ||
                        '0',
                    )}
                  </td>
                  <td>
                    {app.status === 'POSTED' ? (
                      <Badge variant="success">Đã ghi sổ</Badge>
                    ) : app.status === 'DRAFT' ? (
                      <Badge variant="warning">Bản nháp</Badge>
                    ) : (
                      <Badge variant="neutral">Đã hủy</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openDetail(app)}
                    >
                      Chi tiết
                    </Button>
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
            hasNext={page * pageSize < filteredApplications.length}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <Modal
          isOpen={true}
          title={`Chi tiết phiếu bù trừ ${detailItem.application.code}`}
          onClose={() => setDetailItem(null)}
          maxWidth="lg"
        >
          {actionError && <Alert type="error">{actionError}</Alert>}

          {isDetailLoading ? (
            <div className="modal-loading">
              <Spinner label="Đang tải chi tiết phiếu bù trừ..." />
            </div>
          ) : (
            <div className="detail-modal-body">
              <div className="detail-grid">
                <div>
                  <span className="detail-label">Mã chứng từ:</span>
                  <span className="font-mono font-bold">
                    {detailItem.application.code}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Trạng thái:</span>
                  <span>
                    {detailItem.application.status === 'POSTED' ? (
                      <Badge variant="success">Đã ghi sổ</Badge>
                    ) : detailItem.application.status === 'DRAFT' ? (
                      <Badge variant="warning">Bản nháp</Badge>
                    ) : (
                      <Badge variant="neutral">Đã hủy</Badge>
                    )}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Đại lý:</span>
                  <span>
                    {detailItem.application.agencyName ||
                      detailItem.application.currentRevision?.agencySnapshot
                        ?.name ||
                      `Đại lý #${detailItem.application.agencyId}`}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Ngày nghiệp vụ:</span>
                  <span>
                    {formatDate(
                      detailItem.application.businessDate ||
                        detailItem.application.currentRevision?.businessDate,
                    )}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Số tiền cấn trừ:</span>
                  <span
                    className="font-bold text-success"
                    style={{ fontSize: '1.1rem' }}
                  >
                    {formatVND(
                      detailItem.application.totalAmount ||
                        detailItem.application.creditUsedAmount ||
                        detailItem.application.currentRevision?.totalAmount ||
                        '0',
                    )}
                  </span>
                </div>
                <div>
                  <span className="detail-label">Tiền mặt phát sinh:</span>
                  <span>0 ₫ (Cấn trừ hoàn toàn bằng dư có)</span>
                </div>
              </div>

              {detailItem.application.note && (
                <div style={{ marginTop: '1rem' }}>
                  <span className="detail-label">Ghi chú:</span>
                  <p className="detail-note">{detailItem.application.note}</p>
                </div>
              )}

              {/* Allocations Table */}
              {detailItem.application.allocations &&
                detailItem.application.allocations.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                      Phân bổ cấn trừ theo hóa đơn xuất (FIFO)
                    </h3>
                    <Table caption="Chi tiết cấn trừ nợ">
                      <thead>
                        <tr>
                          <th>Hóa đơn xuất</th>
                          <th style={{ textAlign: 'right' }}>
                            Số tiền cấn trừ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailItem.application.allocations.map((alloc) => (
                          <tr key={alloc.invoiceId}>
                            <td className="font-mono">
                              {alloc.invoiceCode ||
                                `Hóa đơn #${alloc.invoiceId}`}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 600,
                              }}
                            >
                              {formatVND(alloc.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                {canApply && detailItem.application.status === 'DRAFT' && (
                  <>
                    <Button variant="primary" onClick={handlePost}>
                      Ghi sổ phiếu bù trừ
                    </Button>
                    <Button variant="danger" onClick={handleCancel}>
                      Hủy phiếu
                    </Button>
                  </>
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
          title="Lập phiếu bù trừ dư có"
          onClose={() => setIsCreateOpen(false)}
          maxWidth="md"
        >
          <form onSubmit={handleCreateSubmit}>
            {formError && <Alert type="error">{formError}</Alert>}

            <div className="form-group">
              <Select
                id="create-agency"
                label="Đại lý áp dụng"
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span>Dư có khả dụng:</span>
                  <strong className="text-success">
                    {formatVND(selectedAgencyBalance.availableCredit)}
                  </strong>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSuggestMax}
                >
                  Bù tối đa cho phép
                </Button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="create-date">Ngày nghiệp vụ (*)</label>
              <Input
                id="create-date"
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="create-amount">Số tiền cấn trừ (₫) (*)</label>
              <Input
                id="create-amount"
                type="text"
                placeholder="Nhập số tiền bù trừ..."
                value={amount ? Number(amount).toLocaleString('vi-VN') : ''}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                required
              />
              <small style={{ color: 'var(--color-text-muted, #6c757d)' }}>
                Số tiền này sẽ được trừ trực tiếp từ các lô dư có khả dụng và
                thanh toán cho hóa đơn nợ cũ nhất.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="create-note">Ghi chú</label>
              <Input
                id="create-note"
                type="text"
                placeholder="Ví dụ: Bù trừ nợ theo thỏa thuận kỳ đối soát..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Lưu phiếu bù trừ
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
