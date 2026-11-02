import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SearchIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, getCachedData } from '../../lib/cache'
import { formatDate, formatVND } from '../../lib/formatters'
import type { AgencyBalance, InvoiceBalance } from '../../lib/types'

interface ReceivableSummaryItem {
  agencyId: string
  agencyCode: string
  agencyName: string
  districtName?: string
  currentDebt: string
  maxDebt: string
  availableCredit?: string
  status: 'ACTIVE' | 'TERMINATED'
}

export function ReceivablesPage() {
  const [items, setItems] = useState<ReceivableSummaryItem[]>(() => {
    const cached = getCachedData<
      ReceivableSummaryItem[] | { items: ReceivableSummaryItem[] }
    >('/receivables')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [isLoading, setIsLoading] = useState(() => items.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Agency Detail Balance Modal
  const [selectedAgency, setSelectedAgency] =
    useState<ReceivableSummaryItem | null>(null)
  const [agencyBalance, setAgencyBalance] = useState<AgencyBalance | null>(null)
  const [agencyInvoices, setAgencyInvoices] = useState<InvoiceBalance[]>([])
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<
      ReceivableSummaryItem[] | { items: ReceivableSummaryItem[] }
    >('/receivables')
      .then((res) => {
        if (!isMounted) return
        const data = Array.isArray(res.data) ? res.data : res.data.items || []
        setItems(data)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải dữ liệu công nợ đại lý.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const openAgencyDetail = async (item: ReceivableSummaryItem) => {
    setSelectedAgency(item)
    setIsDetailLoading(true)
    try {
      const [balRes, invRes] = await Promise.all([
        apiFetch<AgencyBalance>(`/agencies/${item.agencyId}/balance`),
        apiFetch<InvoiceBalance[] | { items: InvoiceBalance[] }>(
          `/agencies/${item.agencyId}/invoices`,
        ),
      ])
      setAgencyBalance(balRes.data)
      setAgencyInvoices(
        Array.isArray(invRes.data) ? invRes.data : invRes.data.items || [],
      )
    } catch {
      // Keep basic info
    } finally {
      setIsDetailLoading(false)
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.agencyName.toLowerCase().includes(search.toLowerCase()) ||
      item.agencyCode.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Công nợ đại lý</h1>
          <p className="page-desc">
            Theo dõi dư nợ thực tế, giới hạn nợ tối đa và danh sách hóa đơn xuất
            chưa thanh toán
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="filter-bar">
        <div className="filter-search">
          <Input
            placeholder="Tìm theo mã hoặc tên đại lý..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            endAdornment={<SearchIcon size={18} />}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải dữ liệu công nợ..." />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card empty-card">
          <p>Không có dữ liệu công nợ đại lý phù hợp.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách công nợ đại lý">
            <thead>
              <tr>
                <th scope="col">Mã đại lý</th>
                <th scope="col">Tên đại lý</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Dư nợ hiện tại
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Giới hạn nợ tối đa
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Hạn mức còn lại
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Chi tiết nợ
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.agencyId}>
                  <td className="font-mono font-bold">{item.agencyCode}</td>
                  <td>
                    <strong>{item.agencyName}</strong>
                    {item.districtName && (
                      <div className="cell-subtext">{item.districtName}</div>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color:
                        Number(item.currentDebt) > 0 ? '#ba3b2f' : 'inherit',
                    }}
                  >
                    {formatVND(item.currentDebt)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatVND(item.maxDebt)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#187b55' }}>
                    {formatVND(
                      String(
                        Math.max(
                          0,
                          Number(item.maxDebt) - Number(item.currentDebt),
                        ),
                      ),
                    )}
                  </td>
                  <td>
                    {item.status === 'ACTIVE' ? (
                      <Badge variant="success">Hoạt động</Badge>
                    ) : (
                      <Badge variant="danger">Ngừng hợp tác</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAgencyDetail(item)}
                    >
                      Xem hóa đơn
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Agency Debt Breakdown Modal */}
      <Modal
        isOpen={!!selectedAgency}
        onClose={() => {
          setSelectedAgency(null)
          setAgencyBalance(null)
          setAgencyInvoices([])
        }}
        title={`Chi tiết công nợ: ${selectedAgency?.agencyName} (${selectedAgency?.agencyCode})`}
        maxWidth="lg"
      >
        {isDetailLoading ? (
          <div className="page-loading">
            <Spinner label="Đang tải chi tiết hóa đơn nợ..." />
          </div>
        ) : (
          <div className="receivable-detail">
            {agencyBalance && (
              <div className="debt-summary-banner">
                <div className="debt-stat">
                  <span className="stat-label">Tổng nợ hiện tại</span>
                  <span className="stat-value text-danger">
                    {formatVND(agencyBalance.currentDebt)}
                  </span>
                </div>
                <div className="debt-stat">
                  <span className="stat-label">Hạn mức nợ cho phép</span>
                  <span className="stat-value">
                    {formatVND(agencyBalance.maxDebt)}
                  </span>
                </div>
                <div className="debt-stat">
                  <span className="stat-label">Dư có khả dụng</span>
                  <span className="stat-value text-success">
                    {formatVND(agencyBalance.availableCredit)}
                  </span>
                </div>
              </div>
            )}

            <h3 className="section-title">
              Danh sách hóa đơn chưa thanh toán đủ
            </h3>
            {agencyInvoices.length === 0 ? (
              <p className="text-muted">
                Đại lý hiện không có hóa đơn nào còn nợ.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Số hóa đơn</th>
                      <th scope="col">Ngày xuất</th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Tổng hóa đơn
                      </th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Đã thanh toán
                      </th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Còn nợ lại
                      </th>
                      <th scope="col">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencyInvoices.map((inv) => (
                      <tr key={inv.invoiceId}>
                        <td className="font-mono font-bold">
                          {inv.invoiceCode}
                        </td>
                        <td>{formatDate(inv.documentDate)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {formatVND(inv.totalAmount)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#187b55' }}>
                          {formatVND(inv.paidAmount)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#ba3b2f',
                          }}
                        >
                          {formatVND(inv.remainingAmount)}
                        </td>
                        <td>
                          {inv.status === 'PAID' ? (
                            <Badge variant="success">Đã trả hết</Badge>
                          ) : inv.status === 'PARTIALLY_PAID' ? (
                            <Badge variant="warning">Trả một phần</Badge>
                          ) : (
                            <Badge variant="danger">Chưa thanh toán</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
