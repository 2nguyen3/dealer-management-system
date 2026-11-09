import { useState, type ReactNode } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { useAuth } from '../authentication/useAuth'
import {
  canReadKind,
  documentKinds,
  parseSummary,
  type DocumentKind,
  type DocumentSummary,
} from './documentContracts'
import { useDocumentPage } from './useDocumentRequests'

export function DocumentList({
  kind,
  posted = false,
  version = 0,
  actions,
}: {
  kind?: DocumentKind
  posted?: boolean
  version?: number
  actions: (row: DocumentSummary) => ReactNode
}) {
  const { hasPermission } = useAuth()
  const [draft, setDraft] = useState({
    q: '',
    status: '',
    kind: kind ?? '',
    fromDate: '',
    toDate: '',
    agencyId: '',
  })
  const [filters, setFilters] = useState('')
  const [limit, setLimit] = useState(25)
  const [cursors, setCursors] = useState<string[]>([''])
  const allowed = kind
    ? canReadKind(kind, hasPermission)
    : Object.keys(documentKinds).some((item) =>
        canReadKind(item as DocumentKind, hasPermission),
      )
  const query = new URLSearchParams(filters)
  query.set('limit', String(limit))
  query.set('sort', '-businessDate')
  if (posted) query.set('status', 'POSTED')
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!)
  const path = `${kind ? documentKinds[kind].path : '/documents'}?${query}`
  // Version changes trigger only this active list, not unrelated master/ledger reads.
  const data = useDocumentPage(allowed ? path : null, parseSummary, version)
  if (!allowed) return <Alert type="error">Không có quyền đọc chứng từ.</Alert>
  return (
    <>
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault()
          const params = new URLSearchParams()
          for (const [name, value] of Object.entries(draft))
            if (value && (!kind || name !== 'kind')) params.set(name, value)
          setCursors([''])
          setFilters(params.toString())
        }}
      >
        <Input
          label="Tìm chứng từ"
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
        />
        {!kind && (
          <Select
            label="Loại chứng từ"
            value={draft.kind}
            onChange={(event) =>
              setDraft({ ...draft, kind: event.target.value })
            }
            options={[
              { value: '', label: 'Tất cả loại được phép' },
              ...Object.entries(documentKinds)
                .filter(([key]) =>
                  canReadKind(key as DocumentKind, hasPermission),
                )
                .map(([value, item]) => ({ value, label: item.title })),
            ]}
          />
        )}
        {!posted && (
          <Select
            label="Trạng thái"
            value={draft.status}
            onChange={(event) =>
              setDraft({ ...draft, status: event.target.value })
            }
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              ...['DRAFT', 'PENDING', 'POSTED', 'CANCELLED'].map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
        )}
        <Input
          label="Từ ngày"
          type="date"
          value={draft.fromDate}
          onChange={(event) =>
            setDraft({ ...draft, fromDate: event.target.value })
          }
        />
        <Input
          label="Đến ngày (không gồm)"
          type="date"
          value={draft.toDate}
          onChange={(event) =>
            setDraft({ ...draft, toDate: event.target.value })
          }
        />
        <Button type="submit">Áp dụng bộ lọc</Button>
      </form>
      {data.error && (
        <Alert type="error">
          {data.error}
          <Button onClick={data.reload}>Thử tải lại</Button>
        </Alert>
      )}
      {data.loading ? (
        <Spinner label="Đang tải chứng từ..." />
      ) : (
        data.page && (
          <div className="card">
            <Table caption="Danh sách chứng từ">
              <thead>
                <tr>
                  <th>Mã chứng từ</th>
                  <th>Loại</th>
                  <th>Đại lý</th>
                  <th>Ngày nghiệp vụ</th>
                  <th>Tổng tiền (VNĐ)</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.page.items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{documentKinds[row.kind].title}</td>
                    <td>{row.agencyName ?? row.agencyId ?? '-'}</td>
                    <td>{row.businessDate}</td>
                    <td>{row.totalAmount}</td>
                    <td>
                      {row.status} / v{row.revisionNo}
                    </td>
                    <td>{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {!data.page.items.length && <p>Không có chứng từ phù hợp.</p>}
            <Pagination
              limit={limit}
              onLimitChange={(value) => {
                setLimit(value)
                setCursors([''])
              }}
              totalShowing={data.page.items.length}
              hasNext={data.page.pagination.hasMore}
              hasPrevious={cursors.length > 1}
              onNext={() => {
                if (data.page?.pagination.nextCursor)
                  setCursors([...cursors, data.page.pagination.nextCursor])
              }}
              onPrevious={() => setCursors(cursors.slice(0, -1))}
            />
          </div>
        )
      )}
    </>
  )
}
