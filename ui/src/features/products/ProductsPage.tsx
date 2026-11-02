import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EditIcon, PlusIcon, SearchIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, getCachedData, invalidateCache } from '../../lib/cache'
import { formatQuantity, formatVND } from '../../lib/formatters'
import type { Product, Unit } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function ProductsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('product.manage')

  const [units, setUnits] = useState<Unit[]>(() => {
    const cached = getCachedData<Unit[] | { items: Unit[] }>('/units')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = getCachedData<Product[] | { items: Product[] }>('/products')
    if (!cached) return []
    return Array.isArray(cached) ? cached : cached.items || []
  })
  const [isLoading, setIsLoading] = useState(() => products.length === 0)
  const [error, setError] = useState<string | null>(null)

  // Client-side filters
  const [search, setSearch] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<{
    product: Product
    etag: string | null
  } | null>(null)

  // Form states
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formUnitId, setFormUnitId] = useState('')
  const [formMinStock, setFormMinStock] = useState('')
  const [formMaxStock, setFormMaxStock] = useState('')
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'DISCONTINUED'>(
    'ACTIVE',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/products')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Unit[] | { items: Unit[] }>('/units'),
      bypassCache
        ? apiFetch<Product[] | { items: Product[] }>('/products')
        : cachedApiFetch<Product[] | { items: Product[] }>('/products'),
    ])
      .then(([uRes, pRes]) => {
        setUnits(Array.isArray(uRes.data) ? uRes.data : uRes.data.items || [])
        setProducts(
          Array.isArray(pRes.data) ? pRes.data : pRes.data.items || [],
        )
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh mục mặt hàng.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Unit[] | { items: Unit[] }>('/units'),
      cachedApiFetch<Product[] | { items: Product[] }>('/products'),
    ])
      .then(([uRes, pRes]) => {
        if (!isMounted) return
        setUnits(Array.isArray(uRes.data) ? uRes.data : uRes.data.items || [])
        setProducts(
          Array.isArray(pRes.data) ? pRes.data : pRes.data.items || [],
        )
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách mặt hàng.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Fast in-memory filtering (0ms latency, 0 network requests on typing)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (search.trim()) {
        const query = search.trim().toLowerCase()
        const match =
          p.name.toLowerCase().includes(query) ||
          p.code.toLowerCase().includes(query)
        if (!match) return false
      }
      if (filterUnit && String(p.unitId) !== filterUnit) return false
      if (filterStatus && p.status !== filterStatus) return false
      return true
    })
  }, [products, search, filterUnit, filterStatus])

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, page, pageSize])

  const openCreateModal = () => {
    setFormCode('')
    setFormName('')
    setFormUnitId(units[0] ? String(units[0].id) : '')
    setFormMinStock('')
    setFormMaxStock('')
    setFormStatus('ACTIVE')
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formCode.trim()) {
      setFormError('Vui lòng nhập mã mặt hàng.')
      return
    }
    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên mặt hàng.')
      return
    }
    if (!formUnitId) {
      setFormError('Vui lòng chọn đơn vị tính.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: {
          code: formCode.trim(),
          name: formName.trim(),
          unitId: Number(formUnitId),
          minStockAlert: formMinStock ? formMinStock.trim() : undefined,
          maxStockAlert: formMaxStock ? formMaxStock.trim() : undefined,
        },
      })
      setIsCreateOpen(false)
      invalidateCache('/products')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo mặt hàng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly with in-memory product data - no blocking API round-trip
  const openEditModal = (product: Product) => {
    setFormError(null)
    setFormCode(product.code)
    setFormName(product.name)
    setFormUnitId(String(product.unitId))
    setFormMinStock(product.minStockAlert || '')
    setFormMaxStock(product.maxStockAlert || '')
    setFormStatus(product.status)
    setEditProduct({ product, etag: null })
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editProduct) return
    setFormError(null)

    setIsSubmitting(true)
    try {
      await apiFetch(`/products/${editProduct.product.id}`, {
        method: 'PUT',
        ifMatch: editProduct.etag || undefined,
        body: {
          name: formName.trim(),
          unitId: Number(formUnitId),
          minStockAlert: formMinStock ? formMinStock.trim() : undefined,
          maxStockAlert: formMaxStock ? formMaxStock.trim() : undefined,
          status: formStatus,
        },
      })
      setEditProduct(null)
      invalidateCache('/products')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể cập nhật mặt hàng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh mục mặt hàng</h1>
          <p className="page-desc">
            Quản lý thông tin mặt hàng, đơn vị tính và theo dõi tồn kho thực tế
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Thêm mặt hàng mới
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="filter-bar">
        <div className="filter-search">
          <Input
            placeholder="Tìm theo tên hoặc mã mặt hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            endAdornment={<SearchIcon size={18} />}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            options={[
              { value: '', label: 'Tất cả đơn vị tính' },
              ...units.map((u) => ({ value: String(u.id), label: u.name })),
            ]}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE', label: 'Đang kinh doanh' },
              { value: 'DISCONTINUED', label: 'Ngừng kinh doanh' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh mục mặt hàng..." />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card empty-card">
          <p>Không có mặt hàng nào phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách mặt hàng">
            <thead>
              <tr>
                <th scope="col">Mã mặt hàng</th>
                <th scope="col">Tên mặt hàng</th>
                <th scope="col">Đơn vị tính</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Tồn kho hiện tại
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Đơn giá nhập
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Đơn giá xuất
                </th>
                <th scope="col">Trạng thái</th>
                {canManage && (
                  <th scope="col" style={{ textAlign: 'center' }}>
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono font-bold">{p.code}</td>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.unitName || `ĐVT #${p.unitId}`}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatQuantity(p.currentStock)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {p.currentPurchasePrice || p.purchasePrice
                      ? formatVND(p.currentPurchasePrice || p.purchasePrice)
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: '#175c93' }}>
                    {p.currentSellingPrice || p.sellingPrice
                      ? formatVND(p.currentSellingPrice || p.sellingPrice)
                      : '—'}
                  </td>
                  <td>
                    {p.status === 'ACTIVE' ? (
                      <Badge variant="success">Đang kinh doanh</Badge>
                    ) : (
                      <Badge variant="neutral">Ngừng kinh doanh</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="icon-action-btn"
                        title="Chỉnh sửa"
                        onClick={() => openEditModal(p)}
                      >
                        <EditIcon size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination
            onNext={() => setPage((p) => p + 1)}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            hasNext={page * pageSize < filteredProducts.length}
            hasPrevious={page > 1}
            limit={pageSize}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit)
              setPage(1)
            }}
            totalShowing={filteredProducts.length}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Thêm mặt hàng mới"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid-2">
            <Input
              label="Mã mặt hàng"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="Ví dụ: MH01"
              required
              autoFocus
            />
            <Select
              label="Đơn vị tính"
              value={formUnitId}
              onChange={(e) => setFormUnitId(e.target.value)}
              options={units.map((u) => ({
                value: String(u.id),
                label: u.name,
              }))}
              required
            />
          </div>
          <Input
            label="Tên mặt hàng"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ví dụ: Nước suối đóng chai 500ml"
            required
          />
          <div className="grid-2">
            <Input
              label="Cảnh báo tồn tối thiểu"
              type="number"
              value={formMinStock}
              onChange={(e) => setFormMinStock(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Cảnh báo tồn tối đa"
              type="number"
              value={formMaxStock}
              onChange={(e) => setFormMaxStock(e.target.value)}
              placeholder="Không giới hạn"
            />
          </div>
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
              Tạo mặt hàng
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editProduct}
        onClose={() => setEditProduct(null)}
        title={`Chỉnh sửa: ${editProduct?.product.code}`}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên mặt hàng"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
          <div className="grid-2">
            <Select
              label="Đơn vị tính"
              value={formUnitId}
              onChange={(e) => setFormUnitId(e.target.value)}
              options={units.map((u) => ({
                value: String(u.id),
                label: u.name,
              }))}
              required
            />
            <Select
              label="Trạng thái kinh doanh"
              value={formStatus}
              onChange={(e) =>
                setFormStatus(e.target.value as 'ACTIVE' | 'DISCONTINUED')
              }
              options={[
                { value: 'ACTIVE', label: 'Đang kinh doanh' },
                { value: 'DISCONTINUED', label: 'Ngừng kinh doanh' },
              ]}
              required
            />
          </div>
          <div className="grid-2">
            <Input
              label="Cảnh báo tồn tối thiểu"
              type="number"
              value={formMinStock}
              onChange={(e) => setFormMinStock(e.target.value)}
            />
            <Input
              label="Cảnh báo tồn tối đa"
              type="number"
              value={formMaxStock}
              onChange={(e) => setFormMaxStock(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditProduct(null)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
