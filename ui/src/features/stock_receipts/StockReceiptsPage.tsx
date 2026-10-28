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
import type { Product, StockReceipt } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

interface CreateReceiptLine {
  productId: string
  quantity: string
  unitPrice: string
}

export function StockReceiptsPage() {
  const { hasPermission } = useAuth()
  const canPrepare = hasPermission('stock.receipt.prepare')
  const canPost = hasPermission('stock.receipt.post')

  const [products, setProducts] = useState<Product[]>(() => {
    const cached = getCachedData<Product[] | { items: Product[] }>('/products')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [receipts, setReceipts] = useState<StockReceipt[]>(() => {
    const cached = getCachedData<StockReceipt[] | { items: StockReceipt[] }>(
      '/stock-receipts',
    )
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [isLoading, setIsLoading] = useState(() => receipts.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<string>('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [detailReceipt, setDetailReceipt] = useState<{
    receipt: StockReceipt
    etag: string | null
  } | null>(null)

  // Create form
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().split('T')[0] || '',
  )
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<CreateReceiptLine[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/stock-receipts')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Product[] | { items: Product[] }>('/products'),
      bypassCache
        ? apiFetch<StockReceipt[] | { items: StockReceipt[] }>(
            '/stock-receipts',
          )
        : cachedApiFetch<StockReceipt[] | { items: StockReceipt[] }>(
            '/stock-receipts',
          ),
    ])
      .then(([pRes, rRes]) => {
        const pItems = Array.isArray(pRes.data)
          ? pRes.data
          : pRes.data.items || []
        const rItems = Array.isArray(rRes.data)
          ? rRes.data
          : rRes.data.items || []
        setProducts(pItems.filter((p) => p.status === 'ACTIVE'))
        setReceipts(rItems)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu nhập hàng.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Product[] | { items: Product[] }>('/products'),
      cachedApiFetch<StockReceipt[] | { items: StockReceipt[] }>(
        '/stock-receipts',
      ),
    ])
      .then(([pRes, rRes]) => {
        if (!isMounted) return
        const pItems = Array.isArray(pRes.data)
          ? pRes.data
          : pRes.data.items || []
        const rItems = Array.isArray(rRes.data)
          ? rRes.data
          : rRes.data.items || []
        setProducts(pItems.filter((p) => p.status === 'ACTIVE'))
        setReceipts(rItems)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu nhập hàng.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Fast in-memory filtering (0ms latency, zero API calls on filter change)
  const filteredReceipts = useMemo(() => {
    if (!filterStatus) return receipts
    return receipts.filter((r) => r.status === filterStatus)
  }, [receipts, filterStatus])

  const paginatedReceipts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredReceipts.slice(start, start + pageSize)
  }, [filteredReceipts, page, pageSize])

  const openCreateModal = () => {
    setSupplierName('')
    setDocumentDate(new Date().toISOString().split('T')[0] || '')
    setNote('')
    setLines(
      products[0]
        ? [{ productId: products[0].id, quantity: '10', unitPrice: '50000' }]
        : [],
    )
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleAddLine = () => {
    if (!products[0]) return
    setLines((prev) => [
      ...prev,
      { productId: products[0]!.id, quantity: '1', unitPrice: '0' },
    ])
  }

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLineChange = (
    index: number,
    field: keyof CreateReceiptLine,
    value: string,
  ) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    )
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (lines.length === 0) {
      setFormError('Vui lòng thêm ít nhất một dòng mặt hàng.')
      return
    }

    for (const line of lines) {
      if (!line.productId) {
        setFormError('Vui lòng chọn mặt hàng.')
        return
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        setFormError('Số lượng nhập phải lớn hơn 0.')
        return
      }
      if (!line.unitPrice || Number(line.unitPrice) < 0) {
        setFormError('Đơn giá nhập không hợp lệ.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/stock-receipts', {
        method: 'POST',
        body: {
          supplierName: supplierName.trim() || undefined,
          documentDate,
          note: note.trim() || undefined,
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity.trim(),
            unitPrice: l.unitPrice.trim(),
          })),
        },
      })
      setIsCreateOpen(false)
      setSuccessNotice('Đã tạo phiếu nhập kho thành công.')
      invalidateCache('/stock-receipts')
      invalidateCache('/inventory')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo phiếu nhập hàng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens modal immediately with existing receipt data, loads line details in background if needed
  const openDetailModal = (receipt: StockReceipt) => {
    setDetailReceipt({ receipt, etag: null })
    if (!receipt.lines || receipt.lines.length === 0) {
      apiFetch<StockReceipt>(`/stock-receipts/${receipt.id}`)
        .then((res: ApiResponse<StockReceipt>) => {
          setDetailReceipt({ receipt: res.data, etag: res.etag })
        })
        .catch(() => {})
    }
  }

  const handlePostReceipt = async () => {
    if (!detailReceipt) return
    setIsSubmitting(true)
    try {
      await apiFetch(`/stock-receipts/${detailReceipt.receipt.id}/post`, {
        method: 'POST',
        ifMatch: detailReceipt.etag || undefined,
      })
      setSuccessNotice(`Đã ghi sổ phiếu nhập ${detailReceipt.receipt.code}.`)
      setDetailReceipt(null)
      invalidateCache('/stock-receipts')
      invalidateCache('/inventory')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Không thể ghi sổ phiếu nhập kho.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Phiếu nhập hàng</h1>
          <p className="page-desc">
            Quản lý quá trình nhập kho hàng hóa từ nhà cung cấp và cập nhật tồn
            kho
          </p>
        </div>
        {canPrepare && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Lập phiếu nhập mới
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
              { value: 'POSTED', label: 'Đã ghi sổ (POSTED)' },
              { value: 'CANCELED', label: 'Đã hủy (CANCELED)' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách phiếu nhập..." />
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="card empty-card">
          <p>Không có phiếu nhập hàng nào.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách phiếu nhập hàng">
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Ngày lập</th>
                <th scope="col">Nhà cung cấp</th>
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
                  <td>{formatDate(r.businessDate || r.documentDate)}</td>
                  <td>{r.supplierName || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(r.totalAmount)}
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
        title="Lập phiếu nhập hàng mới"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid-2">
            <Input
              label="Ngày lập phiếu"
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              required
            />
            <Input
              label="Nhà cung cấp (tùy chọn)"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Ví dụ: Công ty TNHH Tiếp Vận..."
            />
          </div>

          <div className="receipt-lines-section">
            <div className="section-header-inline">
              <h3 className="section-title">Danh sách mặt hàng nhập</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                icon={<PlusIcon size={16} />}
              >
                Thêm dòng
              </Button>
            </div>

            {lines.length === 0 ? (
              <p className="text-muted">
                Chưa có dòng mặt hàng nào. Bấm nút "Thêm dòng" để bắt đầu.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Mặt hàng</th>
                      <th scope="col" style={{ width: '130px' }}>
                        Số lượng
                      </th>
                      <th scope="col" style={{ width: '160px' }}>
                        Đơn giá nhập (VND)
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
                                {p.code} - {p.name}
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
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="input input--compact"
                            value={line.unitPrice}
                            onChange={(e) =>
                              handleLineChange(idx, 'unitPrice', e.target.value)
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
            placeholder="Ghi chú thông tin lô hàng..."
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
              Tạo phiếu nhập
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailReceipt}
        onClose={() => setDetailReceipt(null)}
        title={`Chi tiết phiếu nhập: ${detailReceipt?.receipt.code}`}
        maxWidth="lg"
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
                <span className="detail-label">Ngày lập:</span>
                <span className="detail-value">
                  {formatDate(
                    detailReceipt.receipt.businessDate ||
                      detailReceipt.receipt.documentDate,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Nhà cung cấp:</span>
                <span className="detail-value">
                  {detailReceipt.receipt.supplierName || '—'}
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
              <div className="detail-item">
                <span className="detail-label">Tổng tiền:</span>
                <span className="detail-value font-bold text-success">
                  {formatVND(detailReceipt.receipt.totalAmount)}
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

            {detailReceipt.receipt.lines && (
              <div className="lines-detail-section">
                <h3 className="section-title">Chi tiết mặt hàng</h3>
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
                          Đơn giá nhập
                        </th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Thành tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailReceipt.receipt.lines.map((l, i) => (
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
              <Button variant="outline" onClick={() => setDetailReceipt(null)}>
                Đóng
              </Button>
              {canPost && detailReceipt.receipt.status === 'DRAFT' && (
                <Button
                  variant="primary"
                  onClick={handlePostReceipt}
                  isLoading={isSubmitting}
                >
                  Ghi sổ phiếu nhập
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
