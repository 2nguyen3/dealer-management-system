import { useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Table } from '../../components/ui/Table'
import { formatDate } from '../../lib/formatters'
import {
  businessDate,
  decimal,
  id,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'

function entry(value: unknown): Row {
  const data = record(value)
  id(data.id)
  id(data.sourceDocumentId)
  text(data.sourceDocumentCode)
  businessDate(data.businessDate)
  decimal(data.balanceAfter)
  decimal(data.quantityDelta ?? data.amountDelta)
  if (typeof data.isEffective !== 'boolean')
    throw new Error('Invalid effective entry')
  return data
}

export function SourceStatement({
  path,
  title,
  opening,
  closing,
}: {
  path: string
  title: string
  opening: string
  closing: string
}) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [effectiveOnly, setEffectiveOnly] = useState('true')
  const list = useSourcePage(
    path,
    { fromDate, toDate, effectiveOnly, sort: 'businessDate' },
    entry,
  )
  return (
    <section className="card statement-card">
      <h2 className="statement-title">{title}</h2>
      <div className="filter-bar filter-bar--row">
        <Input
          label="Từ ngày"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <Input
          label="Đến ngày (không bao gồm)"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
        <Select
          label="Hiệu lực"
          value={effectiveOnly}
          onChange={(event) => setEffectiveOnly(event.target.value)}
          options={[
            { value: 'true', label: 'Còn hiệu lực' },
            { value: 'false', label: 'Gồm dòng đảo' },
          ]}
        />
        <Button onClick={list.reload}>Tải lại</Button>
      </div>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.metadata && (
        <dl className="statement-summary">
          <div>
            <dt>Đầu kỳ</dt>
            <dd>{decimal(list.metadata[opening])}</dd>
          </div>
          <div>
            <dt>Cuối kỳ</dt>
            <dd>{decimal(list.metadata[closing])}</dd>
          </div>
          {list.metadata.unitId !== undefined && (
            <div>
              <dt>Đơn vị</dt>
              <dd>#{String(list.metadata.unitId)}</dd>
            </div>
          )}
        </dl>
      )}
      <Table caption={title}>
        <thead>
          <tr>
            <th>Ngày nghiệp vụ</th>
            <th>Nguồn / Revision</th>
            <th>Biến động</th>
            <th>Số dư sau</th>
            <th>Hiệu lực</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((item) => (
            <tr key={String(item.id)}>
              <td>{formatDate(String(item.businessDate))}</td>
              <td>
                {String(item.sourceDocumentCode)} /{' '}
                {String(item.sourceRevisionNo)}
              </td>
              <td>{String(item.quantityDelta ?? item.amountDelta)}</td>
              <td>{String(item.balanceAfter)}</td>
              <td>{item.isEffective ? 'Hiệu lực' : 'Đã đảo'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!list.loading && !list.error && !list.items.length && (
        <p className="statement-empty">Không có biến động trong bộ lọc.</p>
      )}
      <Pagination
        hasNext={list.hasMore}
        hasPrevious={list.hasPrevious}
        onNext={list.next}
        onPrevious={list.previous}
        isLoading={list.loading}
        totalShowing={list.items.length}
      />
    </section>
  )
}
