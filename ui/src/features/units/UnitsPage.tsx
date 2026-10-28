import { useEffect, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EditIcon, PlusIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import type { Unit } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function UnitsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('unit.manage')

  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editUnit, setEditUnit] = useState<{
    unit: Unit
    etag: string | null
  } | null>(null)

  const [formName, setFormName] = useState('')
  const [formAllowFraction, setFormAllowFraction] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reloadUnits = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/units')
      setIsLoading(true)
    }

    const fetcher = bypassCache
      ? apiFetch<Unit[] | { items: Unit[] }>('/units')
      : cachedApiFetch<Unit[] | { items: Unit[] }>('/units')

    fetcher
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setUnits(items)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách đơn vị tính.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<Unit[] | { items: Unit[] }>('/units')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setUnits(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách đơn vị tính.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const openCreateModal = () => {
    setFormName('')
    setFormAllowFraction(false)
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên đơn vị tính.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/units', {
        method: 'POST',
        body: {
          name: formName.trim(),
          allowFraction: formAllowFraction,
        },
      })
      setIsCreateOpen(false)
      reloadUnits(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo đơn vị tính.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly without network delay
  const openEditModal = (unit: Unit) => {
    setFormError(null)
    setFormName(unit.name)
    setFormAllowFraction(unit.allowFraction)
    setEditUnit({ unit, etag: null })
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editUnit) return
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên đơn vị tính.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch(`/units/${editUnit.unit.id}`, {
        method: 'PUT',
        ifMatch: editUnit.etag || undefined,
        body: {
          name: formName.trim(),
          allowFraction: formAllowFraction,
        },
      })
      setEditUnit(null)
      reloadUnits(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể cập nhật đơn vị tính.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Đơn vị tính</h1>
          <p className="page-desc">
            Quản lý các đơn vị đo lường áp dụng cho các mặt hàng phân phối
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Thêm đơn vị tính
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách đơn vị tính..." />
        </div>
      ) : units.length === 0 ? (
        <div className="card empty-card">
          <p>Chưa có đơn vị tính nào trong hệ thống.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách đơn vị tính">
            <thead>
              <tr>
                <th scope="col" style={{ width: '80px' }}>
                  ID
                </th>
                <th scope="col">Tên đơn vị tính</th>
                <th scope="col">Cho phép số lẻ (thập phân)</th>
                <th scope="col">Trạng thái</th>
                {canManage && (
                  <th
                    scope="col"
                    style={{ textAlign: 'center', width: '100px' }}
                  >
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono">#{u.id}</td>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>
                    {u.allowFraction ? (
                      <Badge variant="info">Cho phép</Badge>
                    ) : (
                      <Badge variant="neutral">Số nguyên</Badge>
                    )}
                  </td>
                  <td>
                    {u.status === 'ACTIVE' ? (
                      <Badge variant="success">Hoạt động</Badge>
                    ) : (
                      <Badge variant="neutral">Ngừng</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="icon-action-btn"
                        title="Chỉnh sửa"
                        onClick={() => openEditModal(u)}
                      >
                        <EditIcon size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Thêm đơn vị tính mới"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên đơn vị tính"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ví dụ: Cái, Thùng, Hộp..."
            required
            autoFocus
          />
          <div className="checkbox-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formAllowFraction}
                onChange={(e) => setFormAllowFraction(e.target.checked)}
              />
              <span>Cho phép nhập số lượng thập phân (ví dụ: 1.5, 2.25)</span>
            </label>
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
              Tạo mới
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editUnit}
        onClose={() => setEditUnit(null)}
        title={`Chỉnh sửa: ${editUnit?.unit.name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleEditSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên đơn vị tính"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
          <div className="checkbox-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formAllowFraction}
                onChange={(e) => setFormAllowFraction(e.target.checked)}
              />
              <span>Cho phép nhập số lượng thập phân</span>
            </label>
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditUnit(null)}
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
