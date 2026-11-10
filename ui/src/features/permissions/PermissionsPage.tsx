import { ShieldCheck, ShieldOff, ShieldQuestion } from 'lucide-react'
import { useRef, useState } from 'react'
import { PageHeader } from '../../components/blocks/PageHeader'
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
  ListCard,
  ResultCount,
  SearchField,
  TableSkeleton,
} from '../districts/listParts'

function registry(value: unknown): Row {
  const data = record(value)
  if (typeof data.id !== 'number') throw new Error('Invalid function ID')
  catalog(data.id)
  text(data.code)
  text(data.name)
  return data
}

export function PermissionsPage() {
  const { hasPermission, refreshProfile } = useAuth()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [groupLabel, setGroupLabel] = useState('')
  const list = useSourcePage('/functions', { q }, registry)
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
  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Phân quyền chức năng"
        description="Chọn nhóm người dùng, sau đó nhấn Kiểm tra quyền ở chức năng cần xem hoặc thay đổi."
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
          className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-xs sm:flex-row sm:items-center sm:p-5"
          aria-live="polite"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
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
      <ListCard
        toolbar={
          <>
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
                }}
                disabled={busy}
              />
            </div>
            <SearchField
              id="permissions-search"
              label="Tìm chức năng"
              placeholder="Mã hoặc tên chức năng…"
              value={q}
              onChange={setQ}
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
                <th scope="col">Mã</th>
                <th scope="col">Tên chức năng</th>
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !group}
                      title={
                        group
                          ? undefined
                          : 'Chọn nhóm người dùng trước khi kiểm tra'
                      }
                      icon={<ShieldQuestion className="size-4" />}
                      onClick={() => inspect(fn)}
                    >
                      Kiểm tra quyền
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </ListCard>
    </div>
  )
}
