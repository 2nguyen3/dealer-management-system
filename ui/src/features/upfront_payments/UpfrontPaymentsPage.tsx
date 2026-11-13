import {
  BadgeCheck,
  FileCheck2,
  Hourglass,
  PencilLine,
  ReceiptText,
  RefreshCw,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DateField } from '@/components/blocks/DateField'
import { PageHeader } from '@/components/blocks/PageHeader'
import { SortMenu } from '@/components/data/SortControls'
import { useSort } from '@/components/data/sorting'
import { CountUp } from '@/components/motion/Motion'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { EntityPicker } from '@/components/ui/EntityPicker'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table } from '@/components/ui/Table'
import { apiFetch } from '@/lib/api'
import { invalidateCache } from '@/lib/cache'
import { formatCompactVND } from '@/lib/chart'
import { formatDateTime, formatVND } from '@/lib/formatters'
import { enumOptions, methodLabel, statusLabel } from '@/lib/labels'
import { useAuth } from '../authentication/useAuth'
import {
  dateRangeParams,
  decimal,
  id,
  Intent,
  message,
  positiveMoney,
  record,
  text,
  vietnamInstant,
  type Row,
} from '../payment_receipts/contracts'
import { DetailList } from '../payment_receipts/DetailList'
import {
  ActionBar,
  ConfirmDialog,
  DetailHeader,
  FilterBar,
  FormActions,
  TableCard,
  TableSkeleton,
} from '../payment_receipts/financeUi'
import { groupTotals, upfrontLifecycle } from '../payment_receipts/flow'
import { FlowSteps } from '../payment_receipts/FlowSteps'
import { PageSummary } from '../payment_receipts/PageSummary'
import { useSourcePage } from '../payment_receipts/useSourcePage'
import { readyIssue, type ReadyIssue } from './readyIssue'

const UPFRONT_STATES = ['VERIFIED', 'CONSUMED', 'RECEIVED_SEPARATELY'] as const
/** Where each state sits in the flow (worded apart from the status badges). */
const STATE_GROUPS: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: 'Chờ phiếu xuất ghi sổ', color: 'var(--warning)' },
  CONSUMED: { label: 'Đã thành phiếu thu', color: 'var(--success)' },
  RECEIVED_SEPARATELY: { label: 'Thu riêng', color: 'var(--chart-3)' },
}
/** Server sort enum for GET /upfront-confirmations: createdAt, id (±). */
const SORT_OPTIONS = [{ field: 'createdAt', label: 'Thời điểm xác minh' }]

function dateTime(value: unknown): string {
  return typeof value === 'string' && value ? formatDateTime(value) : '—'
}

function confirmation(value: unknown): Row {
  const data = record(value)
  id(data.id)
  id(data.issueRevisionId)
  id(data.issueDocumentId)
  decimal(data.amount)
  if (
    !['VERIFIED', 'CONSUMED', 'RECEIVED_SEPARATELY'].includes(text(data.state))
  )
    throw new Error('Invalid upfront state')
  return data
}

/** Loads the picked stock issue and derives the READY revision to verify. */
function useReadyIssue(issueId: string) {
  const [state, setState] = useState<{
    issue: string
    data?: ReadyIssue
    error?: string
  }>({ issue: '' })
  useEffect(() => {
    if (!issueId) return
    const controller = new AbortController()
    let current = true
    apiFetch<unknown>(`/stock-issues/${id(issueId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const data = readyIssue(response.data)
        if (current) setState({ issue: issueId, data })
      })
      .catch((failure: unknown) => {
        if (current) setState({ issue: issueId, error: message(failure) })
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [issueId])
  if (!issueId) return undefined
  return state.issue === issueId ? state : { issue: issueId }
}

export function UpfrontPaymentsPage() {
  const { hasPermission } = useAuth()
  const canVerify = hasPermission('cash.upfront.verify')
  const canSeparate = hasPermission('cash.receipt.post')
  const [state, setState] = useState('')
  const [issueFilter, setIssueFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const range = dateRangeParams(
    fromDate,
    toDate,
    ['createdFrom', 'createdTo'],
    true,
  )
  const sorter = useSort()
  const list = useSourcePage(
    '/upfront-confirmations',
    {
      state,
      issueDocumentId: issueFilter,
      ...range.params,
      ...sorter.params,
    },
    confirmation,
  )
  const groups = groupTotals(list.items, 'state', 'amount', UPFRONT_STATES).map(
    (group) => ({ ...group, ...STATE_GROUPS[group.key]! }),
  )
  const group = (key: string) => groups.find((entry) => entry.key === key)
  const [formOpen, setFormOpen] = useState(false)
  const [issueId, setIssueId] = useState('')
  const [manual, setManual] = useState(false)
  const [manualRevision, setManualRevision] = useState('')
  const [amount, setAmount] = useState('')
  const [autoAmount, setAutoAmount] = useState(true)
  const [method, setMethod] = useState('CASH')
  const [receivedAt, setReceivedAt] = useState('')
  const [evidence, setEvidence] = useState('')
  const [reason, setReason] = useState('')
  const [confirmSeparate, setConfirmSeparate] = useState(false)
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<{
    item: Row
    etag: string | null
  } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const intent = useRef(new Intent())
  const picked = useReadyIssue(manual ? '' : issueId)
  const pickedIssue = picked?.data
  const revisionId = manual
    ? manualRevision
    : pickedIssue?.problem
      ? ''
      : (pickedIssue?.revisionId ?? '')
  // Until the user edits the amount, it follows the picked issue's upfront part.
  const effectiveAmount =
    autoAmount && !manual && pickedIssue && !pickedIssue.problem
      ? pickedIssue.immediatePayment
      : amount

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    let current = true
    apiFetch<unknown>(`/upfront-confirmations/${selected}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const item = confirmation(response.data)
        if (current) setDetail({ item, etag: response.etag })
      })
      .catch((failure: unknown) => {
        if (current) setError(message(failure))
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [selected])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canVerify) return
    setError('')
    try {
      if (!revisionId)
        throw new Error(
          manual
            ? 'Vui lòng nhập mã phiên bản phiếu xuất.'
            : 'Vui lòng chọn phiếu xuất đang ở trạng thái Sẵn sàng.',
        )
      if (!evidence.trim())
        throw new Error(
          'Cần thời điểm thực nhận có múi giờ và tham chiếu bằng chứng.',
        )
      const body = {
        issueRevisionId: id(revisionId),
        amount: positiveMoney(effectiveAmount),
        method,
        receivedAt: vietnamInstant(receivedAt),
        evidenceReference: evidence.trim(),
      }
      setBusy(true)
      await intent.current.send('/upfront-confirmations', {
        method: 'POST',
        body,
      })
      setNotice(
        'Đã xác minh khoản tiền. Phiếu thu sẽ được lập khi phiếu xuất được ghi sổ.',
      )
      setFormOpen(false)
      setIssueId('')
      setManualRevision('')
      setAmount('')
      setAutoAmount(true)
      setReceivedAt('')
      setEvidence('')
      invalidateCache('/upfront-confirmations')
      list.reload()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const separate = async () => {
    if (
      busy ||
      !canSeparate ||
      !detail?.etag ||
      detail.item.state !== 'VERIFIED' ||
      !reason.trim()
    )
      return
    setBusy(true)
    setError('')
    try {
      await intent.current.send(
        `/upfront-confirmations/${selected}/receive-separately`,
        {
          method: 'POST',
          ifMatch: detail.etag,
          body: { reason: reason.trim() },
        },
      )
      setNotice(
        'Đã lập phiếu thu riêng cho khoản tiền này. Trạng thái phiếu xuất không thay đổi.',
      )
      setDetail(null)
      setSelected('')
      for (const prefix of [
        '/upfront-confirmations',
        '/stock-issues',
        '/payment-receipts',
        '/agencies',
        '/receivables',
      ])
        invalidateCache(prefix)
      list.reload()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
      setConfirmSeparate(false)
    }
  }
  const item = detail?.item
  return (
    <div className="page-container space-y-6">
      <PageHeader
        eyebrow="Tài chính"
        title="Xác nhận thanh toán trả ngay"
        description="Xác minh tiền trả ngay → phiếu xuất ghi sổ → phiếu thu tự động (hoặc thu riêng)."
        className="mb-0"
        actions={
          canVerify && (
            <Button
              icon={<BadgeCheck className="size-4" />}
              onClick={() => {
                setError('')
                setFormOpen(true)
              }}
            >
              Ghi nhận tiền thực nhận
            </Button>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}
      {!list.loading && list.items.length > 0 && (
        <PageSummary
          title="Tổng quan khoản thực nhận"
          noun="khoản"
          total={list.items.length}
          groups={groups}
          kpis={[
            {
              label: 'Chờ phiếu xuất ghi sổ',
              icon: <Hourglass />,
              value: formatCompactVND(group('VERIFIED')?.amount ?? 0),
              hint: `${group('VERIFIED')?.count ?? 0} khoản`,
            },
            {
              label: 'Đã thành phiếu thu',
              icon: <ReceiptText />,
              value: formatCompactVND(group('CONSUMED')?.amount ?? 0),
              hint: `${group('CONSUMED')?.count ?? 0} khoản`,
            },
            {
              label: 'Thu riêng',
              icon: <Undo2 />,
              value: (
                <CountUp value={group('RECEIVED_SEPARATELY')?.count ?? 0} />
              ),
              hint: formatCompactVND(group('RECEIVED_SEPARATELY')?.amount ?? 0),
            },
          ]}
        />
      )}
      <FilterBar>
        <EntityPicker
          resource="stock-issues"
          label="Phiếu xuất"
          value={issueFilter}
          onChange={(value) => setIssueFilter(value)}
          placeholder="Tất cả phiếu xuất"
        />
        <Select
          label="Trạng thái"
          value={state}
          onChange={(event) => setState(event.target.value)}
          options={enumOptions(UPFRONT_STATES, statusLabel, 'Tất cả')}
        />
        <DateField
          label="Xác minh từ ngày"
          value={fromDate}
          onChange={setFromDate}
          max={toDate || undefined}
        />
        <DateField
          label="Đến ngày"
          value={toDate}
          onChange={setToDate}
          min={fromDate || undefined}
          error={range.error || undefined}
        />
        <Button
          variant="outline"
          icon={<RefreshCw className="size-4" />}
          onClick={list.reload}
        >
          Tải lại
        </Button>
      </FilterBar>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <TableCard
        title="Các khoản thực nhận"
        icon={<BadgeCheck />}
        actions={
          <SortMenu
            options={SORT_OPTIONS}
            sort={sorter.sort}
            onChange={sorter.setSort}
          />
        }
      >
        {list.loading ? (
          <TableSkeleton label="Đang tải khoản thực nhận..." />
        ) : !list.error && !list.items.length ? (
          <div className="p-4">
            <EmptyState title="Chưa có khoản thực nhận phù hợp." />
          </div>
        ) : (
          <Table caption="Danh sách khoản thực nhận">
            <thead>
              <tr>
                <th scope="col">Thời điểm nhận</th>
                <th scope="col">Phiếu xuất</th>
                <th scope="col">Hình thức</th>
                <th scope="col" className="cell-number">
                  Số tiền
                </th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Phiếu thu</th>
                <th scope="col" className="cell-actions">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={String(row.id)}>
                  <td className="tabular-nums">{dateTime(row.receivedAt)}</td>
                  <td>
                    <span className="font-medium">
                      #{String(row.issueDocumentId)}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      Phiên bản #{String(row.issueRevisionId)}
                    </div>
                  </td>
                  <td>{methodLabel(row.method)}</td>
                  <td className="cell-number font-medium">
                    {formatVND(String(row.amount))}
                  </td>
                  <td>
                    <StatusBadge status={String(row.state)} />
                  </td>
                  <td>
                    {row.receiptDocumentId
                      ? `#${String(row.receiptDocumentId)}`
                      : '—'}
                  </td>
                  <td className="cell-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Chi tiết khoản thực nhận phiếu xuất #${String(row.issueDocumentId)}`}
                      onClick={() => {
                        setDetail(null)
                        setReason('')
                        setSelected(String(row.id))
                      }}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination
          hasNext={list.hasMore}
          hasPrevious={list.hasPrevious}
          onNext={list.next}
          onPrevious={list.previous}
          isLoading={list.loading}
          totalShowing={list.loading ? undefined : list.items.length}
        />
      </TableCard>
      {canVerify && (
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title="Ghi nhận tiền thực nhận"
          maxWidth="lg"
        >
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}
            {!manual ? (
              <div className="space-y-3">
                <EntityPicker
                  resource="stock-issues"
                  label="Chọn phiếu xuất chờ ghi sổ"
                  value={issueId}
                  onChange={(value) => {
                    setIssueId(value)
                    setAutoAmount(true)
                  }}
                  params={{ status: 'PENDING' }}
                  placeholder="Tìm theo số phiếu hoặc đại lý"
                  required
                />
                {picked && !pickedIssue && !picked.error && (
                  <Skeleton className="h-16 w-full" />
                )}
                {picked?.error && <Alert type="error">{picked.error}</Alert>}
                {pickedIssue && <IssueSummary issue={pickedIssue} />}
              </div>
            ) : (
              <Input
                label="Mã phiên bản phiếu xuất (Sẵn sàng)"
                helperText="Số mã phiên bản của phiếu xuất đang ở trạng thái Sẵn sàng, xem trong chi tiết phiếu xuất."
                inputMode="numeric"
                value={manualRevision}
                onChange={(event) => setManualRevision(event.target.value)}
                required
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<PencilLine className="size-4" />}
              onClick={() => setManual((value) => !value)}
            >
              {manual
                ? 'Chọn từ danh sách phiếu xuất'
                : 'Nhập mã phiên bản thủ công'}
            </Button>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Số tiền (VND nguyên)"
                inputMode="numeric"
                className="text-right tabular-nums"
                value={effectiveAmount}
                onChange={(event) => {
                  setAutoAmount(false)
                  setAmount(event.target.value)
                }}
                helperText="Phải bằng khoản trả ngay của phiếu xuất."
                required
              />
              <Select
                label="Phương thức"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                options={enumOptions(['CASH', 'BANK_TRANSFER'], methodLabel)}
              />
              <Input
                label="Thời điểm thực nhận"
                type="datetime-local"
                helperText="Giờ Việt Nam (GMT+7)"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
                required
              />
              <Input
                label="Tham chiếu bằng chứng"
                placeholder="Số biên lai, mã chuyển khoản…"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                required
              />
            </div>
            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Đóng
              </Button>
              <Button type="submit" isLoading={busy}>
                Xác minh tiền thực nhận
              </Button>
            </FormActions>
          </form>
        </Modal>
      )}
      <Modal
        isOpen={!!selected}
        onClose={() => {
          setSelected('')
          setDetail(null)
        }}
        title="Chi tiết khoản thực nhận"
        maxWidth="lg"
      >
        {!item ? (
          <div role="status" className="space-y-3">
            <span className="sr-only">Đang tải chi tiết...</span>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <DetailHeader
              icon={<FileCheck2 />}
              code={`Phiếu xuất #${String(item.issueDocumentId)}`}
              badge={<StatusBadge status={String(item.state)} />}
              amount={formatVND(String(item.amount))}
              amountLabel="Số tiền thực nhận"
              meta={`Phiên bản #${String(item.issueRevisionId)}`}
              tone={item.state === 'VERIFIED' ? 'neutral' : 'success'}
            />
            {upfrontLifecycle(item.state) && (
              <FlowSteps
                label="Vòng đời khoản tiền"
                steps={upfrontLifecycle(item.state)!}
              />
            )}
            <DetailList
              entries={[
                ['Hình thức', methodLabel(item.method)],
                ['Thời điểm nhận', dateTime(item.receivedAt)],
                ['Xác minh lúc', dateTime(item.verifiedAt)],
                [
                  'Phiếu thu',
                  item.receiptDocumentId
                    ? `#${String(item.receiptDocumentId)}`
                    : 'Chưa có',
                ],
                [
                  'Bằng chứng',
                  typeof item.evidenceReference === 'string'
                    ? item.evidenceReference
                    : '—',
                ],
              ]}
            />
            {canSeparate && item.state === 'VERIFIED' && (
              <ActionBar>
                <Button
                  variant="outline"
                  icon={<Undo2 className="size-4" />}
                  disabled={busy || !detail?.etag}
                  onClick={() => setConfirmSeparate(true)}
                >
                  Ghi nhận tiền riêng
                </Button>
              </ActionBar>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        isOpen={confirmSeparate}
        onClose={() => setConfirmSeparate(false)}
        title="Ghi nhận tiền riêng"
        description="Lập phiếu thu riêng cho khoản tiền này thay vì dùng cho phiếu xuất. Trạng thái phiếu xuất không thay đổi."
        confirmLabel="Ghi nhận tiền riêng"
        busy={busy}
        disabled={busy || !detail?.etag || !reason.trim()}
        onConfirm={() => void separate()}
      >
        <Input
          label="Lý do ghi nhận tiền riêng"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </ConfirmDialog>
    </div>
  )
}

function IssueSummary({ issue }: { issue: ReadyIssue }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            {issue.code}
            {issue.agencyName ? ` · ${issue.agencyName}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            Phiên bản {issue.revisionNo} ({statusLabel(issue.revisionState)}) ·
            mã #{issue.revisionId}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Khoản trả ngay</p>
          <p className="font-semibold tabular-nums">
            {formatVND(issue.immediatePayment)}
          </p>
        </div>
      </div>
      {issue.problem ? (
        <p className="mt-2 text-xs font-medium text-destructive" role="alert">
          {issue.problem}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Sẽ xác minh cho phiên bản này; số tiền được điền theo khoản trả ngay.
        </p>
      )}
    </div>
  )
}
