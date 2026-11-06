import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import {
  EditIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import { formatDate, formatVND } from '../../lib/formatters'
import type { Agency, AgencyType, District } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function AgenciesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('agency.manage')

  const [districts, setDistricts] = useState<District[]>([])
  const [agencyTypes, setAgencyTypes] = useState<AgencyType[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState<
    'ACTIVE' | 'TERMINATED' | ''
  >('')
  const [pageSize, setPageSize] = useState(25)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined,
  )

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editAgency, setEditAgency] = useState<{
    agency: Agency
    etag: string | null
  } | null>(null)
  const [terminateAgency, setTerminateAgency] = useState<{
    agency: Agency
    etag: string | null
  } | null>(null)
  const [detailAgency, setDetailAgency] = useState<Agency | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formDistrictId, setFormDistrictId] = useState('')
  const [formTypeId, setFormTypeId] = useState('')
  const [formAcceptedDate, setFormAcceptedDate] = useState('')
  const [terminateReason, setTerminateReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadAgencies = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (currentCursor) params.append('cursor', currentCursor)
    params.append('limit', String(pageSize))
    if (search.trim()) params.append('q', search.trim())
    if (filterDistrict) params.append('districtId', filterDistrict)
    if (filterType) params.append('typeId', filterType)
    if (filterStatus) params.append('status', filterStatus)

    try {
      const res = await apiFetch<
        Agency[] | { items: Agency[]; pagination?: { nextCursor?: string } }
      >(`/agencies?${params.toString()}`)
      if (!isMountedRef.current) return

      if (Array.isArray(res.data)) {
        setAgencies(res.data)
        setNextCursor(null)
      } else {
        const paginated = res.data as {
          items?: Agency[]
          pagination?: { nextCursor?: string | null }
          nextCursor?: string | null
        }
        setAgencies(paginated.items || [])
        setNextCursor(
          paginated.pagination?.nextCursor ?? paginated.nextCursor ?? null,
        )
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const e = err as { message?: string }
      setError(e.message || 'Không thể tải danh sách đại lý.')
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [
    currentCursor,
    pageSize,
    search,
    filterDistrict,
    filterType,
    filterStatus,
  ])

  useEffect(() => {
    let active = true
    Promise.all([
      cachedApiFetch<District[] | { items: District[] }>('/districts'),
      cachedApiFetch<AgencyType[] | { items: AgencyType[] }>('/agency-types'),
    ])
      .then(([dRes, tRes]) => {
        if (!active) return
        const dItems = Array.isArray(dRes.data)
          ? dRes.data
          : (dRes.data as { items?: District[] }).items || []
        const tItems = Array.isArray(tRes.data)
          ? tRes.data
          : (tRes.data as { items?: AgencyType[] }).items || []
        setDistricts(dItems)
        setAgencyTypes(tItems)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAgencies()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadAgencies])

  const filteredAgencies = useMemo(() => {
    return agencies.filter((agency) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const match =
          agency.name.toLowerCase().includes(q) ||
          agency.code.toLowerCase().includes(q) ||
          (agency.phone && agency.phone.includes(q))
        if (!match) return false
      }
      if (filterDistrict && String(agency.districtId) !== filterDistrict) {
        return false
      }
      if (
        filterType &&
        String(agency.typeId ?? agency.agencyTypeId) !== filterType
      ) {
        return false
      }
      if (filterStatus && agency.status !== filterStatus) {
        return false
      }
      return true
    })
  }, [agencies, search, filterDistrict, filterType, filterStatus])

  const handleNextPage = () => {
    if (!nextCursor) return
    setCursorHistory((prev) => [...prev, currentCursor || ''])
    setCurrentCursor(nextCursor)
  }

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return
    const prevHistory = [...cursorHistory]
    const lastCursor = prevHistory.pop()
    setCursorHistory(prevHistory)
    setCurrentCursor(lastCursor || undefined)
  }

  const openCreateModal = () => {
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormAddress('')
    setFormDistrictId(districts[0] ? String(districts[0].id) : '')
    setFormTypeId(agencyTypes[0] ? String(agencyTypes[0].id) : '')
    setFormAcceptedDate(new Date().toISOString().slice(0, 10))
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên đại lý.')
      return
    }
    if (!formPhone.trim()) {
      setFormError('Vui lòng nhập số điện thoại.')
      return
    }
    if (!formDistrictId) {
      setFormError('Vui lòng chọn quận.')
      return
    }
    if (!formTypeId) {
      setFormError('Vui lòng chọn loại đại lý.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/agencies', {
        method: 'POST',
        body: {
          name: formName.trim(),
          typeId: Number(formTypeId),
          districtId: Number(formDistrictId),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          email: formEmail.trim() || null,
          acceptedDate:
            formAcceptedDate || new Date().toISOString().slice(0, 10),
        },
      })
      setIsCreateOpen(false)
      setSuccessNotice('Đã tiếp nhận đại lý mới thành công.')
      invalidateCache('/agencies')
      void loadAgencies()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || 'Không thể tạo hồ sơ đại lý.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditModal = async (agencyItem: Agency) => {
    setFormError(null)
    setFormName(agencyItem.name)
    setFormPhone(agencyItem.phone || '')
    setFormEmail(agencyItem.email || '')
    setFormAddress(agencyItem.address || '')
    setFormDistrictId(String(agencyItem.districtId))
    setFormTypeId(String(agencyItem.typeId ?? agencyItem.agencyTypeId ?? ''))
    setEditAgency({ agency: agencyItem, etag: null })

    // Fetch fresh agency details to obtain authoritative ETag
    try {
      const res = await apiFetch<Agency>(`/agencies/${agencyItem.id}`)
      if (!isMountedRef.current) return
      setEditAgency({ agency: res.data, etag: res.etag })
      setFormName(res.data.name)
      setFormPhone(res.data.phone || '')
      setFormEmail(res.data.email || '')
      setFormAddress(res.data.address || '')
      setFormDistrictId(String(res.data.districtId))
      setFormTypeId(String(res.data.typeId ?? res.data.agencyTypeId ?? ''))
    } catch {
      // If fetching fails, keep the in-memory values and wait for submission
    }
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editAgency) return
    setFormError(null)

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên đại lý.')
      return
    }
    if (!formPhone.trim()) {
      setFormError('Vui lòng nhập số điện thoại.')
      return
    }
    if (!formDistrictId) {
      setFormError('Vui lòng chọn quận.')
      return
    }
    if (!formTypeId) {
      setFormError('Vui lòng chọn loại đại lý.')
      return
    }

    setIsSubmitting(true)
    try {
      let currentEtag = editAgency.etag
      if (!currentEtag) {
        const fresh = await apiFetch<Agency>(
          `/agencies/${editAgency.agency.id}`,
        )
        currentEtag = fresh.etag
      }
      if (!currentEtag) {
        setFormError('Máy chủ chưa cấp ETag. Vui lòng tải lại.')
        return
      }

      // Must use PATCH, must pass ETag in If-Match header, and field name must be typeId
      await apiFetch(`/agencies/${editAgency.agency.id}`, {
        method: 'PATCH',
        ifMatch: currentEtag,
        body: {
          name: formName.trim(),
          typeId: Number(formTypeId),
          districtId: Number(formDistrictId),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          email: formEmail.trim() || null,
        },
      })
      setEditAgency(null)
      setSuccessNotice('Đã cập nhật hồ sơ đại lý thành công.')
      invalidateCache('/agencies')
      void loadAgencies()
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 412) {
        setFormError(
          'Dữ liệu đại lý đã bị thay đổi bởi người dùng khác. Vui lòng đóng và mở lại để tải dữ liệu mới.',
        )
      } else if (e.status === 409) {
        setFormError(
          e.message ||
            'Xung đột dữ liệu: Hạn mức nợ mới thấp hơn dư nợ hiện tại hoặc quận đã hết chỗ.',
        )
      } else {
        setFormError(e.message || 'Không thể cập nhật thông tin đại lý.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const openTerminateModal = async (agencyItem: Agency) => {
    setFormError(null)
    setTerminateReason('')
    setTerminateAgency({ agency: agencyItem, etag: null })

    try {
      const res = await apiFetch<Agency>(`/agencies/${agencyItem.id}`)
      if (!isMountedRef.current) return
      setTerminateAgency({ agency: res.data, etag: res.etag })
    } catch {
      // Keep in-memory
    }
  }

  const handleTerminateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!terminateAgency) return
    setFormError(null)

    if (!terminateReason.trim()) {
      setFormError('Vui lòng nhập lý do ngừng hợp tác.')
      return
    }

    setIsSubmitting(true)
    try {
      let currentEtag = terminateAgency.etag
      if (!currentEtag) {
        const fresh = await apiFetch<Agency>(
          `/agencies/${terminateAgency.agency.id}`,
        )
        currentEtag = fresh.etag
      }
      if (!currentEtag) {
        setFormError('Máy chủ chưa cấp ETag. Vui lòng tải lại.')
        return
      }

      await apiFetch(`/agencies/${terminateAgency.agency.id}/terminate`, {
        method: 'POST',
        ifMatch: currentEtag,
        idempotencyKey: crypto.randomUUID(),
        body: {
          reason: terminateReason.trim(),
        },
      })
      setTerminateAgency(null)
      setSuccessNotice('Đã ngừng hợp tác với đại lý thành công.')
      invalidateCache('/agencies')
      void loadAgencies()
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 412) {
        setFormError(
          'Hồ sơ đại lý đã bị thay đổi bởi người dùng khác. Vui lòng tải lại.',
        )
      } else {
        setFormError(e.message || 'Không thể ngừng hợp tác với đại lý này.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ sơ đại lý</h1>
          <p className="page-desc">
            Quản lý thông tin tiếp nhận đại lý, phân loại, quận và theo dõi dư
            nợ
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<PlusIcon size={18} />}
          >
            Tiếp nhận đại lý mới
          </Button>
        )}
      </div>

      {successNotice && <Alert type="success">{successNotice}</Alert>}

      {error && <Alert type="error">{error}</Alert>}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-search">
          <Input
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            endAdornment={<SearchIcon size={18} />}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterDistrict}
            onChange={(e) => setFilterDistrict(e.target.value)}
            options={[
              { value: '', label: 'Tất cả quận' },
              ...districts.map((d) => ({ value: String(d.id), label: d.name })),
            ]}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={[
              { value: '', label: 'Tất cả loại đại lý' },
              ...agencyTypes.map((t) => ({
                value: String(t.id),
                label: t.name,
              })),
            ]}
          />
        </div>

        <div className="filter-select">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as never)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE', label: 'Đang hoạt động' },
              { value: 'TERMINATED', label: 'Ngừng hợp tác' },
            ]}
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => void loadAgencies()}
        >
          Tải lại
        </Button>
      </div>

      {/* Data Table */}
      {isLoading && agencies.length === 0 ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách đại lý..." />
        </div>
      ) : filteredAgencies.length === 0 ? (
        <div className="card empty-card">
          <p>Không tìm thấy đại lý nào phù hợp với điều kiện tìm kiếm.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách đại lý">
            <thead>
              <tr>
                <th scope="col">Mã đại lý</th>
                <th scope="col">Tên đại lý</th>
                <th scope="col">Điện thoại</th>
                <th scope="col">Quận</th>
                <th scope="col">Loại</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Dư nợ
                </th>
                <th scope="col">Ngày tiếp nhận</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAgencies.map((agency) => (
                <tr key={agency.id}>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setDetailAgency(agency)}
                    >
                      {agency.code}
                    </button>
                  </td>
                  <td>
                    <strong>{agency.name}</strong>
                    {agency.address && (
                      <div className="cell-subtext">{agency.address}</div>
                    )}
                  </td>
                  <td>{agency.phone || '—'}</td>
                  <td>{agency.districtName || `Quận ${agency.districtId}`}</td>
                  <td>
                    {agency.typeName ||
                      agency.agencyTypeName ||
                      `Loại ${agency.typeId ?? agency.agencyTypeId}`}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(agency.currentDebt)}
                  </td>
                  <td>
                    {formatDate(agency.acceptedDate || agency.receptionDate)}
                  </td>
                  <td>
                    {agency.status === 'ACTIVE' ? (
                      <Badge variant="success">Đang hoạt động</Badge>
                    ) : (
                      <Badge variant="danger">Ngừng hợp tác</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="action-buttons-cell">
                      {canManage && agency.status === 'ACTIVE' && (
                        <>
                          <button
                            type="button"
                            className="icon-action-btn"
                            title="Sửa hồ sơ"
                            aria-label={`Sửa hồ sơ ${agency.code} - ${agency.name}`}
                            onClick={() => void openEditModal(agency)}
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-btn icon-action-btn--danger"
                            title="Ngừng hợp tác"
                            aria-label={`Ngừng hợp tác ${agency.code} - ${agency.name}`}
                            onClick={() => void openTerminateModal(agency)}
                          >
                            <TrashIcon size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination
            onNext={handleNextPage}
            onPrevious={handlePrevPage}
            hasNext={!!nextCursor}
            hasPrevious={cursorHistory.length > 0}
            isLoading={isLoading}
            limit={pageSize}
            onLimitChange={(newLimit) => {
              setPageSize(newLimit)
              setCurrentCursor(undefined)
              setCursorHistory([])
            }}
            totalShowing={filteredAgencies.length}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tiếp nhận đại lý mới"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên đại lý"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ví dụ: Đại lý Minh Phát"
            required
            autoFocus
          />
          <div className="grid-2">
            <Input
              label="Số điện thoại"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="Ví dụ: 0901234567"
              required
            />
            <Input
              label="Email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="daily@example.com"
            />
          </div>
          <Input
            label="Địa chỉ"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            placeholder="Số nhà, tên đường..."
          />
          <div className="grid-2">
            <Select
              label="Quận"
              value={formDistrictId}
              onChange={(e) => setFormDistrictId(e.target.value)}
              options={districts.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
              required
            />
            <Select
              label="Loại đại lý"
              value={formTypeId}
              onChange={(e) => setFormTypeId(e.target.value)}
              options={agencyTypes.map((t) => ({
                value: String(t.id),
                label: `${t.name} (Hạn mức: ${formatVND(t.maxDebt)})`,
              }))}
              required
            />
          </div>
          <Input
            label="Ngày tiếp nhận"
            type="date"
            value={formAcceptedDate}
            onChange={(e) => setFormAcceptedDate(e.target.value)}
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
              Tiếp nhận
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editAgency}
        onClose={() => setEditAgency(null)}
        title={`Chỉnh sửa hồ sơ: ${editAgency?.agency.code || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="modal-form" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input
            label="Tên đại lý"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
          <div className="grid-2">
            <Input
              label="Số điện thoại"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
          </div>
          <Input
            label="Địa chỉ"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
          />
          <div className="grid-2">
            <Select
              label="Quận"
              value={formDistrictId}
              onChange={(e) => setFormDistrictId(e.target.value)}
              options={districts.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
              required
            />
            <Select
              label="Loại đại lý"
              value={formTypeId}
              onChange={(e) => setFormTypeId(e.target.value)}
              options={agencyTypes.map((t) => ({
                value: String(t.id),
                label: `${t.name} (Hạn mức: ${formatVND(t.maxDebt)})`,
              }))}
              required
            />
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditAgency(null)}
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

      {/* Terminate Modal */}
      <Modal
        isOpen={!!terminateAgency}
        onClose={() => setTerminateAgency(null)}
        title={`Ngừng hợp tác đại lý: ${terminateAgency?.agency.name || ''}`}
        maxWidth="sm"
      >
        <form
          onSubmit={handleTerminateSubmit}
          className="modal-form"
          noValidate
        >
          {formError && <Alert type="error">{formError}</Alert>}
          <p className="modal-warning-text">
            Lưu ý: Sau khi ngừng hợp tác, đại lý sẽ không thể tiếp tục nhận
            hàng. Hành động này không thể hoàn tác trực tiếp.
          </p>
          <Input
            label="Lý do ngừng hợp tác"
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Nhập lý do cụ thể..."
            required
            autoFocus
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTerminateAgency(null)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" variant="danger" isLoading={isSubmitting}>
              Xác nhận ngừng hợp tác
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailAgency}
        onClose={() => setDetailAgency(null)}
        title={`Chi tiết đại lý: ${detailAgency?.name || ''}`}
        maxWidth="md"
      >
        {detailAgency && (
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Mã đại lý:</span>
              <span className="detail-value font-mono">
                {detailAgency.code}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Tên đại lý:</span>
              <span className="detail-value font-bold">
                {detailAgency.name}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Điện thoại:</span>
              <span className="detail-value">{detailAgency.phone || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{detailAgency.email || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Địa chỉ:</span>
              <span className="detail-value">
                {detailAgency.address || '—'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Quận:</span>
              <span className="detail-value">
                {detailAgency.districtName || `Quận ${detailAgency.districtId}`}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Loại đại lý:</span>
              <span className="detail-value">
                {detailAgency.typeName ||
                  detailAgency.agencyTypeName ||
                  `Loại ${detailAgency.typeId ?? detailAgency.agencyTypeId}`}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Ngày tiếp nhận:</span>
              <span className="detail-value">
                {formatDate(
                  detailAgency.acceptedDate || detailAgency.receptionDate,
                )}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Dư nợ hiện tại:</span>
              <span className="detail-value font-bold text-danger">
                {formatVND(detailAgency.currentDebt)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Dư có hiện tại:</span>
              <span className="detail-value font-bold text-success">
                {formatVND(detailAgency.currentCredit)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Trạng thái:</span>
              <span className="detail-value">
                {detailAgency.status === 'ACTIVE' ? (
                  <Badge variant="success">Đang hoạt động</Badge>
                ) : (
                  <Badge variant="danger">Ngừng hợp tác</Badge>
                )}
              </span>
            </div>
            {detailAgency.terminationReason && (
              <div className="detail-item detail-item--full">
                <span className="detail-label">Lý do ngừng hợp tác:</span>
                <span className="detail-value text-muted">
                  {detailAgency.terminationReason}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
