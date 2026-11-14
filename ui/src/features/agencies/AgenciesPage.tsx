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
import { notifyNextStep } from '../../components/guide/notifyNextStep'
import { t } from '../../lib/i18n/core'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { DateField } from '../../components/blocks/DateField'
import { KpiCard } from '../../components/blocks/KpiCard'
import { PageHeader } from '../../components/blocks/PageHeader'
import { RoundedBarChart } from '../../components/charts/MebiusCharts'
import { SortableHeader, SortMenu } from '../../components/data/SortControls'
import { useSort } from '../../components/data/sorting'
import { CountUp, Stagger, StaggerItem } from '../../components/motion/Motion'
import { Button as ShadcnButton } from '../../components/shadcn/button'
import { Progress } from '../../components/shadcn/progress'
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
import type { Agency, AgencyType, Ward } from '../../lib/types'
import { formatCompactVND, formatPercent, formatPlain } from '../../lib/chart'
import { cn } from '../../lib/utils'
import { useAuth } from '../authentication/useAuth'
import { WardPicker } from '../wards/WardPicker'
import { listAllWards } from '../wards/wardsApi'
import {
  DetailGrid,
  FilterReset,
  InfoHint,
  ListCard,
  ResultCount,
  SearchField,
  TableSkeleton,
  ToggleFilter,
  type DetailEntry,
} from '../master_data/listParts'
import { num, partsBy, ratioOf, sumBy } from '../master_data/summaryData'
import {
  ChartTile,
  DonutTile,
  MeterTile,
  MiniTable,
  SummaryGrid,
} from '../master_data/summaryParts'

/** Contract sort fields of GET /agencies (prefix "-" = descending). */
const AGENCY_SORTS = [
  { field: 'name', label: t('Tên đại lý') },
  { field: 'debt', label: t('Nợ hiện tại') },
  { field: 'acceptedDate', label: t('Ngày tiếp nhận') },
  { field: 'id', label: t('Thứ tự tạo') },
] as const

export function AgenciesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('agency.manage')

  const [agencyTypes, setAgencyTypes] = useState<AgencyType[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterWard, setFilterWard] = useState('')
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
  const sort = useSort()
  /** A new filter or order starts again from the first page. */
  const restart = () => {
    setCurrentCursor(undefined)
    setCursorHistory([])
  }
  const activeFilters = [
    search.trim(),
    filterWard,
    filterType,
    filterStatus,
  ].filter(Boolean).length

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
  const [formWardId, setFormWardId] = useState('')
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
    if (filterWard) params.append('wardId', filterWard)
    if (filterType) params.append('typeId', filterType)
    if (filterStatus) params.append('status', filterStatus)
    if (sort.sort) params.append('sort', sort.sort)

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
      setError(e.message || t('Không thể tải danh sách đại lý.'))
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [
    currentCursor,
    pageSize,
    search,
    filterWard,
    filterType,
    filterStatus,
    sort.sort,
  ])

  useEffect(() => {
    let active = true
    cachedApiFetch<AgencyType[] | { items: AgencyType[] }>('/agency-types')
      .then((tRes) => {
        if (!active) return
        const tItems = Array.isArray(tRes.data)
          ? tRes.data
          : (tRes.data as { items?: AgencyType[] }).items || []
        setAgencyTypes(tItems)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Ward capacity feeds the overview tiles; refreshed after each mutation notice.
  useEffect(() => {
    const controller = new AbortController()
    listAllWards(controller.signal)
      .then(setWards)
      .catch(() => {})
    return () => controller.abort()
  }, [successNotice])

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
      if (filterWard && String(agency.wardId) !== filterWard) {
        return false
      }
      if (filterType && String(agency.typeId) !== filterType) {
        return false
      }
      if (filterStatus && agency.status !== filterStatus) {
        return false
      }
      return true
    })
  }, [agencies, search, filterWard, filterType, filterStatus])

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
    setFormWardId('')
    setFormTypeId(agencyTypes[0] ? String(agencyTypes[0].id) : '')
    setFormAcceptedDate(new Date().toISOString().slice(0, 10))
    setFormError(null)
    setIsCreateOpen(true)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formName.trim()) {
      setFormError(t('Vui lòng nhập tên đại lý.'))
      return
    }
    if (!formPhone.trim()) {
      setFormError(t('Vui lòng nhập số điện thoại.'))
      return
    }
    if (!formWardId) {
      setFormError(t('Vui lòng chọn phường/xã.'))
      return
    }
    if (!formTypeId) {
      setFormError(t('Vui lòng chọn loại đại lý.'))
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch('/agencies', {
        method: 'POST',
        body: {
          name: formName.trim(),
          typeId: Number(formTypeId),
          wardId: Number(formWardId),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          email: formEmail.trim() || null,
          acceptedDate:
            formAcceptedDate || new Date().toISOString().slice(0, 10),
        },
      })
      setIsCreateOpen(false)
      setSuccessNotice(t('Đã tiếp nhận đại lý mới thành công.'))
      notifyNextStep({
        done: t('Đã tiếp nhận đại lý {name}.', { name: formName.trim() }),
        next: t(
          'Đại lý đã hoạt động. Bước tiếp: lập phiếu xuất hàng cho đại lý trong hạn mức nợ của loại đại lý.',
        ),
        ...(hasPermission('stock.issue.prepare')
          ? { to: '/stock-issues' }
          : {}),
      })
      invalidateCache('/agencies')
      void loadAgencies()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setFormError(e.message || t('Không thể tạo hồ sơ đại lý.'))
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
    setFormWardId(String(agencyItem.wardId))
    setFormTypeId(String(agencyItem.typeId))
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
      setFormWardId(String(res.data.wardId))
      setFormTypeId(String(res.data.typeId))
    } catch {
      // If fetching fails, keep the in-memory values and wait for submission
    }
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editAgency) return
    setFormError(null)

    if (!formName.trim()) {
      setFormError(t('Vui lòng nhập tên đại lý.'))
      return
    }
    if (!formPhone.trim()) {
      setFormError(t('Vui lòng nhập số điện thoại.'))
      return
    }
    if (!formWardId) {
      setFormError(t('Vui lòng chọn phường/xã.'))
      return
    }
    if (!formTypeId) {
      setFormError(t('Vui lòng chọn loại đại lý.'))
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
        setFormError(t('Máy chủ chưa cấp ETag. Vui lòng tải lại.'))
        return
      }

      // Must use PATCH, must pass ETag in If-Match header, and field name must be typeId
      await apiFetch(`/agencies/${editAgency.agency.id}`, {
        method: 'PATCH',
        ifMatch: currentEtag,
        body: {
          name: formName.trim(),
          typeId: Number(formTypeId),
          wardId: Number(formWardId),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          email: formEmail.trim() || null,
        },
      })
      setEditAgency(null)
      setSuccessNotice(t('Đã cập nhật hồ sơ đại lý thành công.'))
      invalidateCache('/agencies')
      void loadAgencies()
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 412) {
        setFormError(
          t(
            'Dữ liệu đại lý đã bị thay đổi bởi người dùng khác. Vui lòng đóng và mở lại để tải dữ liệu mới.',
          ),
        )
      } else if (e.status === 409) {
        setFormError(
          e.message ||
            t(
              'Xung đột dữ liệu: nợ tối đa của loại đại lý mới thấp hơn nợ hiện tại hoặc phường/xã đã hết chỗ.',
            ),
        )
      } else {
        setFormError(e.message || t('Không thể cập nhật thông tin đại lý.'))
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
      setFormError(t('Vui lòng nhập lý do ngừng hợp tác.'))
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
        setFormError(t('Máy chủ chưa cấp ETag. Vui lòng tải lại.'))
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
      setSuccessNotice(t('Đã ngừng hợp tác với đại lý thành công.'))
      invalidateCache('/agencies')
      void loadAgencies()
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 412) {
        setFormError(
          t(
            'Hồ sơ đại lý đã bị thay đổi bởi người dùng khác. Vui lòng tải lại.',
          ),
        )
      } else {
        setFormError(e.message || t('Không thể ngừng hợp tác với đại lý này.'))
      }
      if (e.status === 409) {
        invalidateCache('/agencies')
        void loadAgencies()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const typeLabel = agencyTypeLabel
  const statusBadge = (status: string) =>
    status === 'ACTIVE' ? (
      <Badge variant="success" data-status={status}>
        {t('Đang hoạt động')}
      </Badge>
    ) : (
      <Badge variant="danger" data-status={status}>
        {t('Ngừng hợp tác')}
      </Badge>
    )
  const typeOptions = agencyTypes.map((type) => ({
    value: String(type.id),
    label: t('{name} (Hạn mức: {maxDebt})', {
      name: type.name,
      maxDebt: formatVND(type.maxDebt),
    }),
  }))
  const kpis = agencyKpis(wards, agencyTypes)
  const limitOf = (agency: Agency) => debtLimit(agency, agencyTypes)
  // Memoised so menus/dialogs opening on this page do not redraw the charts.
  const pageSummary = useMemo(
    () => agencyPageSummary(filteredAgencies, agencyTypes),
    [filteredAgencies, agencyTypes],
  )
  const pagePartial = !!nextCursor || cursorHistory.length > 0
  const contactFields = (
    <>
      <Input
        id="agency-form-phone"
        label={t('Số điện thoại')}
        value={formPhone}
        onChange={(e) => setFormPhone(e.target.value)}
        placeholder={t('Ví dụ: 0901234567')}
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
          label={t('Địa chỉ')}
          value={formAddress}
          onChange={(e) => setFormAddress(e.target.value)}
          placeholder={t('Số nhà, tên đường...')}
        />
      </div>
      <WardPicker
        id="agency-form-ward"
        value={formWardId}
        onChange={(next) => setFormWardId(next)}
        required
      />
      <Select
        id="agency-form-type"
        label={t('Loại đại lý')}
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
        title={t('Hồ sơ đại lý')}
        actions={
          <>
            <InfoHint label={t('Giới thiệu hồ sơ đại lý')}>
              {t(
                'Tiếp nhận đại lý, phân loại, phường/xã và theo dõi nợ hiện tại so với nợ tối đa của loại đại lý.',
              )}
            </InfoHint>
            {canManage && (
              <Button
                variant="primary"
                onClick={openCreateModal}
                icon={<Plus className="size-4" />}
              >
                {t('Tiếp nhận đại lý mới')}
              </Button>
            )}
          </>
        }
      />

      {kpis.length > 0 && (
        <Stagger
          role="list"
          aria-label={t('Tổng quan đại lý')}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {kpis.map((kpi) => (
            <StaggerItem key={kpi.label} role="listitem">
              <KpiCard
                className="h-full"
                label={kpi.label}
                value={<CountUp value={kpi.value} />}
                icon={<kpi.icon />}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {(successNotice || error) && (
        <div className="space-y-3">
          {successNotice && <Alert type="success">{successNotice}</Alert>}
          {error && <Alert type="error">{error}</Alert>}
        </div>
      )}

      {pageSummary && (
        <SummaryGrid
          label={t('Biểu đồ đại lý trên trang')}
          partial={pagePartial}
          className="lg:grid-cols-6"
        >
          {pageSummary}
        </SummaryGrid>
      )}

      <ListCard
        toolbar={
          <>
            <SearchField
              id="agency-filter-search"
              value={search}
              onChange={(next) => {
                setSearch(next)
                restart()
              }}
              placeholder={t('Tìm theo tên hoặc số điện thoại...')}
            />
            <div className="lg:w-56">
              <WardPicker
                id="agency-filter-ward"
                placeholder={t('Tất cả phường/xã')}
                value={filterWard}
                onChange={(next) => {
                  setFilterWard(next)
                  restart()
                }}
              />
            </div>
            <div className="lg:w-48">
              <Select
                id="agency-filter-type"
                label={t('Loại đại lý')}
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value)
                  restart()
                }}
                options={[
                  { value: '', label: t('Tất cả loại đại lý') },
                  ...agencyTypes.map((type) => ({
                    value: String(type.id),
                    label: type.name,
                  })),
                ]}
              />
            </div>
            <ToggleFilter
              label={t('Trạng thái')}
              value={filterStatus}
              onChange={(next) => {
                setFilterStatus(next as typeof filterStatus)
                restart()
              }}
              options={[
                { value: 'ACTIVE', label: t('Hoạt động') },
                { value: 'TERMINATED', label: t('Ngừng hợp tác') },
              ]}
            />
            <SortMenu
              options={AGENCY_SORTS}
              sort={sort.sort}
              onChange={(next) => {
                sort.setSort(next)
                restart()
              }}
              className="h-9 lg:self-end"
            />
            <FilterReset
              count={activeFilters}
              onReset={() => {
                setSearch('')
                setFilterWard('')
                setFilterType('')
                setFilterStatus('')
                restart()
              }}
            />
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
              {t('Tải lại')}
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
          <TableSkeleton
            columns={9}
            label={t('Đang tải danh sách đại lý...')}
          />
        ) : filteredAgencies.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Store className="size-6" />}
              title={t('Không tìm thấy đại lý')}
              description={t(
                'Không tìm thấy đại lý nào phù hợp với điều kiện tìm kiếm.',
              )}
            />
          </div>
        ) : (
          <Table
            caption={t('Danh sách đại lý')}
            aria-busy={isLoading || undefined}
          >
            <thead>
              <tr>
                <th scope="col">{t('Mã đại lý')}</th>
                <SortableHeader
                  field="name"
                  sort={sort.sort}
                  onSort={(field, first) => {
                    sort.toggle(field, first)
                    restart()
                  }}
                >
                  {t('Tên đại lý')}
                </SortableHeader>
                <th scope="col">{t('Điện thoại')}</th>
                <th scope="col">{t('Phường/xã')}</th>
                <th scope="col">{t('Loại')}</th>
                <SortableHeader
                  field="debt"
                  sort={sort.sort}
                  onSort={(field, first) => {
                    sort.toggle(field, first)
                    restart()
                  }}
                  firstDirection="desc"
                  align="right"
                  className="text-end"
                >
                  {t('Nợ hiện tại')}
                </SortableHeader>
                <th scope="col" className="text-end">
                  {t('Nợ tối đa')}
                </th>
                <SortableHeader
                  field="acceptedDate"
                  sort={sort.sort}
                  onSort={(field, first) => {
                    sort.toggle(field, first)
                    restart()
                  }}
                  firstDirection="desc"
                >
                  {t('Ngày tiếp nhận')}
                </SortableHeader>
                <th scope="col">{t('Trạng thái')}</th>
                <th scope="col" className="cell-actions w-14 text-end">
                  <span className="sr-only">{t('Thao tác')}</span>
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
                  <td className="whitespace-nowrap">{wardLabel(agency)}</td>
                  <td className="whitespace-nowrap">{typeLabel(agency)}</td>
                  <td className="cell-number text-end font-semibold whitespace-nowrap tabular-nums">
                    {formatVND(agency.debt)}
                    {num(agency.debt) < 0 && (
                      <div className="text-xs font-normal text-success">
                        {t('Trả trước')}
                      </div>
                    )}
                    <DebtUsage
                      debt={num(agency.debt)}
                      limit={limitOf(agency)}
                    />
                  </td>
                  <td className="cell-number text-end whitespace-nowrap text-muted-foreground tabular-nums">
                    {limitOf(agency) === null ? '—' : formatVND(agency.maxDebt)}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {formatDate(agency.acceptedDate)}
                  </td>
                  <td>{statusBadge(agency.status)}</td>
                  <td className="cell-actions text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ShadcnButton
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer text-muted-foreground"
                          aria-label={t('Thao tác {code} - {name}', {
                            code: agency.code,
                            name: agency.name,
                          })}
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
                          {t('Xem chi tiết')}
                        </DropdownMenuItem>
                        {canManage && agency.status === 'ACTIVE' && (
                          <>
                            <DropdownMenuItem
                              onSelect={() => void openEditModal(agency)}
                            >
                              <Pencil aria-hidden="true" />
                              {t('Sửa hồ sơ')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => void openTerminateModal(agency)}
                            >
                              <Ban aria-hidden="true" />
                              {t('Ngừng hợp tác')}
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
        title={t('Tiếp nhận đại lý mới')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="agency-form-name"
              label={t('Tên đại lý')}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t('Ví dụ: Đại lý Minh Phát')}
              required
              autoFocus
            />
            <DateField
              id="agency-form-accepted-date"
              label={t('Ngày tiếp nhận')}
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
              {t('Hủy')}
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {t('Tiếp nhận')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editAgency}
        onClose={() => setEditAgency(null)}
        title={t('Chỉnh sửa hồ sơ: {value}', {
          value: editAgency?.agency.code || '',
        })}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                id="agency-form-name"
                label={t('Tên đại lý')}
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
              {t('Hủy')}
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {t('Lưu thay đổi')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Terminate Modal */}
      <Modal
        isOpen={!!terminateAgency}
        onClose={() => setTerminateAgency(null)}
        title={t('Ngừng hợp tác đại lý: {value}', {
          value: terminateAgency?.agency.name || '',
        })}
        maxWidth="md"
      >
        <form onSubmit={handleTerminateSubmit} className="space-y-4" noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <Alert type="warning">
            {t(
              'Sau khi ngừng hợp tác, đại lý không dùng được cho chứng từ mới. Hành động này không thể hoàn tác trực tiếp.',
            )}
          </Alert>
          {terminateAgency && num(terminateAgency.agency.debt) !== 0 && (
            <Alert type="error">
              {t(
                'Đại lý đang có nợ hiện tại {debt}. Chỉ ngừng hợp tác được khi nợ bằng 0: lập phiếu thu cho hết nợ trước.',
                { debt: formatVND(terminateAgency.agency.debt) },
              )}
            </Alert>
          )}
          <Input
            id="agency-terminate-reason"
            label={t('Lý do ngừng hợp tác')}
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder={t('Nhập lý do cụ thể...')}
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
              {t('Hủy')}
            </Button>
            <Button type="submit" variant="danger" isLoading={isSubmitting}>
              {t('Xác nhận ngừng hợp tác')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailAgency}
        onClose={() => setDetailAgency(null)}
        title={t('Chi tiết đại lý: {value}', {
          value: detailAgency?.name || '',
        })}
        maxWidth="lg"
      >
        {detailAgency && (
          <DetailGrid
            entries={[
              [
                t('Mã đại lý'),
                <span key="code" className="font-mono">
                  {detailAgency.code}
                </span>,
              ],
              [
                t('Tên đại lý'),
                <span key="name" className="font-semibold">
                  {detailAgency.name}
                </span>,
              ],
              [t('Điện thoại'), detailAgency.phone || '—'],
              ['Email', detailAgency.email || '—'],
              [t('Địa chỉ'), detailAgency.address || '—', true],
              [t('Phường/xã'), wardLabel(detailAgency)],
              [t('Loại đại lý'), typeLabel(detailAgency)],
              [t('Ngày tiếp nhận'), formatDate(detailAgency.acceptedDate)],
              [t('Trạng thái'), statusBadge(detailAgency.status)],
              [
                t('Nợ hiện tại'),
                <span
                  key="debt"
                  className={cn(
                    'font-semibold tabular-nums',
                    num(detailAgency.debt) < 0
                      ? 'text-success'
                      : 'text-destructive',
                  )}
                >
                  {formatVND(detailAgency.debt)}
                  {num(detailAgency.debt) < 0 && ` (${t('trả trước')})`}
                </span>,
              ],
              [t('Nợ tối đa'), formatVND(detailAgency.maxDebt)],
              [
                t('Còn được nợ'),
                <span key="remaining" className="tabular-nums">
                  {formatVND(detailAgency.remainingCreditLimit)}
                </span>,
              ],
              ...(detailAgency.terminationReason
                ? ([
                    [
                      t('Lý do ngừng hợp tác'),
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

/** Ward/commune name of an agency, falling back to its exact id. */
function wardLabel(agency: Agency): string {
  return agency.wardName || t('Phường/xã #{wardId}', { wardId: agency.wardId })
}

/** Overview tiles derived from the already-loaded agency type catalogue. */
function agencyKpis(wards: Ward[], agencyTypes: AgencyType[]) {
  const counted = wards.filter((w) => w.activeAgencyCount !== undefined)
  const items: { label: string; value: number; icon: typeof Store }[] = []
  if (counted.length) {
    items.push({
      label: t('Đại lý đang hoạt động'),
      value: sumBy(counted, (w) => w.activeAgencyCount ?? 0),
      icon: Store,
    })
    items.push({
      label: t('Phường/xã có đại lý'),
      value: counted.filter((w) => (w.activeAgencyCount ?? 0) > 0).length,
      icon: MapPin,
    })
  }
  if (agencyTypes.length)
    items.push({
      label: t('Loại đại lý'),
      value: agencyTypes.length,
      icon: Tags,
    })
  const full = wards.filter((w) => w.remainingSlots !== undefined)
  if (full.length)
    items.push({
      label: t('Phường/xã đã đủ đại lý'),
      value: full.filter((w) => w.remainingSlots === 0).length,
      icon: CircleDashed,
    })
  return items
}

/** Thin bar under the debt amount: share of the agency type's debt limit used. */
function DebtUsage({ debt, limit }: { debt: number; limit: number | null }) {
  if (limit === null) return null
  const ratio = ratioOf(debt, limit)
  return (
    <Progress
      value={Math.round(ratio * 100)}
      aria-label={t('Đã dùng {ratio} hạn mức nợ', {
        ratio: formatPercent(ratio),
      })}
      title={t('{ratio} hạn mức {limit}', {
        ratio: formatPercent(ratio),
        limit: formatVND(String(limit)),
      })}
      className={cn(
        'mt-1 ms-auto h-1 w-20 bg-muted',
        ratio >= 0.9
          ? '[&>*]:bg-destructive'
          : ratio >= 0.7
            ? '[&>*]:bg-warning'
            : '[&>*]:bg-primary',
      )}
    />
  )
}

/**
 * Charts for the agencies already loaded on this page: type mix, debt by
 * ward/commune and overall debt-limit usage of active agencies.
 */
function agencyTypeLabel(agency: Agency): string {
  return agency.typeName || t('Loại {typeId}', { typeId: agency.typeId })
}

/** Debt limit of the agency's type (display only); null when unknown. */
function debtLimit(agency: Agency, agencyTypes: AgencyType[]): number | null {
  const type = agencyTypes.find((item) => item.id === agency.typeId)
  const limit = num(agency.maxDebt || type?.maxDebt)
  return limit > 0 ? limit : null
}

function agencyPageSummary(agencies: Agency[], agencyTypes: AgencyType[]) {
  if (!agencies.length) return null
  const typeLabel = agencyTypeLabel
  const limitOf = (agency: Agency) => debtLimit(agency, agencyTypes)
  const active = agencies.filter((agency) => agency.status === 'ACTIVE')
  const limited = active.filter((agency) => limitOf(agency) !== null)
  const debt = sumBy(limited, (agency) => Math.max(0, num(agency.debt)))
  const limit = sumBy(limited, (agency) => limitOf(agency) ?? 0)
  const byWard = partsBy(
    agencies,
    (agency) => agency.wardId,
    wardLabel,
    (agency) => num(agency.debt),
  ).map((part) => ({ name: part.label, debt: part.value }))
  return (
    <>
      <DonutTile
        title={t('Đại lý theo loại')}
        centerLabel={t('đại lý')}
        head={[t('Loại'), t('Số đại lý')]}
        data={partsBy(agencies, (agency) => agency.typeId, typeLabel)}
      />
      <ChartTile
        title={t('Nợ theo phường/xã')}
        table={
          <MiniTable
            caption={t('Nợ theo phường/xã')}
            head={[t('Phường/xã'), t('Nợ hiện tại')]}
            rows={byWard.map((row) => [row.name, formatVND(String(row.debt))])}
          />
        }
      >
        <RoundedBarChart
          data={byWard}
          xKey="name"
          height={150}
          valueFormatter={formatCompactVND}
          series={[{ key: 'debt', label: t('Nợ hiện tại') }]}
        />
      </ChartTile>
      <MeterTile
        title={t('Hạn mức nợ đã dùng')}
        ratio={ratioOf(debt, limit)}
        caption={t('{count} đại lý hoạt động', {
          count: formatPlain(limited.length),
        })}
        color={
          ratioOf(debt, limit) >= 0.9
            ? 'var(--destructive)'
            : ratioOf(debt, limit) >= 0.7
              ? 'var(--warning)'
              : 'var(--chart-1)'
        }
        legend={[
          {
            key: 'debt',
            label: t('Nợ hiện tại'),
            value: formatCompactVND(debt),
          },
          { key: 'limit', label: t('Hạn mức'), value: formatCompactVND(limit) },
        ]}
      />
    </>
  )
}
