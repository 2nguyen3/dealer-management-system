import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { cachedApiFetch } from '../../lib/cache'
import { formatDateTime, formatVND } from '../../lib/formatters'
import type { Agency, CreditLot } from '../../lib/types'

export function AgencyCreditPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('')
  const [lots, setLots] = useState<CreditLot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLots, setIsLoadingLots] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setAgencies(items)
        if (items[0]) {
          setSelectedAgencyId(items[0].id)
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách đại lý.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedAgencyId) return
    let isMounted = true

    cachedApiFetch<{ items: CreditLot[] }>(
      `/agencies/${selectedAgencyId}/credit-lots`,
    )
      .then((res) => {
        if (!isMounted) return
        setLots(res.data.items || [])
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách lô dư có của đại lý.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingLots(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedAgencyId])

  const selectedAgency = agencies.find((a) => a.id === selectedAgencyId)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hạn mức & Dư có đại lý</h1>
          <p className="page-desc">
            Theo dõi các khoản tiền dư có phát sinh từ trả hàng hoặc thanh toán
            thừa để cấn trừ nợ sau
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="card filter-bar-card">
        <div className="filter-group-inline">
          <label htmlFor="select-credit-agency" className="form-label mb-0">
            Chọn đại lý xem dư có:
          </label>
          <div style={{ minWidth: '320px' }}>
            <Select
              id="select-credit-agency"
              value={selectedAgencyId}
              onChange={(e) => {
                setSelectedAgencyId(e.target.value)
                setIsLoadingLots(true)
              }}
              options={agencies.map((a) => ({
                value: a.id,
                label: `${a.code} - ${a.name} (Dư có: ${formatVND(a.currentCredit || '0')})`,
              }))}
            />
          </div>
        </div>
      </div>

      {selectedAgency && (
        <div className="debt-summary-banner">
          <div className="debt-stat">
            <span className="stat-label">Tổng dư có hiện tại</span>
            <span className="stat-value font-bold text-success">
              {formatVND(selectedAgency.currentCredit || '0')}
            </span>
          </div>
          <div className="debt-stat">
            <span className="stat-label">Dư nợ hiện tại</span>
            <span className="stat-value font-bold text-danger">
              {formatVND(selectedAgency.currentDebt)}
            </span>
          </div>
          <div className="debt-stat">
            <span className="stat-label">Giới hạn nợ tối đa</span>
            <span className="stat-value">
              {formatVND(selectedAgency.maxDebt)}
            </span>
          </div>
        </div>
      )}

      {isLoading || isLoadingLots ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách dư có..." />
        </div>
      ) : lots.length === 0 ? (
        <div className="card empty-card">
          <p>Đại lý này hiện không có lô dư có nào khả dụng.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách lô dư có đại lý">
            <thead>
              <tr>
                <th scope="col">Mã lô</th>
                <th scope="col">Nguồn phát sinh</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Số tiền còn lại
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Đang giữ chỗ
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Khả dụng
                </th>
                <th scope="col">Thời điểm tạo</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td className="font-mono font-bold">#{lot.id}</td>
                  <td>
                    <span className="font-mono text-sm">
                      {lot.sourceDocumentType ||
                        (lot.sourceDocumentId
                          ? `Chứng từ #${lot.sourceDocumentId}`
                          : 'Hệ thống')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatVND(
                      lot.balance || lot.remainingAmount || lot.originalAmount,
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b25e09' }}>
                    {formatVND(lot.reserved || lot.reservedAmount || '0')}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#187b55',
                    }}
                  >
                    {formatVND(lot.available || lot.availableAmount)}
                  </td>
                  <td className="text-muted">
                    {formatDateTime(lot.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
