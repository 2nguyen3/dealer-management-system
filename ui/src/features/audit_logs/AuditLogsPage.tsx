import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { formatDateTime } from '../../lib/formatters'
import {
  id,
  message,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'

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

export function AuditLogsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    action: '',
    entityName: '',
    actorId: '',
    requestId: '',
  })
  const list = useSourcePage('/audit-logs', filters, audit)
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
  return (
    <div className="page-container">
      <h1 className="page-title">Nhật ký hệ thống</h1>
      <p>Chỉ đọc bản tóm tắt đã lọc bí mật bởi máy chủ.</p>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {error && <Alert type="error">{error}</Alert>}
      <div className="filter-bar">
        <Select
          label="Hành động"
          value={filters.action}
          onChange={(event) =>
            setFilters({ ...filters, action: event.target.value })
          }
          options={['', 'INSERT', 'UPDATE', 'DELETE'].map((value) => ({
            value,
            label: value || 'Tất cả',
          }))}
        />
        {[
          ['entityName', 'Tên thực thể'],
          ['actorId', 'ID người thực hiện'],
          ['requestId', 'Request ID'],
        ].map(([key, label]) => (
          <Input
            key={key}
            label={label}
            value={filters[key!] ?? ''}
            onChange={(event) =>
              setFilters({ ...filters, [key!]: event.target.value })
            }
          />
        ))}
      </div>
      <Table caption="Nhật ký">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Người thực hiện</th>
            <th>Chức năng</th>
            <th>Hành động</th>
            <th>Thực thể / Khóa</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((item) => (
            <tr key={String(item.id)}>
              <td>{formatDateTime(String(item.createdAt))}</td>
              <td>
                {String(item.actorType)} #{String(item.actorId ?? '-')}
              </td>
              <td>{String(item.functionCode)}</td>
              <td>{String(item.action)}</td>
              <td>
                {String(item.entityName)} / {String(item.entityKey)}
              </td>
              <td>
                <Button
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
      <Pagination
        hasNext={list.hasMore}
        hasPrevious={list.hasPrevious}
        onNext={list.next}
        onPrevious={list.previous}
        isLoading={list.loading}
      />
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected('')}
        title="Chi tiết nhật ký"
      >
        {detail && (
          <>
            <p>Request ID: {String(detail.requestId ?? '-')}</p>
            <h3>Trước thay đổi</h3>
            <pre>{JSON.stringify(detail.oldData, null, 2)}</pre>
            <h3>Sau thay đổi</h3>
            <pre>{JSON.stringify(detail.newData, null, 2)}</pre>
          </>
        )}
      </Modal>
    </div>
  )
}
