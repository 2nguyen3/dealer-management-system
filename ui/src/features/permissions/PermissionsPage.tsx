import { useRef, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { Table } from '../../components/ui/Table'
import { ApiError, apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
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
  const list = useSourcePage('/functions', { q }, registry)
  const [pair, setPair] = useState<{
    group: number
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
    <div className="page-container">
      <h1 className="page-title">Phân quyền chức năng</h1>
      <p>
        Không suy ra quyền từ trang danh sách. Chỉ đọc phiên bản của đúng cặp
        nhóm/chức năng khi chọn kiểm tra.
      </p>
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      {list.error && <Alert type="error">{list.error}</Alert>}
      <div className="filter-bar">
        <Input
          label="Tìm chức năng"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <Input
          label="ID nhóm người dùng"
          value={group}
          onChange={(event) => {
            setGroup(event.target.value)
            setPair(null)
          }}
          disabled={busy}
        />
      </div>
      <Table caption="Danh mục chức năng">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((fn) => (
            <tr key={String(fn.id)}>
              <td>{String(fn.code)}</td>
              <td>{String(fn.name)}</td>
              <td>
                <Button disabled={busy || !group} onClick={() => inspect(fn)}>
                  Kiểm tra quyền
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination
        hasNext={list.hasMore}
        hasPrevious={list.hasPrevious}
        onNext={list.next}
        onPrevious={list.previous}
        isLoading={list.loading}
      />
      {pair && (
        <section className="card">
          <h2>
            Nhóm #{pair.group}: {pair.label}
          </h2>
          <p>
            {pair.absent
              ? 'Chưa có bản ghi quyền'
              : pair.allowed
                ? 'Được phép'
                : 'Không được phép'}
          </p>
          <Button
            disabled={busy || (!pair.absent && !pair.etag)}
            onClick={toggle}
          >
            {pair.allowed ? 'Thu hồi' : 'Cho phép'}
          </Button>
        </section>
      )}
    </div>
  )
}
