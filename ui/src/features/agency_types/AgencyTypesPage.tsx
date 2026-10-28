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
import { formatVND } from '../../lib/formatters'
import type { AgencyType } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function AgencyTypesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('agency_type.manage')

  const [agencyTypes, setAgencyTypes] = useState<AgencyType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editType, setEditType] = useState<{
    type: AgencyType
    etag: string | null
  } | null>(null)

  const [formName, setFormName] = useState('')
  const [formMaxDebt, setFormMaxDebt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reloadAgencyTypes = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/agency-types')
      setIsLoading(true)
    }

    const fetcher = bypassCache
      ? apiFetch<AgencyType[] | { items: AgencyType[] }>('/agency-types')
      : cachedApiFetch<AgencyType[] | { items: AgencyType[] }>('/agency-types')

    fetcher
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setAgencyTypes(items)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách loại đại lý.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<AgencyType[] | { items: AgencyType[] }>('/agency-types')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setAgencyTypes(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách loại đại lý.')
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
    setFormMaxDebt('50000000')
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên loại đại lý.')
      return
    }
    if (!formMaxDebt.trim()) {
      setFormError('Vui lòng nhập số tiền nợ tối đa.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/agency-types', {
        method: 'POST',
        body: {
          name: formName.trim(),
          maxDebt: formMaxDebt.trim(),
        },
      })
      setIsCreateOpen(false)
      reloadAgencyTypes(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo loại đại lý.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly without network delay
  const openEditModal = (type: AgencyType) => {
    setFormError(null)
    setFormName(type.name)
    setFormMaxDebt(type.maxDebt)
    setEditType({ type, etag: null })
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editType) return
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên loại đại lý.')
      return
    }
    if (!formMaxDebt.trim()) {
      setFormError('Vui lòng nhập tiền nợ tối đa.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch(`/agency-types/${editType.type.id}`, {
        method: 'PUT',
        ifMatch: editType.etag || undefined,
        body: {
          name: formName.trim(),
          maxDebt: formMaxDebt.trim(),
        },
      })
      setEditType(null)
      reloadAgencyTypes(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể cập nhật loại đại lý.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Loại đại lý</h1>
          <p className="page-desc">
            Quy định phân loại đại lý và giới hạn nợ tối đa cho phép
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Thêm loại đại lý
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách loại đại lý..." />
        </div>
      ) : agencyTypes.length === 0 ? (
        <div className="card empty-card">
          <p>Chưa có loại đại lý nào trong hệ thống.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách loại đại lý">
            <thead>
              <tr>
                <th scope="col" style={{ width: '80px' }}>
                  ID
                </th>
                <th scope="col">Tên loại đại lý</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Tiền nợ tối đa
                </th>
                <th scope="col">Số đại lý</th>
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
              {agencyTypes.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono">#{t.id}</td>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(t.maxDebt)}
                  </td>
                  <td>{t.activeAgenciesCount ?? '—'}</td>
                  <td>
                    {t.status === 'ACTIVE' ? (
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
                        onClick={() => openEditModal(t)}
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
        title="Thêm loại đại lý mới"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên loại đại lý"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ví dụ: Loại 1, Loại 2..."
            required
            autoFocus
          />
          <Input
            label="Tiền nợ tối đa (VND)"
            type="number"
            value={formMaxDebt}
            onChange={(e) => setFormMaxDebt(e.target.value)}
            placeholder="50000000"
            required
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
              Tạo mới
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editType}
        onClose={() => setEditType(null)}
        title={`Chỉnh sửa: ${editType?.type.name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleEditSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên loại đại lý"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Tiền nợ tối đa (VND)"
            type="number"
            value={formMaxDebt}
            onChange={(e) => setFormMaxDebt(e.target.value)}
            required
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditType(null)}
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
