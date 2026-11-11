import { BookOpenText, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/blocks/PageHeader'
import { SortableHeader, SortMenu } from '@/components/data/SortControls'
import { useSort } from '@/components/data/sorting'
import { Progress } from '@/components/shadcn/progress'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { EntityPicker } from '@/components/ui/EntityPicker'
import { Pagination } from '@/components/ui/Pagination'
import { Table } from '@/components/ui/Table'
import { formatPercent, toNumber } from '@/lib/chart'
import { formatVND } from '@/lib/formatters'
import { useAuth } from '../authentication/useAuth'
import {
  decimal,
  id,
  message,
  record,
  type Row,
} from '../payment_receipts/contracts'
import { SectionCard, TableSkeleton } from '../payment_receipts/financeUi'
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

/** Server sort enum for GET /agencies/{id}/credit-lots: createdAt, id (±). */
const LOT_SORTS = [
  { field: 'createdAt', label: 'Thời điểm phát sinh' },
  { field: 'id', label: 'Mã khoản' },
]

function Lots({ agencyId }: { agencyId: string }) {
  const sorter = useSort()
  const list = useSourcePage(
    `/agencies/${agencyId}/credit-lots`,
    sorter.params,
    lot,
  )
  return (
    <SectionCard
      title="Các khoản dư có"
      description="Dùng theo thứ tự cũ nhất trước."
      actions={
        <SortMenu
          options={LOT_SORTS}
          sort={sorter.sort}
          onChange={sorter.setSort}
        />
      }
    >
      {list.error && <Alert type="error">{list.error}</Alert>}
      <div className="overflow-hidden rounded-lg border">
        {list.loading ? (
          <TableSkeleton rows={3} label="Đang tải khoản dư có..." />
        ) : !list.error && !list.items.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            Đại lý chưa có khoản dư có nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Các khoản dư có">
              <thead>
                <tr>
                  <SortableHeader
                    field="id"
                    sort={sorter.sort}
                    onSort={sorter.toggle}
                  >
                    Khoản
                  </SortableHeader>
                  <th scope="col">Chứng từ nguồn</th>
                  <th scope="col">Phiếu thu gốc</th>
                  <th scope="col" className="cell-number">
                    Số dư
                  </th>
                  <th scope="col" className="cell-number">
                    Đang giữ
                  </th>
                  <th scope="col" className="cell-number">
                    Khả dụng
                  </th>
                  <th scope="col" className="min-w-32">
                    Tỷ lệ khả dụng
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={String(item.id)}>
                    <td className="font-medium">#{String(item.id)}</td>
                    <td>#{String(item.sourceDocumentId)}</td>
                    <td>#{String(item.originReceiptId)}</td>
                    <td className="cell-number">
                      {formatVND(String(item.balance))}
                    </td>
                    <td className="cell-number">
                      {formatVND(String(item.reserved))}
                    </td>
                    <td className="cell-number font-medium">
                      {formatVND(String(item.available))}
                    </td>
                    <td>
                      <LotRatio
                        id={String(item.id)}
                        available={String(item.available)}
                        balance={String(item.balance)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        <Pagination
          hasNext={list.hasMore}
          hasPrevious={list.hasPrevious}
          onNext={list.next}
          onPrevious={list.previous}
          isLoading={list.loading}
        />
      </div>
    </SectionCard>
  )
}

/** Available share of a lot's balance; the rest is reserved by a refund. */
function LotRatio({
  id,
  available,
  balance,
}: {
  id: string
  available: string
  balance: string
}) {
  const total = toNumber(balance)
  if (total <= 0)
    return <span className="text-xs text-muted-foreground">—</span>
  const ratio = Math.max(0, Math.min(1, toNumber(available) / total))
  return (
    <div className="flex items-center gap-2">
      <Progress
        value={ratio * 100}
        aria-label={`Tỷ lệ khả dụng khoản #${id}`}
        className="h-1.5 w-20 [&_[data-slot=progress-indicator]]:bg-success"
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatPercent(ratio)}
      </span>
    </div>
  )
}

export function AgencyCreditPage() {
  const { hasPermission } = useAuth()
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState('')
  const [selectedLabel, setSelectedLabel] = useState('')
  const [inputLabel, setInputLabel] = useState('')
  const [statement, setStatement] = useState(false)
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      setSelected(id(input))
      setSelectedLabel(inputLabel)
      setStatement(false)
      setError('')
    } catch (failure) {
      setError(message(failure))
    }
  }
  return (
    <div className="page-container space-y-6">
      <PageHeader
        eyebrow="Tài chính"
        title="Hạn mức & Dư có đại lý"
        description="Hạn mức nợ, cơ cấu dư có và từng khoản dư có của đại lý."
        className="mb-0"
      />
      <form
        onSubmit={submit}
        data-slot="filter-bar"
        className="grid grid-cols-1 items-end gap-3 rounded-xl border bg-card p-4 shadow-xs sm:grid-cols-[minmax(0,28rem)_auto]"
      >
        <EntityPicker
          resource="agencies"
          label="Đại lý"
          value={input}
          onChange={(value, item) => {
            setInput(value)
            setInputLabel(item?.label ?? '')
          }}
          required
        />
        <Button type="submit" icon={<Search className="size-4" />}>
          Xem dư có
        </Button>
      </form>
      {error && <Alert type="error">{error}</Alert>}
      {!selected ? (
        <EmptyState
          title="Chưa chọn đại lý"
          description="Chọn đại lý ở trên để xem hạn mức và dư có."
        />
      ) : (
        <div className="space-y-6">
          {selectedLabel && (
            <h2 className="text-lg font-semibold tracking-tight">
              {selectedLabel}
            </h2>
          )}
          <Balance key={`balance-${selected}`} agencyId={selected} />
          <Lots key={selected} agencyId={selected} />
          {hasPermission('debt.read') && !statement && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                icon={<BookOpenText className="size-4" />}
                onClick={() => setStatement(true)}
              >
                Mở sổ dư có
              </Button>
            </div>
          )}
          {statement && (
            <SourceStatement
              key={`statement-${selected}`}
              path={`/agencies/${selected}/credit-entries`}
              title="Sổ dư có"
              opening="openingCredit"
              closing="closingCredit"
              chart
              chartTitle="Diễn biến dư có"
              increaseLabel="Tăng dư có"
              decreaseLabel="Giảm dư có"
            />
          )}
        </div>
      )}
    </div>
  )
}
