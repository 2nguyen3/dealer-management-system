import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { Table } from '../../components/ui/Table'
import { formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import {
  decimal,
  id,
  message,
  record,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { Balance } from '../receivables/Balance'
import { SourceStatement } from '../receivables/SourceStatement'

function lot(value: unknown): Row {
  const data = record(value)
  id(data.id)
  id(data.originReceiptId)
  id(data.sourceDocumentId)
  decimal(data.balance)
  decimal(data.reserved)
  decimal(data.available)
  return data
}

function Lots({ agencyId }: { agencyId: string }) {
  const list = useSourcePage(`/agencies/${agencyId}/credit-lots`, {}, lot)
  return (
    <section className="card">
      <h2>Các lô dư có</h2>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <Table caption="Lô dư có">
        <thead>
          <tr>
            <th>Lô</th>
            <th>Chứng từ nguồn</th>
            <th>Phiếu thu gốc</th>
            <th>Số dư</th>
            <th>Giữ chỗ</th>
            <th>Khả dụng</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((item) => (
            <tr key={String(item.id)}>
              <td>#{String(item.id)}</td>
              <td>#{String(item.sourceDocumentId)}</td>
              <td>#{String(item.originReceiptId)}</td>
              <td>{formatVND(String(item.balance))}</td>
              <td>{formatVND(String(item.reserved))}</td>
              <td>{formatVND(String(item.available))}</td>
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
    </section>
  )
}

export function AgencyCreditPage() {
  const { hasPermission } = useAuth()
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState('')
  const [statement, setStatement] = useState(false)
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      setSelected(id(input))
      setStatement(false)
      setError('')
    } catch (failure) {
      setError(message(failure))
    }
  }
  return (
    <div className="page-container">
      <h1 className="page-title">Hạn mức & Dư có đại lý</h1>
      <form onSubmit={submit} className="filter-bar filter-bar--row">
        <Input
          label="ID đại lý"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          required
        />
        <Button type="submit">Xem dư có</Button>
      </form>
      {error && <Alert type="error">{error}</Alert>}
      {selected && (
        <>
          <Balance key={`balance-${selected}`} agencyId={selected} />
          <Lots key={selected} agencyId={selected} />
          {hasPermission('debt.read') && (
            <Button onClick={() => setStatement(true)}>Mở sổ dư có</Button>
          )}
          {statement && (
            <SourceStatement
              key={`statement-${selected}`}
              path={`/agencies/${selected}/credit-entries`}
              title="Sổ dư có"
              opening="openingCredit"
              closing="closingCredit"
            />
          )}
        </>
      )}
    </div>
  )
}
