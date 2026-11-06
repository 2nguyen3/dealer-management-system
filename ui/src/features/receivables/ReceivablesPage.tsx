import { useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Table } from '../../components/ui/Table'
import { formatDate, formatVND } from '../../lib/formatters'
import {
  businessDate,
  decimal,
  id,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { Balance } from './Balance'
import { SourceStatement } from './SourceStatement'

function overview(value: unknown): Row {
  const data = record(value)
  id(data.agencyId)
  text(data.agencyCode)
  text(data.agencyName)
  decimal(data.currentDebt)
  decimal(data.remainingCreditLimit)
  return data
}
function invoice(value: unknown): Row {
  const data = record(value)
  id(data.issueDocumentId)
  text(data.code)
  businessDate(data.businessDate)
  decimal(data.totalAmount)
  decimal(data.outstandingAmount)
  return data
}
function Invoices({ agencyId }: { agencyId: string }) {
  const list = useSourcePage(
    `/agencies/${agencyId}/invoice-balances`,
    { sort: 'businessDate' },
    invoice,
  )
  return (
    <section>
      <h3>Số dư hóa đơn</h3>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <Table caption="Số dư hóa đơn">
        <thead>
          <tr>
            <th>Phiếu xuất</th>
            <th>Ngày</th>
            <th>Tổng tiền</th>
            <th>Còn nợ</th>
            <th>Thanh toán</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((item) => (
            <tr key={String(item.issueDocumentId)}>
              <td>{String(item.code)}</td>
              <td>{formatDate(String(item.businessDate))}</td>
              <td>{formatVND(String(item.totalAmount))}</td>
              <td>{formatVND(String(item.outstandingAmount))}</td>
              <td>{String(item.settlementStatus)}</td>
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
export function ReceivablesPage() {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState('')
  const [statement, setStatement] = useState(false)
  const list = useSourcePage('/receivables', { q }, overview)
  return (
    <div className="page-container">
      <h1 className="page-title">Công nợ đại lý</h1>
      <Input
        label="Tìm theo mã hoặc tên đại lý"
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.metadata?.totals !== undefined && (
        <div className="card">
          <h2>Tổng theo bộ lọc (máy chủ)</h2>
          {Object.entries(record(list.metadata.totals)).map(([key, value]) => (
            <p key={key}>
              {key}: {formatVND(decimal(value))}
            </p>
          ))}
        </div>
      )}
      <Table caption="Công nợ đại lý">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Đại lý</th>
            <th>Dư nợ</th>
            <th>Hạn mức còn lại</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((item) => (
            <tr key={String(item.agencyId)}>
              <td>{String(item.agencyCode)}</td>
              <td>{String(item.agencyName)}</td>
              <td>{formatVND(String(item.currentDebt))}</td>
              <td>{formatVND(String(item.remainingCreditLimit))}</td>
              <td>
                <Button
                  onClick={() => {
                    setSelected(String(item.agencyId))
                    setStatement(false)
                  }}
                >
                  Xem hóa đơn
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
        title={`Chi tiết công nợ #${selected}`}
        maxWidth="lg"
      >
        {selected && (
          <>
            <Balance key={`balance-${selected}`} agencyId={selected} />
            <Invoices key={selected} agencyId={selected} />
            <Button onClick={() => setStatement(true)}>Mở sổ công nợ</Button>
            {statement && (
              <SourceStatement
                key={`statement-${selected}`}
                path={`/agencies/${selected}/receivable-entries`}
                title="Sổ công nợ"
                opening="openingDebt"
                closing="closingDebt"
              />
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
