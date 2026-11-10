import {
  Ban,
  CircleDashed,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Store,
  Tags,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { DateField } from '../../components/blocks/DateField'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Button as ShadcnButton } from '../../components/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/shadcn/dropdown-menu'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import { formatDate, formatVND } from '../../lib/formatters'
import type { Agency, AgencyType, District } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'
import {
  DetailGrid,
  ListCard,
  ResultCount,
  SearchField,
  TableSkeleton,
  type DetailEntry,
} from '../districts/listParts'

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

  const typeLabel = (agency: Agency) =>
    agency.typeName ||
    agency.agencyTypeName ||
    `Loại ${agency.typeId ?? agency.agencyTypeId}`
  const statusBadge = (status: string) =>
    status === 'ACTIVE' ? (
      <Badge variant="success" data-status={status}>
        Đang hoạt động
      </Badge>
    ) : (
      <Badge variant="danger" data-status={status}>
        Ngừng hợp tác
      </Badge>
    )
  const districtOptions = districts.map((d) => ({
    value: String(d.id),
    label: d.name,
  }))
  const typeOptions = agencyTypes.map((t) => ({
    value: String(t.id),
    label: `${t.name} (Hạn mức: ${formatVND(t.maxDebt)})`,
  }))
  const kpis = agencyKpis(districts, agencyTypes)
  const contactFields = (
    <>
      <Input
        id="agency-form-phone"
        label="Số điện thoại"
        value={formPhone}
        onChange={(e) => setFormPhone(e.target.value)}
        placeholder="Ví dụ: 0901234567"
        inputMode="tel"
        required
      />
      <Input
        id="agency-form-email"
        label="Email"
        type="email"
        value={formEmail}
        onChange={(e) => setFormEmail(e.target.value)}
        placeholder="daily@example.com"
      />
      <div className="sm:col-span-2">
        <Input
          id="agency-form-address"
          label="Địa chỉ"
          value={formAddress}
          onChange={(e) => setFormAddress(e.target.value)}
          placeholder="Số nhà, tên đường..."
        />
      </div>
      <Select
        id="agency-form-district"
        label="Quận"
        value={formDistrictId}
        onChange={(e) => setFormDistrictId(e.target.value)}
        options={districtOptions}
        required
      />
      <Select
        id="agency-form-type"
        label="Loại đại lý"
        value={formTypeId}
        onChange={(e) => setFormTypeId(e.target.value)}
        options={typeOptions}
        required
      />
    </>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Hồ sơ đại lý"
        description="Quản lý thông tin tiếp nhận đại lý, phân loại, quận và theo dõi dư nợ"
        actions={
          canManage && (
            <Button
              variant="primary"
              onClick={openCreateModal}
              icon={<Plus className="size-4" />}
            >
              Tiếp nhận đại lý mới
            </Button>
          )
        }
      />

      {kpis.length > 0 && (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          aria-label="Tổng quan đại lý"
        >
          {kpis.map((kpi) => (
            <li
              key={kpi.label}
              className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <kpi.icon className="size-4" />
              </span>
              <span className="grid min-w-0">
                <span className="truncate text-xs text-muted-foreground">
                  {kpi.label}
                </span>
                <span className="text-lg leading-tight font-semibold tabular-nums">
                  {kpi.value}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {(successNotice || error) && (
        <div className="space-y-3">
          {successNotice && <Alert type="success">{successNotice}</Alert>}
          {error && <Alert type="error">{error}</Alert>}
        </div>
      )}

      <ListCard
        toolbar={
          <>
            <SearchField
              id="agency-filter-search"
              value={search}
              onChange={setSearch}
              placeholder="Tìm theo tên hoặc số điện thoại..."
            />
            <div className="lg:w-44">
              <Select
                id="agency-filter-district"
                label="Quận"
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                options={[
                  { value: '', label: 'Tất cả quận' },
                  ...districtOptions,
                ]}
              />
            </div>
            <div className="lg:w-48">
              <Select
                id="agency-filter-type"
                label="Loại đại lý"
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
            <div className="lg:w-44">
              <Select
                id="agency-filter-status"
                label="Trạng thái"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as never)}
                options={[
                  { value: '', label: 'Tất cả trạng thái' },
                  { value: 'ACTIVE', label: 'Đang hoạt động' },
                  { value: 'TERMINATED', label: 'Ngừng hợp tác' },
                ]}
              />
            </div>
            <ResultCount
              count={filteredAgencies.length}
              loading={isLoading && agencies.length === 0}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadAgencies()}
              icon={<RefreshCw className="size-4" />}
            >
              Tải lại
            </Button>
          </>
        }
        footer={
          filteredAgencies.length > 0 && (
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
            />
          )
        }
      >
        {isLoading && agencies.length === 0 ? (
          <TableSkeleton columns={8} label="Đang tải danh sách đại lý..." />
        ) : filteredAgencies.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Store className="size-6" />}
              title="Không tìm thấy đại lý"
              description="Không tìm thấy đại lý nào phù hợp với điều kiện tìm kiếm."
            />
          </div>
        ) : (
          <Table caption="Danh sách đại lý" aria-busy={isLoading || undefined}>
            <thead>
              <tr>
                <th scope="col">Mã đại lý</th>
                <th scope="col">Tên đại lý</th>
                <th scope="col">Điện thoại</th>
                <th scope="col">Quận</th>
                <th scope="col">Loại</th>
                <th scope="col" className="cell-number text-right">
                  Dư nợ
                </th>
                <th scope="col">Ngày tiếp nhận</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="cell-actions w-14 text-right">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAgencies.map((agency) => (
                <tr key={agency.id}>
                  <td>
                    <button
                      type="button"
                      className="cursor-pointer rounded-sm font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => setDetailAgency(agency)}
                    >
                      {agency.code}
                    </button>
                  </td>
                  <td className="max-w-64">
                    <div className="truncate font-medium text-foreground">
                      {agency.name}
                    </div>
                    {agency.address && (
                      <div className="truncate text-xs text-muted-foreground">
                        {agency.address}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {agency.phone || '—'}
                  </td>
                  <td className="whitespace-nowrap">
                    {agency.districtName || `Quận ${agency.districtId}`}
                  </td>
                  <td className="whitespace-nowrap">{typeLabel(agency)}</td>
                  <td className="cell-number text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatVND(agency.currentDebt)}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {formatDate(agency.acceptedDate || agency.receptionDate)}
                  </td>
                  <td>{statusBadge(agency.status)}</td>
                  <td className="cell-actions text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ShadcnButton
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer text-muted-foreground"
                          aria-label={`Thao tác ${agency.code} - ${agency.name}`}
                        >
                          <MoreHorizontal
                            className="size-4"
                            aria-hidden="true"
                          />
                        </ShadcnButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onSelect={() => setDetailAgency(agency)}
                        >
                          <Eye aria-hidden="true" />
                          Xem chi tiết
                        </DropdownMenuItem>
                        {canManage && agency.status === 'ACTIVE' && (
                          <>
                            <DropdownMenuItem
                              onSelect={() => void openEditModal(agency)}
                            >
                              <Pencil aria-hidden="true" />
                              Sửa hồ sơ
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => void openTerminateModal(agency)}
                            >
                              <Ban aria-hidden="true" />
                              Ngừng hợp tác
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </ListCard>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tiếp nhận đại lý mới"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="agency-form-name"
              label="Tên đại lý"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ví dụ: Đại lý Minh Phát"
              required
              autoFocus
            />
            <DateField
              id="agency-form-accepted-date"
              label="Ngày tiếp nhận"
              value={formAcceptedDate}
              onChange={setFormAcceptedDate}
              required
            />
            {contactFields}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
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
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                id="agency-form-name"
                label="Tên đại lý"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>
            {contactFields}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
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
        maxWidth="md"
      >
        <form onSubmit={handleTerminateSubmit} className="space-y-4" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Alert type="warning">
            Sau khi ngừng hợp tác, đại lý sẽ không thể tiếp tục nhận hàng. Hành
            động này không thể hoàn tác trực tiếp.
          </Alert>
          <Input
            id="agency-terminate-reason"
            label="Lý do ngừng hợp tác"
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Nhập lý do cụ thể..."
            required
            autoFocus
          />
          <div className="flex flex-wrap justify-end gap-2">
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
        maxWidth="lg"
      >
        {detailAgency && (
          <DetailGrid
            entries={[
              [
                'Mã đại lý',
                <span key="code" className="font-mono">
                  {detailAgency.code}
                </span>,
              ],
              [
                'Tên đại lý',
                <span key="name" className="font-semibold">
                  {detailAgency.name}
                </span>,
              ],
              ['Điện thoại', detailAgency.phone || '—'],
              ['Email', detailAgency.email || '—'],
              ['Địa chỉ', detailAgency.address || '—', true],
              [
                'Quận',
                detailAgency.districtName || `Quận ${detailAgency.districtId}`,
              ],
              ['Loại đại lý', typeLabel(detailAgency)],
              [
                'Ngày tiếp nhận',
                formatDate(
                  detailAgency.acceptedDate || detailAgency.receptionDate,
                ),
              ],
              ['Trạng thái', statusBadge(detailAgency.status)],
              [
                'Dư nợ hiện tại',
                <span
                  key="debt"
                  className="font-semibold text-destructive tabular-nums"
                >
                  {formatVND(detailAgency.currentDebt)}
                </span>,
              ],
              [
                'Dư có hiện tại',
                <span
                  key="credit"
                  className="font-semibold text-success tabular-nums"
                >
                  {formatVND(detailAgency.currentCredit)}
                </span>,
              ],
              ...(detailAgency.terminationReason
                ? ([
                    [
                      'Lý do ngừng hợp tác',
                      detailAgency.terminationReason,
                      true,
                    ],
                  ] as DetailEntry[])
                : []),
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

/** Count of a numeric field summed over rows; null when any row lacks it. */
function sumField(rows: object[], keys: string[]): number | null {
  if (!rows.length) return null
  let total = 0
  for (const row of rows) {
    const record = row as Record<string, unknown>
    const raw = keys.map((key) => record[key]).find((v) => v !== undefined)
    const value = typeof raw === 'string' ? Number(raw) : raw
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    total += value
  }
  return total
}

/** Overview chips derived from the already-loaded district/type catalogues. */
function agencyKpis(districts: District[], agencyTypes: AgencyType[]) {
  const number = new Intl.NumberFormat('vi-VN')
  const active = sumField(districts, [
    'activeAgencyCount',
    'activeAgenciesCount',
  ])
  const remaining = sumField(districts, ['remainingSlots'])
  const items: { label: string; value: string; icon: typeof Store }[] = []
  if (active !== null)
    items.push({
      label: 'Đại lý đang hoạt động',
      value: number.format(active),
      icon: Store,
    })
  if (districts.length)
    items.push({
      label: 'Quận',
      value: number.format(districts.length),
      icon: MapPin,
    })
  if (agencyTypes.length)
    items.push({
      label: 'Loại đại lý',
      value: number.format(agencyTypes.length),
      icon: Tags,
    })
  if (remaining !== null)
    items.push({
      label: 'Chỗ còn nhận',
      value: number.format(remaining),
      icon: CircleDashed,
    })
  return items
}
