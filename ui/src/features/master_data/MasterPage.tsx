import { Eye, KeyRound, Plus, RefreshCw, Trash2, UserX } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { PageHeader } from '../../components/blocks/PageHeader'
import { DateField } from '../../components/blocks/DateField'
import { SortableHeader, SortMenu } from '../../components/data/SortControls'
import { useSort } from '../../components/data/sorting'
import { Separator } from '../../components/shadcn/separator'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  EntityPicker,
  type PickerResource,
} from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Table } from '../../components/ui/Table'
import { cn } from '../../lib/utils'
import { apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  formatVND,
} from '../../lib/formatters'
import { statusLabel } from '../../lib/labels'
import type { FunctionCode } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'
import {
  businessDate,
  catalog,
  Intent,
  message,
  money,
  quantity,
  vietnamDate,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { CatalogSelect } from './CatalogSelect'
import {
  DetailGrid,
  FilterReset,
  IconAction,
  InfoHint,
  ListCard,
  ResultCount,
  SearchField,
  TableSkeleton,
  ToggleFilter,
} from './listParts'
import { SummaryGrid } from './summaryParts'

/** How an id-valued field/filter is chosen: searchable picker or small list. */
export type Lookup =
  | { picker: PickerResource }
  | { options: string }
  | { boolean: [string, string] }

/** Display format of a list/detail column. Values stay exact server strings. */
export type ColumnKind =
  'money' | 'quantity' | 'count' | 'boolean' | 'status' | 'date' | 'datetime'

interface Field {
  key: string
  label: string
  type?:
    | 'catalog'
    | 'money'
    | 'quantity'
    | 'date'
    | 'email'
    | 'password'
    | 'boolean'
    | 'status'
  optional?: boolean
  createOnly?: boolean
  choices?: string[]
  lookup?: Lookup
}
/**
 * One server sort field from the endpoint's contract `sort` enum. `column`
 * names the list column whose header toggles it (defaults to `field`).
 */
export interface MasterSort {
  field: string
  label: string
  column?: string
  firstDirection?: 'asc' | 'desc'
}

export interface MasterConfig {
  path: string
  title: string
  /** Short plain-language explanation, shown in an info tooltip. */
  description?: string
  manage: FunctionCode
  fields: Field[]
  columns: [string, string, ColumnKind?][]
  decode: (value: unknown) => Row
  statuses?: string[]
  filters?: [string, string, Lookup?][]
  deletePermission?: FunctionCode
  noDelete?: boolean
  terminate?: boolean
  passwordReset?: boolean
  /** Contract sort fields; omitted lists keep the server default order. */
  sorts?: MasterSort[]
  /**
   * Visual summary (StatTile/ChartTile children) computed from the rows that
   * are already loaded; it is labelled as partial when more pages exist.
   */
  summary?: (items: Row[]) => ReactNode
}

const booleanLabels: Record<string, string> = { true: 'Có', false: 'Không' }
const numericKinds = new Set<ColumnKind | undefined>([
  'money',
  'quantity',
  'count',
])

/** Formatted presentation of one column; never coerces money to Number. */
function displayCell(
  value: unknown,
  key: string,
  kind?: ColumnKind,
): ReactNode {
  const resolved = kind ?? (key === 'status' ? 'status' : undefined)
  if (value === null || value === undefined || value === '') return '—'
  const raw = String(value)
  switch (resolved) {
    case 'status':
      return <StatusBadge status={raw} />
    case 'money':
      return formatVND(raw)
    case 'quantity':
    case 'count':
      return formatQuantity(raw)
    case 'boolean':
      return booleanLabels[raw] ?? raw
    case 'date':
      return formatDate(raw)
    case 'datetime':
      return formatDateTime(raw)
    default:
      return raw
  }
}

function cellClass(kind?: ColumnKind): string | undefined {
  return numericKinds.has(kind) ? 'cell-number' : undefined
}

export function MasterPage({ config }: { config: MasterConfig }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission(config.manage)
  const [filters, setFilters] = useState<Record<string, string>>({ q: '' })
  const sort = useSort()
  const list = useSourcePage(
    config.path,
    { ...filters, ...sort.params },
    config.decode,
  )
  // Keep the last loaded rows for the summary so it does not flicker while
  // the next page or filter result is loading.
  const [summaryRows, setSummaryRows] = useState<Row[]>([])
  if (!list.loading && !list.error && list.items !== summaryRows)
    setSummaryRows(list.items)
  const activeFilters = Object.values(filters).filter(
    (value) => value.trim() !== '',
  ).length
  // Memoised so opening a dialog does not redraw the summary charts.
  const summary = useMemo(
    () => config.summary?.(summaryRows),
    [config, summaryRows],
  )
  const sortFor = (column: string) =>
    config.sorts?.find((option) => (option.column ?? option.field) === column)
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<{
    item: Row
    etag: string | null
  } | null>(null)
  const [detailError, setDetailError] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const intent = useRef(new Intent())
  useEffect(() => {
    if (!selected) return
    let current = true
    const controller = new AbortController()
    apiFetch<unknown>(`${config.path}/${selected}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const item = config.decode(response.data)
        if (current) {
          setDetailError('')
          setDetail({ item, etag: response.etag })
          setValues(
            Object.fromEntries(
              config.fields.map((field) => [
                field.key,
                String(item[field.key] ?? ''),
              ]),
            ),
          )
        }
      })
      .catch((failure: unknown) => {
        if (current) setDetailError(message(failure))
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [config, selected, version])

  const refresh = () => {
    invalidateCache(config.path)
    list.reload()
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canManage || (!creating && !detail?.etag)) return
    setError('')
    setNotice('')
    try {
      const body: Row = {}
      for (const field of config.fields) {
        if (!creating && field.createOnly) continue
        const raw = values[field.key] ?? ''
        if (field.optional && raw === '') {
          body[field.key] = null
          continue
        }
        if (!raw.trim() && field.type !== 'password')
          throw new Error(`Cần nhập ${field.label}.`)
        body[field.key] =
          field.type === 'catalog'
            ? catalog(raw)
            : field.type === 'money'
              ? money(raw)
              : field.type === 'quantity'
                ? quantity(raw)
                : field.type === 'boolean'
                  ? raw === 'true'
                  : field.type === 'date'
                    ? businessDate(raw)
                    : field.type === 'password'
                      ? raw
                      : raw.trim()
        if (field.type === 'password' && raw === '')
          throw new Error('Mật khẩu không được rỗng.')
      }
      setBusy(true)
      await intent.current.send(
        creating ? config.path : `${config.path}/${selected}`,
        {
          method: creating ? 'POST' : 'PATCH',
          body,
          ...(!creating ? { ifMatch: detail!.etag! } : {}),
        },
        false,
      )
      setNotice(creating ? 'Đã thêm mới.' : 'Đã lưu thay đổi.')
      setCreating(false)
      setSelected('')
      setDetail(null)
      setValues({})
      refresh()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const action = async (name: 'delete' | 'terminate' | 'password-reset') => {
    if (busy || !canManage || !detail?.etag) return
    if (
      name === 'delete' &&
      !window.confirm(
        'Xóa bản ghi này? Chỉ xóa được khi bản ghi chưa được sử dụng.',
      )
    )
      return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await intent.current.send(
        `${config.path}/${selected}${name === 'delete' ? '' : `/${name}`}`,
        {
          method: name === 'delete' ? 'DELETE' : 'POST',
          ifMatch: detail.etag,
          ...(name === 'terminate'
            ? { body: { reason: reason.trim() } }
            : name === 'password-reset'
              ? { body: { newPassword: password } }
              : {}),
        },
        name === 'terminate',
      )
      setNotice(
        name === 'password-reset'
          ? 'Đã đặt lại mật khẩu và đăng xuất các phiên cũ. Tài khoản đang khóa vẫn giữ trạng thái khóa.'
          : 'Đã thực hiện thao tác.',
      )
      setSelected('')
      setDetail(null)
      setPassword('')
      refresh()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const disabled = busy || (!creating && !detail?.etag)
  const terminated = detail?.item.status === 'TERMINATED'
  const editableFields = config.fields.filter(
    (field) => creating || !field.createOnly,
  )
  const unchanged =
    !creating &&
    !!detail &&
    editableFields.every(
      (field) =>
        (values[field.key] ?? '') === String(detail.item[field.key] ?? ''),
    )
  const readOnlyColumns = config.columns.filter(
    ([key]) =>
      !canManage ||
      terminated ||
      !editableFields.some((field) => field.key === key),
  )

  const openCreate = () => {
    setCreating(true)
    setSelected('')
    setError('')
    setDetailError('')
    setValues(
      Object.fromEntries(
        config.fields.map((field) => [
          field.key,
          field.type === 'date'
            ? vietnamDate()
            : field.type === 'boolean'
              ? 'false'
              : field.type === 'status'
                ? 'ACTIVE'
                : '',
        ]),
      ),
    )
  }
  const openDetail = (item: Row) => {
    setSelected(String(item.id))
    setDetail(null)
    setDetailError('')
    setError('')
    setReason('')
    setPassword('')
  }
  const closeModal = () => {
    if (busy) return
    setCreating(false)
    setSelected('')
    setDetailError('')
    setError('')
    setValues({})
    setPassword('')
  }
  const setValue = (key: string, next: string) =>
    setValues({ ...values, [key]: next })
  const renderField = (field: Field) => {
    const fieldId = `master-field-${field.key}`
    const value = values[field.key] ?? ''
    if (field.lookup && 'picker' in field.lookup)
      return (
        <EntityPicker
          key={field.key}
          id={fieldId}
          resource={field.lookup.picker}
          label={field.label}
          required={!field.optional}
          value={value}
          onChange={(next) => setValue(field.key, next)}
          disabled={disabled}
        />
      )
    if (field.lookup && 'options' in field.lookup)
      return (
        <CatalogSelect
          key={field.key}
          id={fieldId}
          label={field.label}
          path={field.lookup.options}
          required={!field.optional}
          value={value}
          onChange={(next) => setValue(field.key, next)}
          disabled={disabled}
        />
      )
    if (field.type === 'boolean' || field.type === 'status')
      return (
        <Select
          key={field.key}
          id={fieldId}
          label={field.label}
          value={value}
          onChange={(event) => setValue(field.key, event.target.value)}
          options={(field.type === 'boolean'
            ? ['false', 'true']
            : (field.choices ?? ['ACTIVE', 'INACTIVE'])
          ).map((choice) => ({
            value: choice,
            label:
              field.type === 'boolean'
                ? (booleanLabels[choice] ?? choice)
                : statusLabel(choice),
          }))}
          disabled={disabled}
        />
      )
    if (field.type === 'date')
      return (
        <DateField
          key={field.key}
          id={fieldId}
          label={field.label}
          value={value}
          onChange={(next) => setValue(field.key, next)}
          disabled={disabled}
          required={!field.optional}
        />
      )
    return (
      <Input
        key={field.key}
        id={fieldId}
        label={field.label}
        type={
          field.type === 'email' || field.type === 'password'
            ? field.type
            : 'text'
        }
        inputMode={
          field.type === 'money' || field.type === 'quantity'
            ? 'decimal'
            : undefined
        }
        autoComplete={field.type === 'password' ? 'new-password' : undefined}
        value={value}
        onChange={(event) => setValue(field.key, event.target.value)}
        disabled={disabled}
        required={!field.optional}
      />
    )
  }
  const canDelete =
    canManage &&
    !!detail &&
    !config.noDelete &&
    (!config.deletePermission || hasPermission(config.deletePermission))
  const pageAlerts = [
    error && !creating && !selected ? (
      <Alert key="error" type="error">
        {error}
      </Alert>
    ) : null,
    notice ? (
      <Alert key="notice" type="success">
        {notice}
      </Alert>
    ) : null,
    list.error ? (
      <Alert key="list" type="error">
        {list.error}
      </Alert>
    ) : null,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title={config.title}
        actions={
          <>
            {config.description && (
              <InfoHint label={`Giới thiệu ${config.title}`}>
                {config.description}
              </InfoHint>
            )}
            {canManage && (
              <Button
                disabled={busy}
                onClick={openCreate}
                icon={<Plus className="size-4" />}
              >
                Thêm mới
              </Button>
            )}
          </>
        }
      />
      {pageAlerts.length > 0 && <div className="space-y-3">{pageAlerts}</div>}
      {config.summary && summaryRows.length > 0 && (
        <SummaryGrid
          label={`Tổng quan ${config.title}`}
          partial={list.hasMore || list.hasPrevious}
        >
          {summary}
        </SummaryGrid>
      )}
      <ListCard
        toolbar={
          <>
            <SearchField
              id="master-filter-search"
              value={filters.q ?? ''}
              placeholder="Mã, tên…"
              onChange={(q) => setFilters({ ...filters, q })}
            />
            {config.statuses && (
              <ToggleFilter
                label="Trạng thái"
                value={filters.status ?? ''}
                onChange={(status) => setFilters({ ...filters, status })}
                options={config.statuses.map((value) => ({
                  value,
                  label: statusLabel(value),
                }))}
              />
            )}
            {config.filters?.map(([key, label, lookup]) => {
              const value = filters[key] ?? ''
              const update = (next: string) =>
                setFilters({ ...filters, [key]: next })
              const id = `master-filter-${key}`
              return (
                <div key={key} className="lg:w-56">
                  {lookup && 'picker' in lookup ? (
                    <EntityPicker
                      id={id}
                      resource={lookup.picker}
                      label={label}
                      placeholder="Tất cả — gõ để tìm"
                      value={value}
                      onChange={(next) => update(next)}
                    />
                  ) : lookup && 'options' in lookup ? (
                    <CatalogSelect
                      id={id}
                      label={label}
                      path={lookup.options}
                      emptyLabel="Tất cả"
                      value={value}
                      onChange={update}
                    />
                  ) : lookup && 'boolean' in lookup ? (
                    <Select
                      id={id}
                      label={label}
                      value={value}
                      onChange={(event) => update(event.target.value)}
                      options={[
                        { value: '', label: 'Tất cả' },
                        { value: 'true', label: lookup.boolean[0] },
                        { value: 'false', label: lookup.boolean[1] },
                      ]}
                    />
                  ) : (
                    <Input
                      id={id}
                      label={label}
                      value={value}
                      onChange={(event) => update(event.target.value)}
                    />
                  )}
                </div>
              )
            })}
            {config.sorts && config.sorts.length > 0 && (
              <SortMenu
                options={config.sorts}
                sort={sort.sort}
                onChange={sort.setSort}
                className="h-9 lg:self-end"
              />
            )}
            <FilterReset
              count={activeFilters}
              onReset={() => setFilters({ q: '' })}
            />
            <ResultCount count={list.items.length} loading={list.loading} />
            <Button
              type="button"
              variant="outline"
              onClick={list.reload}
              icon={<RefreshCw className="size-4" />}
            >
              Tải lại
            </Button>
          </>
        }
        footer={
          <Pagination
            hasNext={list.hasMore}
            hasPrevious={list.hasPrevious}
            onNext={list.next}
            onPrevious={list.previous}
            isLoading={list.loading}
          />
        }
      >
        {list.loading ? (
          <TableSkeleton columns={config.columns.length + 1} />
        ) : !list.items.length ? (
          !list.error && (
            <div className="p-4">
              <EmptyState
                title="Không có kết quả"
                description="Thử đổi từ khóa hoặc bộ lọc."
              />
            </div>
          )
        ) : (
          <Table caption={config.title}>
            <thead>
              <tr>
                {config.columns.map(([key, label, kind]) => {
                  const option = sortFor(key)
                  return option ? (
                    <SortableHeader
                      key={key}
                      field={option.field}
                      sort={sort.sort}
                      onSort={sort.toggle}
                      firstDirection={option.firstDirection}
                      align={numericKinds.has(kind) ? 'right' : 'left'}
                      className={cn(numericKinds.has(kind) && 'text-right')}
                    >
                      {label}
                    </SortableHeader>
                  ) : (
                    <th
                      scope="col"
                      key={key}
                      className={cn(
                        cellClass(kind),
                        numericKinds.has(kind) && 'text-right',
                      )}
                    >
                      {label}
                    </th>
                  )
                })}

                <th scope="col" className="cell-actions w-16 text-right">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={String(item.id)}>
                  {config.columns.map(([key, , kind]) => (
                    <td
                      key={key}
                      className={cn(
                        cellClass(kind),
                        numericKinds.has(kind) && 'text-right tabular-nums',
                        key === 'code' &&
                          'font-mono text-xs font-medium text-foreground/80',
                        (key === 'name' || key === 'fullName') &&
                          'font-medium text-foreground',
                      )}
                    >
                      {displayCell(item[key], key, kind)}
                    </td>
                  ))}
                  <td className="cell-actions text-right">
                    <IconAction
                      label="Chi tiết"
                      tooltip={canManage ? 'Xem và chỉnh sửa' : 'Xem chi tiết'}
                      disabled={busy}
                      onClick={() => openDetail(item)}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                    </IconAction>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </ListCard>
      <Modal
        isOpen={creating || !!selected}
        onClose={closeModal}
        title={
          creating
            ? `Thêm ${config.title}`
            : `Chi tiết ${String(
                detail?.item.code ??
                  detail?.item.name ??
                  detail?.item.fullName ??
                  '',
              )}`.trim()
        }
        maxWidth="lg"
      >
        <div className="space-y-5">
          {error && <Alert type="error">{error}</Alert>}
          {!creating && !detail ? (
            detailError ? (
              <div className="space-y-3">
                <Alert type="error">{detailError}</Alert>
                <Button
                  type="button"
                  variant="outline"
                  icon={<RefreshCw className="size-4" />}
                  onClick={() => {
                    setDetailError('')
                    setVersion((value) => value + 1)
                  }}
                >
                  Thử tải lại
                </Button>
              </div>
            ) : (
              <div
                role="status"
                aria-label="Đang tải chi tiết"
                className="grid gap-4 sm:grid-cols-2"
              >
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {!creating && readOnlyColumns.length > 0 && (
                <DetailGrid
                  entries={readOnlyColumns.map(([key, label, kind]) => [
                    label,
                    displayCell(detail?.item[key], key, kind),
                  ])}
                />
              )}
              {canManage && !terminated && (
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {editableFields.map(renderField)}
                  </div>
                  {!creating && !detail?.etag && (
                    <Alert type="warning">
                      Chưa thể lưu vì thiếu thông tin phiên bản. Hãy tải lại chi
                      tiết rồi sửa lại.
                    </Alert>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeModal}
                      disabled={busy}
                    >
                      Đóng
                    </Button>
                    <Button
                      type="submit"
                      disabled={disabled || unchanged}
                      isLoading={busy}
                    >
                      {creating ? 'Tạo mới' : 'Lưu thay đổi'}
                    </Button>
                  </div>
                </form>
              )}
              {!creating && (
                <>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      icon={<RefreshCw className="size-4" />}
                      onClick={() => {
                        setDetail(null)
                        setDetailError('')
                        setVersion((value) => value + 1)
                      }}
                    >
                      Tải lại chi tiết
                    </Button>
                    {canDelete && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={disabled}
                        icon={<Trash2 className="size-4" />}
                        onClick={() => action('delete')}
                      >
                        Xóa
                      </Button>
                    )}
                  </div>
                  {canManage && detail && config.terminate && !terminated && (
                    <section className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                        <UserX className="size-4" aria-hidden="true" />
                        Ngừng hợp tác
                      </h3>
                      <Input
                        label="Lý do ngừng hợp tác"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                      <Button
                        variant="danger"
                        disabled={disabled || !reason.trim()}
                        onClick={() => action('terminate')}
                      >
                        Ngừng hợp tác vĩnh viễn
                      </Button>
                    </section>
                  )}
                  {canManage && detail && config.passwordReset && (
                    <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <KeyRound className="size-4" aria-hidden="true" />
                        Đặt lại mật khẩu
                      </h3>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1">
                          <Input
                            label="Mật khẩu mới"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                          />
                        </div>
                        <Button
                          variant="secondary"
                          disabled={disabled || !password}
                          onClick={() => action('password-reset')}
                        >
                          Đặt lại mật khẩu
                        </Button>
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
