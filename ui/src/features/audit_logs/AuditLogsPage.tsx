import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { cachedApiFetch } from '../../lib/cache'
import { formatDateTime } from '../../lib/formatters'
import type { AuditLog } from '../../lib/types'

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [pageSize, setPageSize] = useState(25)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined,
  )

  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)

  useEffect(() => {
    let isMounted = true
    const params = new URLSearchParams()
    if (filterAction) params.append('action', filterAction)
    if (filterEntity) params.append('entityType', filterEntity)
    if (currentCursor) params.append('cursor', currentCursor)
    params.append('limit', String(pageSize))

    cachedApiFetch<AuditLog[] | { items: AuditLog[]; nextCursor?: string }>(
      `/audit-logs?${params.toString()}`,
    )
      .then((res) => {
        if (!isMounted) return
        if (Array.isArray(res.data)) {
          setLogs(res.data)
          setNextCursor(null)
        } else {
          setLogs(res.data.items || [])
          setNextCursor(res.data.nextCursor || null)
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải nhật ký hệ thống.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [filterAction, filterEntity, currentCursor, pageSize])

  const handleNextPage = () => {
    if (!nextCursor) return
    setCursorHistory((prev) => [...prev, currentCursor || ''])
    setCurrentCursor(nextCursor)
  }

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return
    const prevHistory = [...cursorHistory]
    const lastCursor = prevHistory.pop()
    setCursorHistory(prevHistory)
    setCurrentCursor(lastCursor || undefined)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhật ký hệ thống</h1>
          <p className="page-desc">
            Theo dõi lịch sử các thao tác thay đổi dữ liệu và tác vụ quan trọng
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="filter-bar">
        <div className="filter-select">
          <Select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value)
              setCurrentCursor(undefined)
              setCursorHistory([])
            }}
            options={[
              { value: '', label: 'Tất cả hành động' },
              { value: 'CREATE', label: 'Tạo mới (CREATE)' },
              { value: 'UPDATE', label: 'Cập nhật (UPDATE)' },
              { value: 'DELETE', label: 'Xóa (DELETE)' },
              { value: 'TERMINATE', label: 'Ngừng hợp tác (TERMINATE)' },
            ]}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterEntity}
            onChange={(e) => {
              setFilterEntity(e.target.value)
              setCurrentCursor(undefined)
              setCursorHistory([])
            }}
            options={[
              { value: '', label: 'Tất cả đối tượng' },
              { value: 'agency', label: 'Đại lý' },
              { value: 'product', label: 'Mặt hàng' },
              { value: 'stock_receipt', label: 'Phiếu nhập kho' },
              { value: 'stock_issue', label: 'Phiếu xuất kho' },
              { value: 'payment_receipt', label: 'Phiếu thu tiền' },
              { value: 'app_user', label: 'Tài khoản' },
              { value: 'business_rule', label: 'Quy định' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải nhật ký..." />
        </div>
      ) : logs.length === 0 ? (
        <div className="card empty-card">
          <p>Không có bản ghi nhật ký nào.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách nhật ký hệ thống">
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Người thực hiện</th>
                <th scope="col">Hành động</th>
                <th scope="col">Đối tượng</th>
                <th scope="col">Mã đối tượng</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Chi tiết
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-muted">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td>
                    <strong>
                      {log.actorName || log.actorId || 'Hệ thống'}
                    </strong>
                  </td>
                  <td>
                    <Badge
                      variant={
                        log.action === 'CREATE'
                          ? 'success'
                          : log.action === 'UPDATE'
                            ? 'info'
                            : 'danger'
                      }
                    >
                      {log.action}
                    </Badge>
                  </td>
                  <td className="font-mono">{log.entityType}</td>
                  <td className="font-mono">{log.entityId || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailLog(log)}
                    >
                      Xem
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination
            onNext={handleNextPage}
            onPrevious={handlePrevPage}
            hasNext={!!nextCursor}
            hasPrevious={cursorHistory.length > 0}
            isLoading={isLoading}
            limit={pageSize}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit)
              setCurrentCursor(undefined)
              setCursorHistory([])
            }}
            totalShowing={logs.length}
          />
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailLog}
        onClose={() => setDetailLog(null)}
        title="Chi tiết bản ghi nhật ký"
        maxWidth="md"
      >
        {detailLog && (
          <div className="audit-detail">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Mã bản ghi:</span>
                <span className="detail-value font-mono">{detailLog.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Thời gian:</span>
                <span className="detail-value">
                  {formatDateTime(detailLog.createdAt)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Người thực hiện:</span>
                <span className="detail-value font-bold">
                  {detailLog.actorName || detailLog.actorId || 'Hệ thống'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Hành động:</span>
                <span className="detail-value">
                  <Badge variant="info">{detailLog.action}</Badge>
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Đối tượng:</span>
                <span className="detail-value font-mono">
                  {detailLog.entityType}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Mã thực thể:</span>
                <span className="detail-value font-mono">
                  {detailLog.entityId || '—'}
                </span>
              </div>
              {detailLog.requestId && (
                <div className="detail-item detail-item--full">
                  <span className="detail-label">Request ID:</span>
                  <span className="detail-value font-mono text-muted">
                    {detailLog.requestId}
                  </span>
                </div>
              )}
            </div>

            {detailLog.changes && Object.keys(detailLog.changes).length > 0 && (
              <div className="audit-changes-section">
                <h3 className="section-title">Thay đổi dữ liệu</h3>
                <div className="table-responsive">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Trường</th>
                        <th scope="col">Trước khi đổi</th>
                        <th scope="col">Sau khi đổi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(detailLog.changes).map(
                        ([field, diff]) => (
                          <tr key={field}>
                            <td className="font-mono font-bold">{field}</td>
                            <td className="text-muted">
                              {diff.before !== null && diff.before !== undefined
                                ? String(diff.before)
                                : '—'}
                            </td>
                            <td className="font-bold text-success">
                              {diff.after !== null && diff.after !== undefined
                                ? String(diff.after)
                                : '—'}
                            </td>
                          </tr>
                        ),
                      )}
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
