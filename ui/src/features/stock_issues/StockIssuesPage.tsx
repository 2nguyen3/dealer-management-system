import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PlusIcon, TrashIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch, type ApiResponse } from '../../lib/api'
import { cachedApiFetch, getCachedData, invalidateCache } from '../../lib/cache'
import { formatDate, formatQuantity, formatVND } from '../../lib/formatters'
import type { Agency, Product, StockIssue } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

interface CreateIssueLine {
  productId: string
  quantity: string
}

export function StockIssuesPage() {
  const { hasPermission } = useAuth()
  const canPrepare = hasPermission('stock.issue.prepare')
  const canPost = hasPermission('stock.issue.post')

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    const cached = getCachedData<Agency[] | { items: Agency[] }>('/agencies')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = getCachedData<Product[] | { items: Product[] }>('/products')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [issues, setIssues] = useState<StockIssue[]>(() => {
    const cached = getCachedData<StockIssue[] | { items: StockIssue[] }>(
      '/stock-issues',
    )
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [isLoading, setIsLoading] = useState(() => issues.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<string>('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [detailIssue, setDetailIssue] = useState<{
    issue: StockIssue
    etag: string | null
  } | null>(null)

  // Create form
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().split('T')[0] || '',
  )
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<CreateIssueLine[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/stock-issues')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies?status=ACTIVE'),
      cachedApiFetch<Product[] | { items: Product[] }>(
        '/products?status=ACTIVE',
      ),
      bypassCache
        ? apiFetch<StockIssue[] | { items: StockIssue[] }>('/stock-issues')
        : cachedApiFetch<StockIssue[] | { items: StockIssue[] }>(
            '/stock-issues',
          ),
    ])
      .then(([aRes, pRes, iRes]) => {
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const pItems = Array.isArray(pRes.data)
          ? pRes.data
          : pRes.data.items || []
        const iItems = Array.isArray(iRes.data)
          ? iRes.data
          : iRes.data.items || []
        setAgencies(aItems)
        setProducts(pItems)
        setIssues(iItems)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu xuất hàng.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies?status=ACTIVE'),
      cachedApiFetch<Product[] | { items: Product[] }>(
        '/products?status=ACTIVE',
      ),
      cachedApiFetch<StockIssue[] | { items: StockIssue[] }>('/stock-issues'),
    ])
      .then(([aRes, pRes, iRes]) => {
        if (!isMounted) return
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const pItems = Array.isArray(pRes.data)
          ? pRes.data
          : pRes.data.items || []
        const iItems = Array.isArray(iRes.data)
          ? iRes.data
          : iRes.data.items || []
        setAgencies(aItems)
        setProducts(pItems)
        setIssues(iItems)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu xuất hàng.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Fast in-memory filtering (0ms latency on filter change)
  const filteredIssues = useMemo(() => {
    if (!filterStatus) return issues
    return issues.filter((i) => i.status === filterStatus)
  }, [issues, filterStatus])

  const paginatedIssues = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredIssues.slice(start, start + pageSize)
  }, [filteredIssues, page, pageSize])

  const openCreateModal = () => {
    setSelectedAgencyId(agencies[0] ? agencies[0].id : '')
    setDocumentDate(new Date().toISOString().split('T')[0] || '')
    setNote('')
    setLines(products[0] ? [{ productId: products[0].id, quantity: '1' }] : [])
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleAddLine = () => {
    if (!products[0]) return
    setLines((prev) => [...prev, { productId: products[0]!.id, quantity: '1' }])
  }

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLineChange = (
    index: number,
    field: keyof CreateIssueLine,
    value: string,
  ) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    )
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!selectedAgencyId) {
      setFormError('Vui lòng chọn đại lý nhận hàng.')
      return
    }

    if (lines.length === 0) {
      setFormError('Vui lòng thêm ít nhất một mặt hàng.')
      return
    }

    for (const line of lines) {
      if (!line.productId) {
        setFormError('Vui lòng chọn mặt hàng.')
        return
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        setFormError('Số lượng xuất phải lớn hơn 0.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/stock-issues', {
        method: 'POST',
        body: {
          agencyId: selectedAgencyId,
          documentDate,
          note: note.trim() || undefined,
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity.trim(),
          })),
        },
      })
      setIsCreateOpen(false)
      setSuccessNotice('Đã tạo bản nháp phiếu xuất hàng.')
      invalidateCache('/stock-issues')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo phiếu xuất hàng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly with existing issue data, loads line details in background if needed
  const openDetailModal = (issue: StockIssue) => {
    setDetailIssue({ issue, etag: null })
    if (!issue.lines || issue.lines.length === 0) {
      apiFetch<StockIssue>(`/stock-issues/${issue.id}`)
        .then((res: ApiResponse<StockIssue>) => {
          setDetailIssue({ issue: res.data, etag: res.etag })
        })
        .catch(() => {})
    }
  }

  const handleSubmitDraft = async () => {
    if (!detailIssue) return
    setIsSubmitting(true)
    try {
      await apiFetch(`/stock-issues/${detailIssue.issue.id}/submit`, {
        method: 'POST',
        ifMatch: detailIssue.etag || undefined,
      })
      setSuccessNotice(
        `Đã nộp phiếu xuất ${detailIssue.issue.code} (chuyển sang trạng thái Sẵn sàng).`,
      )
      setDetailIssue(null)
      invalidateCache('/stock-issues')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Không thể nộp phiếu xuất hàng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePostIssue = async () => {
    if (!detailIssue) return
    setIsSubmitting(true)
    try {
      await apiFetch(`/stock-issues/${detailIssue.issue.id}/post`, {
        method: 'POST',
        ifMatch: detailIssue.etag || undefined,
      })
      setSuccessNotice(`Đã ghi sổ phiếu xuất ${detailIssue.issue.code}.`)
      setDetailIssue(null)
      invalidateCache('/stock-issues')
      invalidateCache('/inventory')
      invalidateCache('/receivables')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Không thể ghi sổ phiếu xuất hàng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Phiếu xuất hàng</h1>
          <p className="page-desc">
            Lập phiếu xuất hàng cho đại lý, kiểm tra tồn kho và đối chiếu công
            nợ
          </p>
        </div>
        {canPrepare && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Lập phiếu xuất mới
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successNotice && <Alert type="success">{successNotice}</Alert>}

      <div className="filter-bar">
        <div className="filter-select">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'DRAFT', label: 'Bản nháp (DRAFT)' },
              { value: 'READY', label: 'Sẵn sàng (READY)' },
              { value: 'POSTED', label: 'Đã xuất kho (POSTED)' },
              { value: 'CANCELED', label: 'Đã hủy (CANCELED)' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách phiếu xuất..." />
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="card empty-card">
          <p>Không có phiếu xuất hàng nào.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách phiếu xuất hàng">
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Đại lý nhận hàng</th>
                <th scope="col">Ngày xuất</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Tổng tiền
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedIssues.map((issue) => (
                <tr key={issue.id}>
                  <td className="font-mono font-bold">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => openDetailModal(issue)}
                    >
                      {issue.code}
                    </button>
                  </td>
                  <td>
                    <strong>
                      {issue.agencyName || `Đại lý #${issue.agencyId}`}
                    </strong>
                  </td>
                  <td>
                    {formatDate(issue.businessDate || issue.documentDate)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(issue.totalAmount)}
                  </td>
                  <td>
                    {issue.status === 'POSTED' ? (
                      <Badge variant="success">Đã xuất kho</Badge>
                    ) : issue.status === 'READY' ||
                      issue.status === 'PENDING' ? (
                      <Badge variant="info">Chờ duyệt / Sẵn sàng</Badge>
                    ) : issue.status === 'DRAFT' ? (
                      <Badge variant="warning">Bản nháp</Badge>
                    ) : (
                      <Badge variant="neutral">Đã hủy</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetailModal(issue)}
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
            hasNext={page * pageSize < filteredIssues.length}
            hasPrevious={page > 1}
            limit={pageSize}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit)
              setPage(1)
            }}
            totalShowing={filteredIssues.length}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Lập phiếu xuất hàng mới"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid-2">
            <Select
              label="Đại lý nhận hàng"
              value={selectedAgencyId}
              onChange={(e) => setSelectedAgencyId(e.target.value)}
              options={agencies.map((a) => ({
                value: a.id,
                label: `${a.code} - ${a.name} (Nợ hiện tại: ${formatVND(a.currentDebt)})`,
              }))}
              required
            />
            <Input
              label="Ngày xuất hàng"
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              required
            />
          </div>

          <div className="receipt-lines-section">
            <div className="section-header-inline">
              <h3 className="section-title">Danh sách mặt hàng xuất</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                icon={<PlusIcon size={16} />}
              >
                Thêm mặt hàng
              </Button>
            </div>

            {lines.length === 0 ? (
              <p className="text-muted">Chưa có dòng mặt hàng nào.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Mặt hàng</th>
                      <th scope="col" style={{ width: '180px' }}>
                        Số lượng xuất
                      </th>
                      <th scope="col" style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="select select--compact"
                            value={line.productId}
                            onChange={(e) =>
                              handleLineChange(idx, 'productId', e.target.value)
                            }
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code} - {p.name} (Tồn:{' '}
                                {formatQuantity(p.currentStock)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            className="input input--compact"
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineChange(idx, 'quantity', e.target.value)
                            }
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="icon-action-btn icon-action-btn--danger"
                            onClick={() => handleRemoveLine(idx)}
                            title="Xóa dòng"
                          >
                            <TrashIcon size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Input
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú thêm thông tin vận chuyển..."
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
              Tạo bản nháp
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailIssue}
        onClose={() => setDetailIssue(null)}
        title={`Chi tiết phiếu xuất: ${detailIssue?.issue.code}`}
        maxWidth="lg"
      >
        {detailIssue && (
          <div className="issue-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Số phiếu:</span>
                <span className="detail-value font-mono font-bold">
                  {detailIssue.issue.code}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Đại lý:</span>
                <span className="detail-value font-bold">
                  {detailIssue.issue.agencyName || detailIssue.issue.agencyId}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ngày xuất:</span>
                <span className="detail-value">
                  {formatDate(
                    detailIssue.issue.businessDate ||
                      detailIssue.issue.documentDate,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Trạng thái:</span>
                <span className="detail-value">
                  {detailIssue.issue.status === 'POSTED' ? (
                    <Badge variant="success">Đã xuất kho</Badge>
                  ) : detailIssue.issue.status === 'READY' ||
                    detailIssue.issue.status === 'PENDING' ? (
                    <Badge variant="info">Chờ duyệt / Sẵn sàng</Badge>
                  ) : detailIssue.issue.status === 'DRAFT' ? (
                    <Badge variant="warning">Bản nháp</Badge>
                  ) : (
                    <Badge variant="neutral">Đã hủy</Badge>
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tổng tiền hóa đơn:</span>
                <span className="detail-value font-bold text-success">
                  {formatVND(detailIssue.issue.totalAmount)}
                </span>
              </div>
              {detailIssue.issue.upfrontRequired && (
                <div className="detail-item">
                  <span className="detail-label">Yêu cầu trả ngay:</span>
                  <span className="detail-value text-danger font-bold">
                    {formatVND(detailIssue.issue.upfrontRequired)}
                  </span>
                </div>
              )}
            </div>

            {detailIssue.issue.lines && (
              <div className="lines-detail-section">
                <h3 className="section-title">Chi tiết hàng hóa xuất</h3>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Mã hàng</th>
                        <th scope="col">Tên mặt hàng</th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Số lượng
                        </th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Đơn giá xuất
                        </th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Thành tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailIssue.issue.lines.map((l, i) => (
                        <tr key={i}>
                          <td className="font-mono">{l.productCode}</td>
                          <td>
                            <strong>{l.productName}</strong>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {formatQuantity(l.quantity)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {formatVND(l.unitPrice)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatVND(l.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <Button variant="outline" onClick={() => setDetailIssue(null)}>
                Đóng
              </Button>
              {canPrepare && detailIssue.issue.status === 'DRAFT' && (
                <Button
                  variant="primary"
                  onClick={handleSubmitDraft}
                  isLoading={isSubmitting}
                >
                  Nộp phiếu (Duyệt xuất)
                </Button>
              )}
              {canPost && detailIssue.issue.status === 'READY' && (
                <Button
                  variant="primary"
                  onClick={handlePostIssue}
                  isLoading={isSubmitting}
                >
                  Xuất kho (Ghi nhận nợ)
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
