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
import type { District } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function DistrictsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('district.manage')

  const [districts, setDistricts] = useState<District[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editDistrict, setEditDistrict] = useState<{
    district: District
    etag: string | null
  } | null>(null)

  const [formName, setFormName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reloadDistricts = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/districts')
      setIsLoading(true)
    }

    const fetcher = bypassCache
      ? apiFetch<District[] | { items: District[] }>('/districts')
      : cachedApiFetch<District[] | { items: District[] }>('/districts')

    fetcher
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setDistricts(items)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách quận.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<District[] | { items: District[] }>('/districts')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setDistricts(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách quận.')
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
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên quận.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/districts', {
        method: 'POST',
        body: { name: formName.trim() },
      })
      setIsCreateOpen(false)
      reloadDistricts(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo quận mới.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly with in-memory district data
  const openEditModal = (district: District) => {
    setFormError(null)
    setFormName(district.name)
    setEditDistrict({ district, etag: null })
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editDistrict) return
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên quận.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch(`/districts/${editDistrict.district.id}`, {
        method: 'PUT',
        ifMatch: editDistrict.etag || undefined,
        body: { name: formName.trim() },
      })
      setEditDistrict(null)
      reloadDistricts(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể cập nhật thông tin quận.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Danh sách quận</h1>
          <p className="page-desc">
            Quản lý địa bàn hoạt động của các đại lý trực thuộc hệ thống
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Thêm quận mới
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách quận..." />
        </div>
      ) : districts.length === 0 ? (
        <div className="card empty-card">
          <p>Chưa có thông tin quận nào trong hệ thống.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách các quận">
            <thead>
              <tr>
                <th scope="col" style={{ width: '80px' }}>
                  ID
                </th>
                <th scope="col">Tên quận</th>
                <th scope="col">Số đại lý đang hoạt động</th>
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
              {districts.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono">#{d.id}</td>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td>{d.activeAgenciesCount ?? '—'}</td>
                  <td>
                    {d.status === 'ACTIVE' ? (
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
                        onClick={() => openEditModal(d)}
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
        title="Thêm quận mới"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên quận"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ví dụ: Quận 1, Quận Bình Thạnh..."
            required
            autoFocus
          />
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
              Thêm quận
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editDistrict}
        onClose={() => setEditDistrict(null)}
        title={`Chỉnh sửa: ${editDistrict?.district.name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleEditSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên quận"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDistrict(null)}
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
