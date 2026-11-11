import {
  Bot,
  Eye,
  FilePlus2,
  FileX2,
  History,
  PencilLine,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PageHeader } from '../../components/blocks/PageHeader'
import { SortableHeader, SortMenu } from '../../components/data/SortControls'
import { useSort } from '../../components/data/sorting'
import { Skeleton } from '../../components/shadcn/skeleton'
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
import { formatDateTime } from '../../lib/formatters'
import { auditActionLabel, enumOptions } from '../../lib/labels'
import {
  DetailGrid,
  FilterReset,
  InfoHint,
  ListCard,
  ResultCount,
  TableSkeleton,
} from '../districts/listParts'
import { countWhere, partsBy, ratioOf } from '../districts/summaryData'
import {
  DonutTile,
  MeterTile,
  StatTile,
  SummaryGrid,
} from '../districts/summaryParts'
import {
  id,
  message,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { changedKeys, entityLabel } from './auditLabels'

const AUDIT_ACTIONS = ['INSERT', 'UPDATE', 'DELETE'] as const
/** Contract sort fields of GET /audit-logs; the server default is -createdAt. */
const AUDIT_SORTS = [
  { field: 'createdAt', label: 'Thời điểm' },
  { field: 'id', label: 'Mã nhật ký' },
] as const
const EMPTY_FILTERS = {
  action: '',
  entityName: '',
  actorId: '',
  requestId: '',
}
const ACTION_TONES: Record<string, 'success' | 'info' | 'danger'> = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
}
const ACTION_ICONS: Record<string, ReactNode> = {
  INSERT: <FilePlus2 className="size-3.5" aria-hidden="true" />,
  UPDATE: <PencilLine className="size-3.5" aria-hidden="true" />,
  DELETE: <FileX2 className="size-3.5" aria-hidden="true" />,
}

function actor(item: Row): string {
  const type = auditActionLabel(item.actorType)
  return item.actorId === null || item.actorId === undefined
    ? type
    : `${type} #${String(item.actorId)}`
}

function snapshot(value: unknown): string {
  return value === null || value === undefined
    ? 'Không có dữ liệu.'
    : JSON.stringify(value, null, 2)
}

function audit(value: unknown): Row {
  const data = record(value)
  id(data.id)
  text(data.entityName)
  text(data.entityKey)
  text(data.functionCode)
  if (
    !['INSERT', 'UPDATE', 'DELETE'].includes(text(data.action)) ||
    !['USER', 'SYSTEM'].includes(text(data.actorType))
  )
    throw new Error('Invalid audit response')
  return data
}

function ActorCell({ item }: { item: Row }) {
  const Icon = item.actorType === 'SYSTEM' ? Bot : UserRound
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="size-3.5" />
      </span>
      {actor(item)}
    </span>
  )
}

function ActionBadge({ action }: { action: unknown }) {
  return (
    <Badge variant={ACTION_TONES[String(action)]}>
      {ACTION_ICONS[String(action)]}
      {auditActionLabel(action)}
    </Badge>
  )
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<Record<string, string>>(EMPTY_FILTERS)
  const sort = useSort('-createdAt')
  const list = useSourcePage(
    '/audit-logs',
    { ...filters, ...sort.params },
    audit,
  )
  const activeFilters = Object.values(filters).filter(
    (value) => value.trim() !== '',
  ).length
  const systemCount = countWhere(
    list.items,
    (item) => item.actorType === 'SYSTEM',
  )
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<Row | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!selected) return
    let current = true
    const controller = new AbortController()
    apiFetch<unknown>(`/audit-logs/${selected}`, { signal: controller.signal })
      .then((response) => {
        const data = audit(response.data)
        if (current) setDetail(data)
      })
      .catch((failure: unknown) => {
        if (current) setError(message(failure))
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [selected])
  const changes = detail ? changedKeys(detail.oldData, detail.newData) : []

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Nhật ký hệ thống"
        actions={
          <InfoHint label="Giới thiệu nhật ký">
            Lịch sử thay đổi dữ liệu. Thông tin nhạy cảm đã được ẩn.
          </InfoHint>
        }
      />
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.items.length > 0 && (
        <SummaryGrid
          label="Tổng quan nhật ký"
          partial={list.hasMore || list.hasPrevious}
        >
          <StatTile
            label="Thay đổi"
            value={list.items.length}
            icon={<History />}
          />
          <StatTile label="Do hệ thống" value={systemCount} icon={<Bot />} />
          <DonutTile
            title="Theo hành động"
            centerLabel="thay đổi"
            head={['Hành động', 'Số lần']}
            data={partsBy(
              list.items,
              (item) => AUDIT_ACTIONS.indexOf(item.action as never),
              (item) => auditActionLabel(item.action),
            )}
          />
          <MeterTile
            title="Người dùng thực hiện"
            className="lg:col-span-4"
            ratio={ratioOf(list.items.length - systemCount, list.items.length)}
            caption={`${list.items.length - systemCount}/${list.items.length} thay đổi`}
            legend={[
              {
                key: 'user',
                label: 'Người dùng',
                value: list.items.length - systemCount,
              },
              { key: 'system', label: 'Hệ thống', value: systemCount },
            ]}
          />
        </SummaryGrid>
      )}
      <ListCard
        toolbar={
          <>
            <div className="lg:w-40">
              <Select
                id="audit-filter-action"
                label="Hành động"
                value={filters.action}
                onChange={(event) =>
                  setFilters({ ...filters, action: event.target.value })
                }
                options={enumOptions(AUDIT_ACTIONS, auditActionLabel, 'Tất cả')}
              />
            </div>
            {[
              ['entityName', 'Bảng dữ liệu', 'VD: document'],
              ['actorId', 'Mã người thực hiện', 'VD: 4'],
              ['requestId', 'Mã yêu cầu', 'Mã yêu cầu đầy đủ'],
            ].map(([key, label, placeholder]) => (
              <div key={key} className="lg:w-48">
                <Input
                  id={`audit-filter-${key}`}
                  label={label}
                  placeholder={placeholder}
                  value={filters[key!] ?? ''}
                  onChange={(event) =>
                    setFilters({ ...filters, [key!]: event.target.value })
                  }
                />
              </div>
            ))}
            <SortMenu
              options={AUDIT_SORTS}
              sort={sort.sort}
              onChange={sort.setSort}
              defaultLabel="Mới nhất"
              className="h-9 lg:self-end"
            />
            <FilterReset
              count={activeFilters}
              onReset={() => setFilters(EMPTY_FILTERS)}
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
          <TableSkeleton columns={6} label="Đang tải nhật ký…" />
        ) : !list.items.length ? (
          !list.error && (
            <div className="p-4">
              <EmptyState
                title="Không có nhật ký phù hợp."
                description="Thử bỏ bớt bộ lọc."
              />
            </div>
          )
        ) : (
          <Table caption="Nhật ký">
            <thead>
              <tr>
                <SortableHeader
                  field="createdAt"
                  sort={sort.sort}
                  onSort={() =>
                    sort.setSort(
                      sort.sort === 'createdAt' ? '-createdAt' : 'createdAt',
                    )
                  }
                >
                  Thời điểm
                </SortableHeader>

                <th scope="col">Người thực hiện</th>
                <th scope="col">Chức năng</th>
                <th scope="col">Hành động</th>
                <th scope="col">Dữ liệu</th>
                <th scope="col" className="cell-actions text-right">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={String(item.id)}>
                  <td className="whitespace-nowrap tabular-nums">
                    {formatDateTime(String(item.createdAt))}
                  </td>
                  <td>
                    <ActorCell item={item} />
                  </td>
                  <td>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {String(item.functionCode)}
                    </code>
                  </td>
                  <td>
                    <ActionBadge action={item.action} />
                  </td>
                  <td>
                    <div className="font-medium">
                      {entityLabel(item.entityName)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">
                        {String(item.entityName)}
                      </span>{' '}
                      · khóa {String(item.entityKey)}
                    </div>
                  </td>
                  <td className="cell-actions text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Eye className="size-4" />}
                      onClick={() => {
                        setSelected(String(item.id))
                        setDetail(null)
                        setError('')
                      }}
                    >
                      Xem
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </ListCard>
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected('')}
        title="Chi tiết nhật ký"
        maxWidth="xl"
      >
        {detail ? (
          <div className="space-y-5">
            <DetailGrid
              entries={[
                ['Thời điểm', formatDateTime(String(detail.createdAt))],
                ['Người thực hiện', <ActorCell key="actor" item={detail} />],
                [
                  'Hành động',
                  <ActionBadge key="action" action={detail.action} />,
                ],
                [
                  'Chức năng',
                  <code key="function" className="font-mono text-xs">
                    {String(detail.functionCode)}
                  </code>,
                ],
                [
                  'Dữ liệu',
                  `${entityLabel(detail.entityName)} (${String(detail.entityName)}) · khóa ${String(detail.entityKey)}`,
                ],
                [
                  'Mã yêu cầu',
                  typeof detail.requestId === 'string' ? (
                    <code key="request" className="font-mono text-xs">
                      {detail.requestId}
                    </code>
                  ) : (
                    '—'
                  ),
                ],
              ]}
            />
            {changes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Trường thay đổi:</span>
                {changes.map((key) => (
                  <Badge key={key} variant="info" className="font-mono">
                    {key}
                  </Badge>
                ))}
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {(
                [
                  ['Trước thay đổi', detail.oldData],
                  ['Sau thay đổi', detail.newData],
                ] as const
              ).map(([title, data]) => (
                <section key={title} className="min-w-0 space-y-2">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <pre className="finance-json max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {snapshot(data)}
                  </pre>
                </section>
              ))}
            </div>
          </div>
        ) : error ? (
          <Alert type="error">{error}</Alert>
        ) : (
          <div
            role="status"
            aria-label="Đang tải chi tiết"
            className="grid gap-3 sm:grid-cols-2"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
