import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import {
  EditIcon,
  KeyIcon,
  PlusIcon,
  SearchIcon,
} from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import { formatDateTime } from '../../lib/formatters'
import type { AppUser, UserGroup } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function UsersPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('users.manage')

  const [users, setUsers] = useState<AppUser[]>([])
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters (client-side in-memory)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<{
    user: AppUser
    etag: string | null
  } | null>(null)
  const [resetPwdUser, setResetPwdUser] = useState<{
    user: AppUser
    etag: string | null
  } | null>(null)

  // Form states
  const [formFullName, setFormFullName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formGroupId, setFormGroupId] = useState('')
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'LOCKED'>('ACTIVE')
  const [newPassword, setNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/users')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<UserGroup[] | { items: UserGroup[] }>('/user-groups'),
      bypassCache
        ? apiFetch<AppUser[] | { items: AppUser[] }>('/users')
        : cachedApiFetch<AppUser[] | { items: AppUser[] }>('/users'),
    ])
      .then(([gRes, uRes]) => {
        setGroups(Array.isArray(gRes.data) ? gRes.data : gRes.data.items || [])
        setUsers(Array.isArray(uRes.data) ? uRes.data : uRes.data.items || [])
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách tài khoản người dùng.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<UserGroup[] | { items: UserGroup[] }>('/user-groups'),
      cachedApiFetch<AppUser[] | { items: AppUser[] }>('/users'),
    ])
      .then(([gRes, uRes]) => {
        if (!isMounted) return
        setGroups(Array.isArray(gRes.data) ? gRes.data : gRes.data.items || [])
        setUsers(Array.isArray(uRes.data) ? uRes.data : uRes.data.items || [])
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách tài khoản người dùng.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Fast in-memory filtering (0ms latency, zero API calls on search/filter)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (search.trim()) {
        const query = search.trim().toLowerCase()
        const match =
          u.fullName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
        if (!match) return false
      }
      if (filterGroup && String(u.groupId) !== filterGroup) {
        return false
      }
      if (filterStatus && u.status !== filterStatus) {
        return false
      }
      return true
    })
  }, [users, search, filterGroup, filterStatus])

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, page, pageSize])

  const openCreateModal = () => {
    setFormFullName('')
    setFormEmail('')
    setFormPassword('')
    setFormGroupId(groups[0] ? String(groups[0].id) : '')
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formFullName.trim()) {
      setFormError('Vui lòng nhập họ và tên.')
      return
    }
    if (!formEmail.trim()) {
      setFormError('Vui lòng nhập email.')
      return
    }
    if (!formPassword) {
      setFormError('Vui lòng nhập mật khẩu.')
      return
    }
    if (!formGroupId) {
      setFormError('Vui lòng chọn nhóm người dùng.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: {
          fullName: formFullName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          groupId: Number(formGroupId),
        },
      })
      setIsCreateOpen(false)
      setSuccessNotice('Đã tạo tài khoản thành công.')
      invalidateCache('/users')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo tài khoản.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly without blocking network call
  const openEditModal = (u: AppUser) => {
    setFormError(null)
    setFormFullName(u.fullName)
    setFormGroupId(String(u.groupId))
    setFormStatus(u.status)
    setEditUser({ user: u, etag: null })
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setFormError(null)

    if (!formFullName.trim()) {
      setFormError('Vui lòng nhập họ và tên.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch(`/users/${editUser.user.id}`, {
        method: 'PUT',
        ifMatch: editUser.etag || undefined,
        body: {
          fullName: formFullName.trim(),
          groupId: Number(formGroupId),
          status: formStatus,
        },
      })
      setEditUser(null)
      setSuccessNotice('Đã cập nhật thông tin tài khoản.')
      invalidateCache('/users')
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể cập nhật tài khoản.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Opens instantly without blocking network call
  const openResetModal = (u: AppUser) => {
    setFormError(null)
    setNewPassword('')
    setResetPwdUser({ user: u, etag: null })
  }

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!resetPwdUser) return
    setFormError(null)

    if (!newPassword) {
      setFormError('Vui lòng nhập mật khẩu mới.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch(`/users/${resetPwdUser.user.id}/password-reset`, {
        method: 'POST',
        ifMatch: resetPwdUser.etag || undefined,
        body: { newPassword },
      })
      setResetPwdUser(null)
      setSuccessNotice(
        `Đã đặt lại mật khẩu cho tài khoản ${resetPwdUser.user.email}.`,
      )
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể đặt lại mật khẩu.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý tài khoản</h1>
          <p className="page-desc">
            Danh sách nhân viên, tài khoản phân quyền và trạng thái hoạt động
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Tạo tài khoản mới
          </Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successNotice && <Alert type="success">{successNotice}</Alert>}

      <div className="filter-bar">
        <div className="filter-search">
          <Input
            placeholder="Tìm theo họ tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            endAdornment={<SearchIcon size={18} />}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            options={[
              { value: '', label: 'Tất cả nhóm người dùng' },
              ...groups.map((g) => ({ value: String(g.id), label: g.name })),
            ]}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE', label: 'Hoạt động' },
              { value: 'LOCKED', label: 'Bị khóa' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách tài khoản..." />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card empty-card">
          <p>Không tìm thấy tài khoản nào phù hợp.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách tài khoản">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Họ và tên</th>
                <th scope="col">Email</th>
                <th scope="col">Nhóm quyền</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Ngày tạo</th>
                {canManage && (
                  <th scope="col" style={{ textAlign: 'center' }}>
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono">#{u.id}</td>
                  <td>
                    <strong>{u.fullName}</strong>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <Badge variant="info">
                      {u.groupName || u.groupCode || `Nhóm #${u.groupId}`}
                    </Badge>
                  </td>
                  <td>
                    {u.status === 'ACTIVE' ? (
                      <Badge variant="success">Hoạt động</Badge>
                    ) : (
                      <Badge variant="danger">Bị khóa</Badge>
                    )}
                  </td>
                  <td className="text-muted">{formatDateTime(u.createdAt)}</td>
                  {canManage && (
                    <td style={{ textAlign: 'center' }}>
                      <div className="action-buttons-cell">
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Sửa tài khoản"
                          onClick={() => openEditModal(u)}
                        >
                          <EditIcon size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Đặt lại mật khẩu"
                          onClick={() => openResetModal(u)}
                        >
                          <KeyIcon size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination
            onNext={() => setPage((p) => p + 1)}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            hasNext={page * pageSize < filteredUsers.length}
            hasPrevious={page > 1}
            limit={pageSize}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit)
              setPage(1)
            }}
            totalShowing={filteredUsers.length}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo tài khoản người dùng"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Họ và tên"
            value={formFullName}
            onChange={(e) => setFormFullName(e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn An"
            required
            autoFocus
          />
          <div className="grid-2">
            <Input
              label="Email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="nhanvien@agentra.vn"
              required
            />
            <Input
              label="Mật khẩu khởi tạo"
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
            />
          </div>
          <Select
            label="Nhóm người dùng"
            value={formGroupId}
            onChange={(e) => setFormGroupId(e.target.value)}
            options={groups.map((g) => ({
              value: String(g.id),
              label: g.name,
            }))}
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
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title={`Chỉnh sửa tài khoản: ${editUser?.user.email}`}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Họ và tên"
            value={formFullName}
            onChange={(e) => setFormFullName(e.target.value)}
            required
            autoFocus
          />
          <div className="grid-2">
            <Select
              label="Nhóm người dùng"
              value={formGroupId}
              onChange={(e) => setFormGroupId(e.target.value)}
              options={groups.map((g) => ({
                value: String(g.id),
                label: g.name,
              }))}
              required
            />
            <Select
              label="Trạng thái tài khoản"
              value={formStatus}
              onChange={(e) =>
                setFormStatus(e.target.value as 'ACTIVE' | 'LOCKED')
              }
              options={[
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'LOCKED', label: 'Khóa tài khoản' },
              ]}
              required
            />
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditUser(null)}
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

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPwdUser}
        onClose={() => setResetPwdUser(null)}
        title={`Đặt lại mật khẩu: ${resetPwdUser?.user.email}`}
        maxWidth="sm"
      >
        <form onSubmit={handleResetSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <p className="modal-warning-text">
            Mật khẩu mới sẽ được thiết lập trực tiếp cho tài khoản này và mọi
            phiên làm việc hiện tại của họ sẽ bị chấm dứt.
          </p>
          <Input
            label="Mật khẩu mới"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetPwdUser(null)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Xác nhận đổi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
