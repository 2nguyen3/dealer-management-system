import { useEffect, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EditIcon, PlusIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import type { UserGroup } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function UserGroupsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('groups.manage')

  const [groups, setGroups] = useState<UserGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<{
    group: UserGroup
    etag: string | null
  } | null>(null)

  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reloadGroups = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/user-groups')
      setIsLoading(true)
    }

    const fetcher = bypassCache
      ? apiFetch<UserGroup[] | { items: UserGroup[] }>('/user-groups')
      : cachedApiFetch<UserGroup[] | { items: UserGroup[] }>('/user-groups')

    fetcher
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setGroups(items)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách nhóm người dùng.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    cachedApiFetch<UserGroup[] | { items: UserGroup[] }>('/user-groups')
      .then((res) => {
        if (!isMounted) return
        const items = Array.isArray(res.data) ? res.data : res.data.items || []
        setGroups(items)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách nhóm người dùng.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const openCreateModal = () => {
    setFormCode('')
    setFormName('')
    setFormDesc('')
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formCode.trim()) {
      setFormError('Vui lòng nhập mã nhóm.')
      return
    }
    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên nhóm.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/user-groups', {
        method: 'POST',
        body: {
          code: formCode.trim(),
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        },
      })
      setIsCreateOpen(false)
      reloadGroups(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo nhóm người dùng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly without blocking network call
  const openEditModal = (group: UserGroup) => {
    setFormError(null)
    setFormName(group.name)
    setFormDesc(group.description || '')
    setEditGroup({ group, etag: null })
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editGroup) return
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên nhóm.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch(`/user-groups/${editGroup.group.id}`, {
        method: 'PUT',
        ifMatch: editGroup.etag || undefined,
        body: {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        },
      })
      setEditGroup(null)
      reloadGroups(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể cập nhật nhóm người dùng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhóm người dùng</h1>
          <p className="page-desc">
            Thiết lập các nhóm vai trò nhân viên và phạm vi quyền hạn trong hệ
            thống
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Tạo nhóm mới
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách nhóm..." />
        </div>
      ) : groups.length === 0 ? (
        <div className="card empty-card">
          <p>Chưa có nhóm người dùng nào.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách nhóm người dùng">
            <thead>
              <tr>
                <th scope="col" style={{ width: '80px' }}>
                  ID
                </th>
                <th scope="col">Mã nhóm</th>
                <th scope="col">Tên nhóm</th>
                <th scope="col">Mô tả</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Số người dùng
                </th>
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
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="font-mono">#{g.id}</td>
                  <td className="font-mono font-bold">{g.code}</td>
                  <td>
                    <strong>{g.name}</strong>
                  </td>
                  <td className="text-muted">{g.description || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{g.userCount ?? '—'}</td>
                  {canManage && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="icon-action-btn"
                        title="Chỉnh sửa"
                        onClick={() => openEditModal(g)}
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
        title="Tạo nhóm người dùng mới"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid-2">
            <Input
              label="Mã nhóm"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="Ví dụ: SALES, WAREHOUSE"
              required
              autoFocus
            />
            <Input
              label="Tên nhóm"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ví dụ: Nhân viên Kinh doanh"
              required
            />
          </div>
          <Input
            label="Mô tả chức năng"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Mô tả ngắn gọn quyền hạn của nhóm..."
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
              Tạo nhóm
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editGroup}
        onClose={() => setEditGroup(null)}
        title={`Chỉnh sửa nhóm: ${editGroup?.group.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên nhóm"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Mô tả chức năng"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditGroup(null)}
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
