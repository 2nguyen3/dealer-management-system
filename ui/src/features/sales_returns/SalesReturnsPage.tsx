import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch, type ApiResponse } from '../../lib/api'
import { cachedApiFetch } from '../../lib/cache'
import { formatDate, formatQuantity, formatVND } from '../../lib/formatters'
import type { SalesReturn } from '../../lib/types'

export function SalesReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailReturn, setDetailReturn] = useState<SalesReturn | null>(null)

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<SalesReturn[] | { items: SalesReturn[] }>('/sales-returns')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setReturns(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách phiếu trả hàng.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const openDetailModal = (ret: SalesReturn) => {
    setDetailReturn(ret)
    if (!ret.lines || ret.lines.length === 0) {
      apiFetch<SalesReturn>(`/sales-returns/${ret.id}`)
        .then((res: ApiResponse<SalesReturn>) => {
          setDetailReturn(res.data)
        })
        .catch(() => {})
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Phiếu trả hàng</h1>
          <p className="page-desc">
            Quản lý việc nhận lại hàng hóa từ đại lý, điều chỉnh giảm nợ hoặc
            tạo hạn mức dư có
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách phiếu trả hàng..." />
        </div>
      ) : returns.length === 0 ? (
        <div className="card empty-card">
          <p>Không có phiếu trả hàng nào trong hệ thống.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách phiếu trả hàng">
            <thead>
              <tr>
                <th scope="col">Số phiếu</th>
                <th scope="col">Đại lý trả hàng</th>
                <th scope="col">Hóa đơn xuất gốc</th>
                <th scope="col">Ngày trả</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Giá trị trả lại
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret) => (
                <tr key={ret.id}>
                  <td className="font-mono font-bold">{ret.code}</td>
                  <td>
                    <strong>
                      {ret.agencyName || `Đại lý #${ret.agencyId}`}
                    </strong>
                  </td>
                  <td className="font-mono">
                    {ret.sourceInvoiceCode ||
                      (ret.originDocumentId
                        ? `Hóa đơn #${ret.originDocumentId}`
                        : '—')}
                  </td>
                  <td>{formatDate(ret.businessDate || ret.documentDate)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(ret.totalAmount)}
                  </td>
                  <td>
                    {ret.status === 'POSTED' ? (
                      <Badge variant="success">Đã ghi sổ</Badge>
                    ) : ret.status === 'DRAFT' ? (
                      <Badge variant="warning">Bản nháp</Badge>
                    ) : (
                      <Badge variant="neutral">Đã hủy</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetailModal(ret)}
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
        isOpen={!!detailReturn}
        onClose={() => setDetailReturn(null)}
        title={`Chi tiết phiếu trả hàng: ${detailReturn?.code}`}
        maxWidth="lg"
      >
        {detailReturn && (
          <div className="return-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Số phiếu:</span>
                <span className="detail-value font-mono font-bold">
                  {detailReturn.code}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Đại lý:</span>
                <span className="detail-value font-bold">
                  {detailReturn.agencyName || detailReturn.agencyId}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Hóa đơn gốc:</span>
                <span className="detail-value font-mono">
                  {detailReturn.sourceInvoiceCode ||
                    (detailReturn.originDocumentId
                      ? `Hóa đơn #${detailReturn.originDocumentId}`
                      : '—')}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ngày trả:</span>
                <span className="detail-value">
                  {formatDate(
                    detailReturn.businessDate || detailReturn.documentDate,
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tổng tiền trả:</span>
                <span className="detail-value font-bold text-success">
                  {formatVND(detailReturn.totalAmount)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Trạng thái:</span>
                <span className="detail-value">
                  {detailReturn.status === 'POSTED' ? (
                    <Badge variant="success">Đã ghi sổ</Badge>
                  ) : detailReturn.status === 'DRAFT' ? (
                    <Badge variant="warning">Bản nháp</Badge>
                  ) : (
                    <Badge variant="neutral">Đã hủy</Badge>
                  )}
                </span>
              </div>
            </div>

            {detailReturn.lines && (
              <div className="lines-detail-section">
                <h3 className="section-title">Chi tiết mặt hàng nhận lại</h3>
                <div className="table-responsive">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Mã hàng</th>
                        <th scope="col">Tên mặt hàng</th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Số lượng trả
                        </th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Đơn giá gốc
                        </th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Thành tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailReturn.lines.map((l, i) => (
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
          </div>
        )}
      </Modal>
    </div>
  )
}
