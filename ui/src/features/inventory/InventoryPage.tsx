import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { cachedApiFetch } from '../../lib/cache'
import { formatDate, formatQuantity, formatVND } from '../../lib/formatters'
import type { InventoryEntry, Product } from '../../lib/types'

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [entries, setEntries] = useState<InventoryEntry[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<Product[] | { items: Product[] }>('/products')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setProducts(items)
        if (items[0]) {
          setSelectedProductId(items[0].id)
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách mặt hàng.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingProducts(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedProductId) return
    let isMounted = true

    cachedApiFetch<InventoryEntry[] | { items: InventoryEntry[] }>(
      `/products/${selectedProductId}/inventory-entries?limit=50`,
    )
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setEntries(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải thẻ kho của mặt hàng.')
      })
      .finally(() => {
        if (isMounted) setIsLoadingEntries(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedProductId])

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tồn kho & Thẻ kho</h1>
          <p className="page-desc">
            Theo dõi chi tiết lịch sử xuất nhập tồn và biến động thẻ kho theo
            từng mặt hàng
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="card filter-bar-card">
        <div className="filter-group-inline">
          <label htmlFor="select-product" className="form-label mb-0">
            Chọn mặt hàng tra cứu:
          </label>
          <div style={{ minWidth: '320px' }}>
            <Select
              id="select-product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              options={products.map((p) => ({
                value: p.id,
                label: `${p.code} - ${p.name} (Hiện tồn: ${formatQuantity(p.currentStock)})`,
              }))}
            />
          </div>
        </div>
      </div>

      {selectedProduct && (
        <div className="stock-summary-banner">
          <div className="stock-stat">
            <span className="stat-label">Tồn kho hiện tại</span>
            <span className="stat-value font-bold text-success">
              {formatQuantity(selectedProduct.currentStock)}{' '}
              {selectedProduct.unitName}
            </span>
          </div>
          <div className="stock-stat">
            <span className="stat-label">Cảnh báo tồn tối thiểu</span>
            <span className="stat-value">
              {formatQuantity(selectedProduct.minStockAlert || '0')}{' '}
              {selectedProduct.unitName}
            </span>
          </div>
          <div className="stock-stat">
            <span className="stat-label">Cảnh báo tồn tối đa</span>
            <span className="stat-value">
              {selectedProduct.maxStockAlert
                ? `${formatQuantity(selectedProduct.maxStockAlert)} ${selectedProduct.unitName}`
                : 'Không giới hạn'}
            </span>
          </div>
        </div>
      )}

      {isLoadingProducts || isLoadingEntries ? (
        <div className="page-loading">
          <Spinner label="Đang tải thẻ kho..." />
        </div>
      ) : entries.length === 0 ? (
        <div className="card empty-card">
          <p>Chưa có giao dịch biến động kho nào cho mặt hàng này.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Sổ thẻ kho mặt hàng">
            <thead>
              <tr>
                <th scope="col">Ngày giao dịch</th>
                <th scope="col">Loại chứng từ</th>
                <th scope="col">Mã chứng từ</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Số lượng biến động
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Tồn sau giao dịch
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Đơn giá
                </th>
                <th scope="col">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isPositive = !entry.quantityDelta.startsWith('-')
                return (
                  <tr key={entry.id}>
                    <td>
                      {formatDate(entry.businessDate || entry.documentDate)}
                    </td>
                    <td>
                      <Badge variant={isPositive ? 'success' : 'info'}>
                        {entry.documentType}
                      </Badge>
                    </td>
                    <td className="font-mono font-bold">
                      {entry.documentCode || entry.documentId}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: isPositive ? '#187b55' : '#ba3b2f',
                      }}
                    >
                      {isPositive
                        ? `+${formatQuantity(entry.quantityDelta)}`
                        : formatQuantity(entry.quantityDelta)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatQuantity(entry.balanceAfter)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {entry.unitPrice ? formatVND(entry.unitPrice) : '—'}
                    </td>
                    <td className="text-muted">{entry.reference || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
