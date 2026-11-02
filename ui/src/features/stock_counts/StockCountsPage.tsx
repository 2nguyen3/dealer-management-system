import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch, type ApiResponse } from '../../lib/api'
import { cachedApiFetch } from '../../lib/cache'
import { formatDate, formatQuantity } from '../../lib/formatters'
import type { StockCount } from '../../lib/types'

export function StockCountsPage() {
  const [counts, setCounts] = useState<StockCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailCount, setDetailCount] = useState<StockCount | null>(null)

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<StockCount[] | { items: StockCount[] }>('/stock-counts')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setCounts(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách biên bản kiểm kê kho.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const openDetailModal = (count: StockCount) => {
    setDetailCount(count)
    if (!count.lines || count.lines.length === 0) {
      apiFetch<StockCount>(`/stock-counts/${count.id}`)
        .then((res: ApiResponse<StockCount>) => {
          setDetailCount(res.data)
        })
        .catch(() => {})
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kiểm kê kho hàng</h1>
          <p className="page-desc">
            Biên bản kiểm kê định kỳ, đối chiếu giữa số lượng sổ sách và số
            lượng thực tế trong kho
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách kiểm kê..." />
        </div>
      ) : counts.length === 0 ? (
        <div className="card empty-card">
          <p>Không có biên bản kiểm kê kho nào.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách biên bản kiểm kê kho">
            <thead>
              <tr>
                <th scope="col">Số biên bản</th>
                <th scope="col">Ngày kiểm kê</th>
                <th scope="col">Ghi chú</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono font-bold">{c.code}</td>
                  <td>
                    {formatDate(c.countedAt || c.documentDate || c.createdAt)}
                  </td>
                  <td className="text-muted">{c.reason || c.note || '—'}</td>
                  <td>
                    {c.state === 'CONFIRMED' || c.status === 'CONFIRMED' ? (
                      <Badge variant="success">Đã xác nhận</Badge>
                    ) : c.state === 'DRAFT' || c.status === 'DRAFT' ? (
                      <Badge variant="warning">Bản nháp</Badge>
                    ) : (
                      <Badge variant="neutral">Đã hủy</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetailModal(c)}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailCount}
        onClose={() => setDetailCount(null)}
        title={`Chi tiết biên bản kiểm kê: ${detailCount?.code}`}
        maxWidth="lg"
      >
        {detailCount && (
          <div className="count-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Số biên bản:</span>
                <span className="detail-value font-mono font-bold">
                  {detailCount.code}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ngày kiểm kê:</span>
                <span className="detail-value">
                  {formatDate(
                    detailCount.countedAt ||
                      detailCount.documentDate ||
                      detailCount.createdAt,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Trạng thái:</span>
                <span className="detail-value">
                  {detailCount.state === 'CONFIRMED' ||
                  detailCount.status === 'CONFIRMED' ? (
                    <Badge variant="success">Đã xác nhận</Badge>
                  ) : (
                    <Badge variant="warning">Bản nháp</Badge>
                  )}
                </span>
              </div>
              {(detailCount.reason || detailCount.note) && (
                <div className="detail-item detail-item--full">
                  <span className="detail-label">Ghi chú / Lý do:</span>
                  <span className="detail-value">
                    {detailCount.reason || detailCount.note}
                  </span>
                </div>
              )}
            </div>

            {detailCount.lines && (
              <div className="lines-detail-section">
                <h3 className="section-title">Kết quả kiểm kê chi tiết</h3>
                <div className="table-responsive">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Mã hàng</th>
                        <th scope="col">Tên mặt hàng</th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Tồn sổ sách
                        </th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Tồn thực tế
                        </th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Chênh lệch
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailCount.lines.map((l, i) => {
                        const hasDiff = Number(l.difference) !== 0
                        return (
                          <tr key={i}>
                            <td className="font-mono">{l.productCode}</td>
                            <td>
                              <strong>{l.productName}</strong>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {formatQuantity(l.bookQuantity)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatQuantity(
                                l.actualQuantity || l.countedQuantity || '0',
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: hasDiff ? '#ba3b2f' : '#187b55',
                              }}
                            >
                              {formatQuantity(l.difference)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
