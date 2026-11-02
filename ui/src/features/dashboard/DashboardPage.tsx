import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import {
  BuildingIcon,
  DollarSignIcon,
  PackageIcon,
  ShieldIcon,
} from '../../components/ui/Icons'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, getCachedData } from '../../lib/cache'
import { formatDate, formatVND } from '../../lib/formatters'
import type { Agency, Product, StockIssue } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function DashboardPage() {
  const { user, hasPermission } = useAuth()
  const canReadSales =
    hasPermission('sales.read') || hasPermission('stock.issue.prepare')
  const canReadDebt =
    hasPermission('debt.read') || hasPermission('cash.receipt.prepare')
  const canReadInventory =
    hasPermission('inventory.read') || hasPermission('product.manage')
  const canReadAgencies = hasPermission('agency.read')

  const [selectedMonth, setSelectedMonth] = useState('2026-10')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Master collections for fallback / live calculation
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

  useEffect(() => {
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies').catch(() => ({
        data: [] as Agency[],
      })),
      cachedApiFetch<Product[] | { items: Product[] }>('/products').catch(
        () => ({ data: [] as Product[] }),
      ),
      cachedApiFetch<StockIssue[] | { items: StockIssue[] }>(
        '/stock-issues',
      ).catch(() => ({ data: [] as StockIssue[] })),
    ]).then(([aRes, pRes, iRes]) => {
      setAgencies(Array.isArray(aRes.data) ? aRes.data : aRes.data.items || [])
      setProducts(Array.isArray(pRes.data) ? pRes.data : pRes.data.items || [])
      setIssues(Array.isArray(iRes.data) ? iRes.data : iRes.data.items || [])
    })
  }, [])

  useEffect(() => {
    let isMounted = true

    apiFetch(`/dashboard?month=${selectedMonth}`)
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { status?: number; message?: string }
        if (e.status !== 404) {
          setError(e.message || 'Không thể tải dữ liệu dashboard.')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedMonth])

  // Calculated Metrics
  const metrics = useMemo(() => {
    const activeAgencies = agencies.filter((a) => a.status === 'ACTIVE').length
    const totalDebt = agencies.reduce(
      (acc, a) => acc + BigInt(a.currentDebt || '0'),
      0n,
    )
    const monthRevenue = issues
      .filter((i) => i.status === 'POSTED' || i.status === 'READY')
      .reduce((acc, i) => acc + BigInt(i.totalAmount || '0'), 0n)
    const lowStockCount = products.filter((p) => {
      const stock = Number(p.currentStock || '0')
      const threshold = Number(p.minStockAlert || p.lowStockThreshold || '20')
      return stock <= threshold
    }).length
    const pendingIssues = issues.filter(
      (i) => i.status === 'DRAFT' || i.status === 'READY',
    ).length

    return {
      activeAgencies,
      totalAgencies: agencies.length,
      totalDebt: totalDebt.toString(),
      monthRevenue: monthRevenue.toString(),
      lowStockCount,
      totalProducts: products.length,
      pendingIssues,
    }
  }, [agencies, products, issues])

  // Top 5 Agencies by Debt
  const topDebtAgencies = useMemo(() => {
    return [...agencies]
      .sort((a, b) => {
        const da = BigInt(a.currentDebt || '0')
        const db = BigInt(b.currentDebt || '0')
        return db > da ? 1 : db < da ? -1 : 0
      })
      .slice(0, 5)
  }, [agencies])

  // Top Low Stock Products
  const lowStockProductsList = useMemo(() => {
    return products
      .filter((p) => {
        const stock = Number(p.currentStock || '0')
        const threshold = Number(p.minStockAlert || p.lowStockThreshold || '20')
        return stock <= threshold
      })
      .slice(0, 5)
  }, [products])

  // Recent Stock Issues
  const recentIssuesList = useMemo(() => {
    return [...issues]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5)
  }, [issues])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bảng điều khiển tổng quan</h1>
          <p className="page-desc">
            Theo dõi chỉ số hiệu suất kinh doanh, tình hình tồn kho và công nợ
            theo phân quyền người dùng ({user?.groupName || 'Nhân viên'})
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Tháng:</span>
          <Select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            options={[
              { value: '2026-08', label: 'Tháng 08/2026' },
              { value: '2026-09', label: 'Tháng 09/2026' },
              { value: '2026-10', label: 'Tháng 10/2026' },
              { value: '2026-11', label: 'Tháng 11/2026' },
            ]}
          />
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải dữ liệu bảng điều khiển..." />
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {canReadAgencies && (
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    background: '#e7f1ff',
                    color: '#0d6efd',
                    padding: '0.75rem',
                    borderRadius: '8px',
                  }}
                >
                  <BuildingIcon size={24} />
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted, #666)',
                    }}
                  >
                    Đại lý hoạt động
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.5rem' }}>
                    {metrics.activeAgencies}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>
                      / {metrics.totalAgencies}
                    </span>
                  </h3>
                </div>
              </div>
            )}

            {canReadSales && (
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    background: '#e8f5e9',
                    color: '#2e7d32',
                    padding: '0.75rem',
                    borderRadius: '8px',
                  }}
                >
                  <DollarSignIcon size={24} />
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted, #666)',
                    }}
                  >
                    Doanh số kỳ này
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.4rem',
                      color: '#2e7d32',
                    }}
                  >
                    {formatVND(metrics.monthRevenue)}
                  </h3>
                </div>
              </div>
            )}

            {canReadDebt && (
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    background: '#ffebee',
                    color: '#c62828',
                    padding: '0.75rem',
                    borderRadius: '8px',
                  }}
                >
                  <ShieldIcon size={24} />
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted, #666)',
                    }}
                  >
                    Tổng dư nợ đại lý
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.4rem',
                      color: '#c62828',
                    }}
                  >
                    {formatVND(metrics.totalDebt)}
                  </h3>
                </div>
              </div>
            )}

            {canReadInventory && (
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    background: '#fff3e0',
                    color: '#e65100',
                    padding: '0.75rem',
                    borderRadius: '8px',
                  }}
                >
                  <PackageIcon size={24} />
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted, #666)',
                    }}
                  >
                    Cảnh báo tồn kho
                  </span>
                  <h3
                    style={{ margin: 0, fontSize: '1.5rem', color: '#e65100' }}
                  >
                    {metrics.lowStockCount}{' '}
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>
                      mặt hàng
                    </span>
                  </h3>
                </div>
              </div>
            )}
          </div>

          {/* Section Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Top Debt Agencies */}
            {canReadDebt && (
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                    Top đại lý có dư nợ cao nhất
                  </h2>
                  <Link
                    to="/receivables"
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-primary, #0d6efd)',
                    }}
                  >
                    Xem tất cả &rarr;
                  </Link>
                </div>
                <Table caption="Top đại lý nợ">
                  <thead>
                    <tr>
                      <th>Đại lý</th>
                      <th>Quận</th>
                      <th style={{ textAlign: 'right' }}>Dư nợ hiện tại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDebtAgencies.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.name}</strong>
                          <span
                            className="font-mono text-muted"
                            style={{ display: 'block', fontSize: '0.8rem' }}
                          >
                            {a.code}
                          </span>
                        </td>
                        <td>{a.districtName || '—'}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#c62828',
                          }}
                        >
                          {formatVND(a.currentDebt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {/* Low Stock Alerts */}
            {canReadInventory && (
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                    Mặt hàng chạm ngưỡng tồn tối thiểu
                  </h2>
                  <Link
                    to="/inventory"
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-primary, #0d6efd)',
                    }}
                  >
                    Thẻ kho &rarr;
                  </Link>
                </div>
                <Table caption="Mặt hàng sắp hết">
                  <thead>
                    <tr>
                      <th>Mã hàng</th>
                      <th>Tên mặt hàng</th>
                      <th style={{ textAlign: 'right' }}>Tồn hiện tại</th>
                      <th>Cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProductsList.map((p) => (
                      <tr key={p.id}>
                        <td className="font-mono font-bold">{p.code}</td>
                        <td>{p.name}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#e65100',
                          }}
                        >
                          {p.currentStock} {p.unitName || ''}
                        </td>
                        <td>
                          <Badge variant="warning">Sắp hết</Badge>
                        </td>
                      </tr>
                    ))}
                    {lowStockProductsList.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          style={{ textAlign: 'center', color: '#888' }}
                        >
                          Tất cả mặt hàng đều đạt mức tồn an toàn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}

            {/* Recent Stock Issues */}
            {canReadSales && (
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                    Phiếu xuất hàng gần đây
                  </h2>
                  <Link
                    to="/stock-issues"
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-primary, #0d6efd)',
                    }}
                  >
                    Xem phiếu xuất &rarr;
                  </Link>
                </div>
                <Table caption="Phiếu xuất gần đây">
                  <thead>
                    <tr>
                      <th>Số phiếu</th>
                      <th>Đại lý</th>
                      <th>Ngày xuất</th>
                      <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIssuesList.map((iss) => (
                      <tr key={iss.id}>
                        <td className="font-mono font-bold">{iss.code}</td>
                        <td>{iss.agencyName || `Đại lý #${iss.agencyId}`}</td>
                        <td>
                          {formatDate(iss.businessDate || iss.documentDate)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatVND(iss.totalAmount)}
                        </td>
                        <td>
                          {iss.status === 'POSTED' ? (
                            <Badge variant="success">Đã ghi sổ</Badge>
                          ) : iss.status === 'READY' ? (
                            <Badge variant="info">Chờ duyệt</Badge>
                          ) : (
                            <Badge variant="warning">Bản nháp</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
