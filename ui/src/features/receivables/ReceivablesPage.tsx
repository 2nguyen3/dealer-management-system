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

const totalLabels: Record<string, string> = {
  currentDebt: 'Dư nợ',
  currentCredit: 'Dư có',
  reservedCredit: 'Dư có giữ chỗ',
  availableCredit: 'Dư có khả dụng',
}

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
    <section className="receivable-invoices">
      <h3>Số dư hóa đơn</h3>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <Table caption="Số dư hóa đơn">
        <thead>
          <tr>
            <th scope="col">Phiếu xuất</th>
            <th scope="col">Ngày</th>
            <th scope="col" className="cell-number">
              Tổng tiền
            </th>
            <th scope="col" className="cell-number">Còn nợ</th>
            <th scope="col">Thanh toán</th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((item) => (
            <tr key={String(item.issueDocumentId)}>
              <td>{String(item.code)}</td>
              <td>{formatDate(String(item.businessDate))}</td>
              <td className="cell-number">
                {formatVND(String(item.totalAmount))}
              </td>
              <td className="cell-number">
                {formatVND(String(item.outstandingAmount))}
              </td>
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Công nợ đại lý</h1>
          <p className="page-desc">
            Dư nợ và hạn mức còn lại của từng đại lý, do máy chủ tổng hợp.
          </p>
        </div>
      </div>
      <div className="filter-bar filter-bar--row">
        <Input
          label="Tìm theo mã hoặc tên đại lý"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.metadata?.totals !== undefined && (
        <section
          className="card receivable-totals"
          aria-label="Tổng theo bộ lọc"
        >
          <h3>Tổng theo bộ lọc (máy chủ)</h3>
          <dl className="receivable-totals-grid">
            {Object.entries(record(list.metadata.totals)).map(([key, value]) => (
              <div key={key}>
                <dt>{totalLabels[key] ?? key}</dt>
                <dd>{formatVND(decimal(value))}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {!list.loading && !list.error && list.items.length === 0 ? (
        <div className="card empty-card">
          <p>Không tìm thấy đại lý nào phù hợp với điều kiện tìm kiếm.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Công nợ đại lý">
            <thead>
              <tr>
                <th scope="col">Mã đại lý</th>
                <th scope="col">Tên đại lý</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Dư nợ
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Hạn mức còn lại
                </th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => {
                const open = () => {
                  setSelected(String(item.agencyId))
                  setStatement(false)
                }
                return (
                  <tr key={String(item.agencyId)}>
                    <td>{String(item.agencyCode)}</td>
                    <td>{String(item.agencyName)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatVND(String(item.currentDebt))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatVND(String(item.remainingCreditLimit))}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button onClick={open}>Chi tiết</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          <Pagination
            hasNext={list.hasMore}
            hasPrevious={list.hasPrevious}
            onNext={list.next}
            onPrevious={list.previous}
            isLoading={list.loading}
            totalShowing={list.items.length}
          />
        </div>
      )}
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
            {!statement && (
              <div className="receivable-modal-actions">
                <Button variant="outline" onClick={() => setStatement(true)}>
                  Mở sổ công nợ
                </Button>
              </div>
            )}
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
