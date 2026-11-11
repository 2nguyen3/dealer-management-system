import {
  ListChecks,
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { PageHeader } from '../../components/blocks/PageHeader'
import { SortableHeader, SortMenu } from '../../components/data/SortControls'
import { useSort } from '../../components/data/sorting'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/shadcn/tabs'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Pagination } from '../../components/ui/Pagination'
import { Table } from '../../components/ui/Table'
import { ApiError, apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { cn } from '../../lib/utils'
import { useAuth } from '../authentication/useAuth'
import {
  catalog,
  Intent,
  message,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import {
  FilterReset,
  InfoHint,
  ListCard,
  ResultCount,
  SearchField,
  TableSkeleton,
  ToggleFilter,
} from '../districts/listParts'
import { countWhere, partsBy } from '../districts/summaryData'
import { DonutTile, StatTile, SummaryGrid } from '../districts/summaryParts'

function registry(value: unknown): Row {
  const data = record(value)
  if (typeof data.id !== 'number') throw new Error('Invalid function ID')
  catalog(data.id)
  text(data.code)
  text(data.name)
  return data
}

function grant(value: unknown): Row {
  const data = record(value)
  catalog(data.functionId)
  text(data.functionCode)
  text(data.functionName)
  if (typeof data.isAllowed !== 'boolean')
    throw new Error('Invalid grant response')
  return data
}

/** Contract sort fields of GET /functions. */
const FUNCTION_SORTS = [
  { field: 'code', label: 'Mã chức năng' },
  { field: 'name', label: 'Tên chức năng' },
  { field: 'id', label: 'Thứ tự đăng ký' },
] as const

/** Contract sort fields of GET /user-groups/{groupId}/permissions. */
const GRANT_SORTS = [
  { field: 'functionId', label: 'Chức năng' },
  { field: 'id', label: 'Thứ tự cấp quyền' },
] as const

export function PermissionsPage() {
  const { hasPermission, refreshProfile } = useAuth()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [groupLabel, setGroupLabel] = useState('')
  const [tab, setTab] = useState('functions')
  const [grantsVersion, setGrantsVersion] = useState(0)
  const functionSort = useSort()
  const list = useSourcePage(
    '/functions',
    { q, ...functionSort.params },
    registry,
  )
  const [pair, setPair] = useState<{
    group: number
    groupLabel: string
    fn: number
    label: string
    allowed: boolean
    etag: string | null
    absent: boolean
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const intent = useRef(new Intent())
  const inspect = async (fn: Row) => {
    if (busyRef.current || !hasPermission('permissions.manage')) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setPair(null)
    try {
      const groupId = catalog(group),
        functionId = catalog(fn.id)
      const path = `/user-groups/${groupId}/permissions/${functionId}`
      try {
        const response = await apiFetch<unknown>(path)
        const data = record(response.data)
        if (typeof data.isAllowed !== 'boolean')
          throw new Error('Invalid grant response')
        setPair({
          group: groupId,
          groupLabel: groupLabel || `#${groupId}`,
          fn: functionId,
          label: text(fn.name),
          allowed: data.isAllowed,
          etag: response.etag,
          absent: false,
        })
      } catch (failure) {
        if (!(failure instanceof ApiError) || failure.status !== 404)
          throw failure
        setPair({
          group: groupId,
          groupLabel: groupLabel || `#${groupId}`,
          fn: functionId,
          label: text(fn.name),
          allowed: false,
          etag: null,
          absent: true,
        })
      }
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }
  const toggle = async () => {
    if (
      busyRef.current ||
      !pair ||
      !hasPermission('permissions.manage') ||
      (!pair.absent && !pair.etag)
    )
      return
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await intent.current.send<unknown>(
        `/user-groups/${pair.group}/permissions/${pair.fn}`,
        {
          method: 'PUT',
          ...(pair.absent ? { ifNoneMatch: '*' } : { ifMatch: pair.etag! }),
          body: { isAllowed: !pair.allowed },
        },
        false,
      )
      const data = record(response.data)
      if (typeof data.isAllowed !== 'boolean')
        throw new Error('Invalid grant response')
      setPair({
        ...pair,
        allowed: data.isAllowed,
        etag: response.etag,
        absent: false,
      })
      invalidateCache(`/user-groups/${pair.group}/permissions`)
      setGrantsVersion((value) => value + 1)
      setNotice(
        'Máy chủ đã cập nhật quyền. Đang tải lại quyền của phiên hiện tại.',
      )
      await refreshProfile()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }
  const inspectButton = (fn: Row) => (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || !group}
      title={group ? undefined : 'Chọn nhóm người dùng trước khi kiểm tra'}
      icon={<ShieldQuestion className="size-4" />}
      onClick={() => inspect(fn)}
    >
      Kiểm tra quyền
    </Button>
  )
  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Phân quyền chức năng"
        actions={
          <InfoHint label="Cách phân quyền">
            Chọn nhóm người dùng, rồi nhấn Kiểm tra quyền ở chức năng cần xem
            hoặc thay đổi.
          </InfoHint>
        }
      />
      {(error || notice || list.error) && (
        <div className="space-y-3">
          {error && <Alert type="error">{error}</Alert>}
          {notice && <Alert type="success">{notice}</Alert>}
          {list.error && <Alert type="error">{list.error}</Alert>}
        </div>
      )}
      {pair && (
        <section
          className="flex animate-in flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-xs duration-300 fade-in-0 slide-in-from-top-1 sm:flex-row sm:items-center sm:p-5"
          aria-live="polite"
        >
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg',
              pair.allowed
                ? 'bg-success/12 text-success'
                : 'bg-muted text-muted-foreground',
            )}
            aria-hidden="true"
          >
            {pair.allowed ? (
              <ShieldCheck className="size-5" />
            ) : (
              <ShieldOff className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-sm font-semibold break-words">
              {pair.groupLabel}: {pair.label}
            </h2>
            <p>
              {pair.absent ? (
                <Badge variant="neutral">Chưa được cấp</Badge>
              ) : pair.allowed ? (
                <Badge variant="success">Được phép</Badge>
              ) : (
                <Badge variant="danger">Không được phép</Badge>
              )}
            </p>
          </div>
          <Button
            variant={pair.allowed ? 'danger' : 'primary'}
            disabled={busy || (!pair.absent && !pair.etag)}
            isLoading={busy}
            onClick={toggle}
            icon={
              pair.allowed ? (
                <ShieldOff className="size-4" />
              ) : (
                <ShieldCheck className="size-4" />
              )
            }
          >
            {pair.allowed ? 'Thu hồi' : 'Cho phép'}
          </Button>
        </section>
      )}
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="lg:w-72">
            <EntityPicker
              id="permissions-group"
              resource="user-groups"
              label="Nhóm người dùng"
              placeholder="Gõ tên nhóm để chọn…"
              value={group}
              onChange={(value, item) => {
                setGroup(value)
                setGroupLabel(item?.label ?? '')
                setPair(null)
                if (!value) setTab('functions')
              }}
              disabled={busy}
            />
          </div>
          <TabsList>
            <TabsTrigger value="functions">Chức năng</TabsTrigger>
            <TabsTrigger value="grants" disabled={!group}>
              <ListChecks aria-hidden="true" />
              Quyền của nhóm
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="functions">
          <ListCard
            toolbar={
              <>
                <SearchField
                  id="permissions-search"
                  label="Tìm chức năng"
                  placeholder="Mã hoặc tên chức năng…"
                  value={q}
                  onChange={setQ}
                />
                <SortMenu
                  options={FUNCTION_SORTS}
                  sort={functionSort.sort}
                  onChange={functionSort.setSort}
                  className="h-9 lg:self-end"
                />
                <ResultCount count={list.items.length} loading={list.loading} />
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
              <TableSkeleton columns={3} label="Đang tải danh mục chức năng…" />
            ) : !list.items.length ? (
              !list.error && (
                <div className="p-4">
                  <EmptyState title="Không tìm thấy chức năng phù hợp." />
                </div>
              )
            ) : (
              <Table caption="Danh mục chức năng">
                <thead>
                  <tr>
                    <SortableHeader
                      field="code"
                      sort={functionSort.sort}
                      onSort={functionSort.toggle}
                    >
                      Mã
                    </SortableHeader>
                    <SortableHeader
                      field="name"
                      sort={functionSort.sort}
                      onSort={functionSort.toggle}
                    >
                      Tên chức năng
                    </SortableHeader>
                    <th scope="col" className="cell-actions text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((fn) => (
                    <tr
                      key={String(fn.id)}
                      className={cn(pair?.fn === fn.id && 'bg-primary/5')}
                      aria-current={pair?.fn === fn.id ? 'true' : undefined}
                    >
                      <td className="font-mono text-xs text-foreground/80">
                        {String(fn.code)}
                      </td>
                      <td className="font-medium">{String(fn.name)}</td>
                      <td className="cell-actions text-right">
                        {inspectButton(fn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </ListCard>
        </TabsContent>
        <TabsContent value="grants">
          {group && (
            <GroupGrants
              key={`${group}-${grantsVersion}`}
              groupId={group}
              selected={pair?.fn}
              renderAction={(fn) => inspectButton(fn)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Stored grants of one group: allowed/denied mix, filter and contract sort. */
function GroupGrants({
  groupId,
  selected,
  renderAction,
}: {
  groupId: string
  selected?: number
  renderAction: (fn: Row) => ReactNode
}) {
  const [isAllowed, setIsAllowed] = useState('')
  const sort = useSort()
  const list = useSourcePage(
    `/user-groups/${groupId}/permissions`,
    { isAllowed, ...sort.params },
    grant,
  )
  const allowed = countWhere(list.items, (item) => item.isAllowed === true)
  return (
    <div className="space-y-4">
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.items.length > 0 && (
        <SummaryGrid
          label="Tổng quan quyền của nhóm"
          partial={list.hasMore || list.hasPrevious}
        >
          <StatTile label="Được phép" value={allowed} icon={<ShieldCheck />} />
          <StatTile
            label="Không được phép"
            value={list.items.length - allowed}
            icon={<ShieldOff />}
          />
          <DonutTile
            title="Tỷ lệ cấp quyền"
            centerLabel="quyền"
            head={['Trạng thái', 'Số chức năng']}
            data={partsBy(
              list.items,
              (item) => (item.isAllowed ? 0 : 1),
              (item) => (item.isAllowed ? 'Được phép' : 'Không được phép'),
            ).map((part) => ({
              ...part,
              color:
                part.label === 'Được phép'
                  ? 'var(--success)'
                  : 'var(--destructive)',
            }))}
          />
        </SummaryGrid>
      )}
      <ListCard
        toolbar={
          <>
            <ToggleFilter
              label="Trạng thái quyền"
              value={isAllowed}
              onChange={setIsAllowed}
              options={[
                { value: 'true', label: 'Được phép' },
                { value: 'false', label: 'Không được phép' },
              ]}
            />
            <SortMenu
              options={GRANT_SORTS}
              sort={sort.sort}
              onChange={sort.setSort}
              className="h-9 lg:self-end"
            />
            <FilterReset
              count={isAllowed ? 1 : 0}
              onReset={() => setIsAllowed('')}
            />
            <ResultCount count={list.items.length} loading={list.loading} />
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
          <TableSkeleton columns={4} label="Đang tải quyền của nhóm…" />
        ) : !list.items.length ? (
          !list.error && (
            <div className="p-4">
              <EmptyState title="Nhóm chưa có quyền nào được lưu." />
            </div>
          )
        ) : (
          <Table caption="Quyền của nhóm">
            <thead>
              <tr>
                <SortableHeader
                  field="functionId"
                  sort={sort.sort}
                  onSort={sort.toggle}
                >
                  Chức năng
                </SortableHeader>
                <th scope="col">Mã</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="cell-actions text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => {
                const fn = {
                  id: item.functionId,
                  code: item.functionCode,
                  name: item.functionName,
                }
                return (
                  <tr
                    key={String(item.functionId)}
                    className={cn(
                      selected === item.functionId && 'bg-primary/5',
                    )}
                  >
                    <td className="font-medium">{String(item.functionName)}</td>
                    <td className="font-mono text-xs text-foreground/80">
                      {String(item.functionCode)}
                    </td>
                    <td>
                      {item.isAllowed ? (
                        <Badge variant="success">Được phép</Badge>
                      ) : (
                        <Badge variant="danger">Không được phép</Badge>
                      )}
                    </td>
                    <td className="cell-actions text-right">
                      {renderAction(fn)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </ListCard>
    </div>
  )
}
