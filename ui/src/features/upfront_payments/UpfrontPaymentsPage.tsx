import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import { formatDateTime, formatVND } from '../../lib/formatters'
import type { UpfrontConfirmation } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function UpfrontPaymentsPage() {
  const { hasPermission } = useAuth()
  const canVerify = hasPermission('cash.upfront.verify')

  const [confirmations, setConfirmations] = useState<UpfrontConfirmation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const reloadConfirmations = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/upfront-confirmations')
      setIsLoading(true)
    }

    const fetcher = bypassCache
      ? apiFetch<UpfrontConfirmation[] | { items: UpfrontConfirmation[] }>(
          '/upfront-confirmations',
        )
      : cachedApiFetch<
          UpfrontConfirmation[] | { items: UpfrontConfirmation[] }
        >('/upfront-confirmations')

    fetcher
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setConfirmations(items)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(
          e.message || 'Không thể tải danh sách xác nhận thanh toán trả ngay.',
        )
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<UpfrontConfirmation[] | { items: UpfrontConfirmation[] }>(
      '/upfront-confirmations',
    )
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setConfirmations(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(
          e.message || 'Không thể tải danh sách xác nhận thanh toán trả ngay.',
        )
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleVerify = async (item: UpfrontConfirmation) => {
    if (!canVerify) return
    setVerifyingId(item.id)
    setError(null)
    setSuccessNotice(null)

    try {
      await apiFetch(`/upfront-confirmations/${item.id}/verify`, {
        method: 'POST',
      })
      setSuccessNotice(
        `Đã xác nhận tiền trả ngay cho phiếu xuất ${item.stockIssueCode}.`,
      )
      invalidateCache('/upfront-confirmations')
      invalidateCache('/stock-issues')
      reloadConfirmations(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Không thể xác nhận thanh toán trả ngay.')
    } finally {
      setVerifyingId(null)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Xác nhận thanh toán trả ngay</h1>
          <p className="page-desc">
            Xác minh thực tế các khoản tiền thanh toán trước khi xuất kho cho
            đại lý vượt nợ
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successNotice && <Alert type="success">{successNotice}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải dữ liệu trả ngay..." />
        </div>
      ) : confirmations.length === 0 ? (
        <div className="card empty-card">
          <p>Không có yêu cầu xác nhận trả ngay nào đang chờ.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách xác nhận thanh toán trả ngay">
            <thead>
              <tr>
                <th scope="col">Số phiếu xuất</th>
                <th scope="col">Đại lý</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Số tiền cần trả ngay
                </th>
                <th scope="col">Thời gian yêu cầu</th>
                <th scope="col">Trạng thái xác minh</th>
                {canVerify && (
                  <th scope="col" style={{ textAlign: 'center' }}>
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {confirmations.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono font-bold">{item.stockIssueCode}</td>
                  <td>
                    <strong>{item.agencyName}</strong>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(item.amount)}
                  </td>
                  <td className="text-muted">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td>
                    {item.verified ? (
                      <Badge variant="success">Đã xác minh tiền về</Badge>
                    ) : (
                      <Badge variant="warning">Chờ kế toán xác minh</Badge>
                    )}
                  </td>
                  {canVerify && (
                    <td style={{ textAlign: 'center' }}>
                      {!item.verified ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerify(item)}
                          isLoading={verifyingId === item.id}
                        >
                          Xác nhận đã nhận tiền
                        </Button>
                      ) : (
                        <span className="text-muted text-sm">Đã duyệt</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
