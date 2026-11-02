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
import type { StockAdjustment } from '../../lib/types'

export function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailAdjustment, setDetailAdjustment] =
    useState<StockAdjustment | null>(null)

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<StockAdjustment[] | { items: StockAdjustment[] }>(
      '/stock-adjustments',
    )
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setAdjustments(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu điều chỉnh kho.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const openDetailModal = (adj: StockAdjustment) => {
    setDetailAdjustment(adj)
    if (!adj.lines || adj.lines.length === 0) {
      apiFetch<StockAdjustment>(`/stock-adjustments/${adj.id}`)
        .then((res: ApiResponse<StockAdjustment>) => {
          setDetailAdjustment(res.data)
        })
        .catch(() => {})
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Điều chỉnh kho</h1>
          <p className="page-desc">
            Theo dõi các biên bản điều chỉnh số lượng tồn kho (do hư hỏng, thất
            thoát hoặc sai lệch kiểm kê)
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách điều chỉnh..." />
        </div>
      ) : adjustments.length === 0 ? (
        <div className="card empty-card">
          <p>Không có phiếu điều chỉnh kho nào.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách phiếu điều chỉnh kho">
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Ngày lập</th>
                <th scope="col">Lý do điều chỉnh</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj) => (
                <tr key={adj.id}>
                  <td className="font-mono font-bold">{adj.code}</td>
                  <td>{formatDate(adj.businessDate || adj.documentDate)}</td>
                  <td>{adj.reason}</td>
                  <td>
                    {adj.status === 'POSTED' ? (
                      <Badge variant="success">Đã ghi sổ</Badge>
                    ) : adj.status === 'DRAFT' ? (
                      <Badge variant="warning">Bản nháp</Badge>
                    ) : (
                      <Badge variant="neutral">Đã hủy</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetailModal(adj)}
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
        isOpen={!!detailAdjustment}
        onClose={() => setDetailAdjustment(null)}
        title={`Chi tiết phiếu điều chỉnh: ${detailAdjustment?.code}`}
        maxWidth="lg"
      >
        {detailAdjustment && (
          <div className="adjustment-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Số phiếu:</span>
                <span className="detail-value font-mono font-bold">
                  {detailAdjustment.code}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ngày lập:</span>
                <span className="detail-value">
                  {formatDate(
                    detailAdjustment.businessDate ||
                      detailAdjustment.documentDate,
                  )}
                </span>
              </div>
              <div className="detail-item detail-item--full">
                <span className="detail-label">Lý do điều chỉnh:</span>
                <span className="detail-value font-bold">
                  {detailAdjustment.reason}
                </span>
              </div>
            </div>

            {detailAdjustment.lines && (
              <div className="lines-detail-section">
                <h3 className="section-title">Danh sách mặt hàng điều chỉnh</h3>
                <div className="table-responsive">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Mã hàng</th>
                        <th scope="col">Tên mặt hàng</th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Lượng điều chỉnh (+ / -)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailAdjustment.lines.map((l, i) => {
                        const isPositive = !l.quantityDelta.startsWith('-')
                        return (
                          <tr key={i}>
                            <td className="font-mono">{l.productCode}</td>
                            <td>
                              <strong>{l.productName}</strong>
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: isPositive ? '#187b55' : '#ba3b2f',
                              }}
                            >
                              {isPositive
                                ? `+${formatQuantity(l.quantityDelta)}`
                                : formatQuantity(l.quantityDelta)}
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
