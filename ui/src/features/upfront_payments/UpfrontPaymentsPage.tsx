import {
  BadgeCheck,
  FileCheck2,
  Hourglass,
  PencilLine,
  ReceiptText,
  RefreshCw,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useInRouterContext, useSearchParams } from 'react-router'
import { DateField } from '@/components/blocks/DateField'
import { notifyNextStep } from '@/components/guide/notifyNextStep'
import { WorkflowSteps } from '@/components/guide/WorkflowSteps'
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
import { t } from '@/lib/i18n/core'
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
import { ROLES } from '../guide/workflows'
import { readyIssue, type ReadyIssue } from './readyIssue'

const ISSUE_ID = /^[1-9][0-9]{0,18}$/

/**
 * Reads `?issue=<id>` (filter the list) and `?issue=<id>&new=1` (open the
 * verification form with that stock issue preselected), then removes the
 * one-shot `new` flag so a refresh does not reopen the form.
 */
function UpfrontDeepLink({
  onFilter,
  onOpen,
}: {
  onFilter: (issueId: string) => void
  onOpen: (issueId: string) => void
}) {
  const [params, setParams] = useSearchParams()
  const issue = params.get('issue') ?? ''
  const open = params.get('new') === '1'
  useEffect(() => {
    if (!ISSUE_ID.test(issue)) return
    if (open) {
      onOpen(issue)
      const next = new URLSearchParams(params)
      next.delete('new')
      next.delete('issue')
      setParams(next, { replace: true })
    } else onFilter(issue)
  }, [issue, open, params, setParams, onFilter, onOpen])
  return null
}

/** Rail for the verification form: pick issue → enter evidence → verify. */
function verifySteps(picked: boolean, evidence: boolean) {
  return [
    {
      key: 'pick',
      label: t('Chọn phiếu xuất đang chờ'),
      role: t(ROLES.accounting),
      state: picked ? ('done' as const) : ('current' as const),
      hint: t(
        'Chỉ phiếu đã nộp (Sẵn sàng) có khoản trả ngay và chưa được xác nhận.',
      ),
    },
    {
      key: 'evidence',
      label: t('Nhập bằng chứng tiền'),
      role: t(ROLES.accounting),
      state: !picked
        ? ('todo' as const)
        : evidence
          ? ('done' as const)
          : ('current' as const),
      hint: t(
        'Số tiền đúng bằng khoản trả ngay, thời điểm thực nhận và số biên lai/mã chuyển khoản.',
      ),
    },
    {
      key: 'verify',
      label: t('Xác minh'),
      role: t(ROLES.accounting),
      state: picked && evidence ? ('current' as const) : ('todo' as const),
      hint: t(
        'Sau khi xác minh, Kho ghi sổ phiếu xuất; khoản tiền tự thành phiếu thu.',
      ),
    },
  ]
}

const UPFRONT_STATES = ['VERIFIED', 'CONSUMED', 'RECEIVED_SEPARATELY'] as const
/** Where each state sits in the flow (worded apart from the status badges). */
const STATE_GROUPS: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: t('Chờ phiếu xuất ghi sổ'), color: 'var(--warning)' },
  CONSUMED: { label: t('Đã thành phiếu thu'), color: 'var(--success)' },
  RECEIVED_SEPARATELY: { label: t('Thu riêng'), color: 'var(--chart-3)' },
}
/** Server sort enum for GET /upfront-confirmations: createdAt, id (±). */
const SORT_OPTIONS = [{ field: 'createdAt', label: t('Thời điểm xác minh') }]

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
  const inRouter = useInRouterContext()
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

  const openFor = useCallback(
    (issue: string) => {
      setIssueId(issue)
      setManual(false)
      setAutoAmount(true)
      setError('')
      setFormOpen(true)
    },
    [setIssueId, setManual, setAutoAmount, setError, setFormOpen],
  )
  const filterFor = useCallback(
    (issue: string) => setIssueFilter(issue),
    [setIssueFilter],
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canVerify) return
    setError('')
    try {
      if (!revisionId)
        throw new Error(
          manual
            ? t('Vui lòng nhập mã phiên bản phiếu xuất.')
            : t('Vui lòng chọn phiếu xuất đang ở trạng thái Sẵn sàng.'),
        )
      if (!evidence.trim())
        throw new Error(
          t('Cần thời điểm thực nhận có múi giờ và tham chiếu bằng chứng.'),
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
        t(
          'Đã xác minh khoản tiền. Phiếu thu sẽ được lập khi phiếu xuất được ghi sổ.',
        ),
      )
      notifyNextStep({
        done: t('Đã xác minh khoản trả ngay {code}.', {
          code: pickedIssue?.code ?? `#${revisionId}`,
        }),
        next: t(
          'Bước tiếp: Kho ghi sổ phiếu xuất; khoản tiền sẽ tự thành phiếu thu.',
        ),
        ...(hasPermission('stock.issue.post') ||
        hasPermission('stock.issue.prepare') ||
        hasPermission('debt.read') ||
        hasPermission('sales.read')
          ? { to: '/stock-issues' }
          : {}),
      })
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
        t(
          'Đã lập phiếu thu riêng cho khoản tiền này. Trạng thái phiếu xuất không thay đổi.',
        ),
      )
      notifyNextStep({
        done: t('Đã ghi nhận tiền riêng thành phiếu thu.'),
        next: t(
          'Phiếu xuất cần thay nội dung (phiên bản mới) và nộp lại; không nhập lại số tiền đã thu riêng vào trả ngay.',
        ),
        ...(hasPermission('stock.issue.prepare')
          ? { to: '/stock-issues' }
          : {}),
      })
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
      {inRouter && canVerify && (
        <UpfrontDeepLink onFilter={filterFor} onOpen={openFor} />
      )}
      <PageHeader
        eyebrow={t('Tài chính')}
        title={t('Xác nhận thanh toán trả ngay')}
        description={t(
          'Xác minh tiền trả ngay → phiếu xuất ghi sổ → phiếu thu tự động (hoặc thu riêng).',
        )}
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
              {t('Ghi nhận tiền thực nhận')}
            </Button>
          )
        }
      />
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="info">{notice}</Alert>}
      {!list.loading && list.items.length > 0 && (
        <PageSummary
          title={t('Tổng quan khoản thực nhận')}
          noun={t('khoản')}
          total={list.items.length}
          groups={groups}
          kpis={[
            {
              label: t('Chờ phiếu xuất ghi sổ'),
              icon: <Hourglass />,
              value: formatCompactVND(group('VERIFIED')?.amount ?? 0),
              hint: t('{count} khoản', {
                count: group('VERIFIED')?.count ?? 0,
              }),
            },
            {
              label: t('Đã thành phiếu thu'),
              icon: <ReceiptText />,
              value: formatCompactVND(group('CONSUMED')?.amount ?? 0),
              hint: t('{count} khoản', {
                count: group('CONSUMED')?.count ?? 0,
              }),
            },
            {
              label: t('Thu riêng'),
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
          label={t('Phiếu xuất')}
          value={issueFilter}
          onChange={(value) => setIssueFilter(value)}
          placeholder={t('Tất cả phiếu xuất')}
        />
        <Select
          label={t('Trạng thái')}
          value={state}
          onChange={(event) => setState(event.target.value)}
          options={enumOptions(UPFRONT_STATES, statusLabel, t('Tất cả'))}
        />
        <DateField
          label={t('Xác minh từ ngày')}
          value={fromDate}
          onChange={setFromDate}
          max={toDate || undefined}
        />
        <DateField
          label={t('Đến ngày')}
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
          {t('Tải lại')}
        </Button>
      </FilterBar>
      {list.error && <Alert type="error">{list.error}</Alert>}
      <TableCard
        title={t('Các khoản thực nhận')}
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
          <TableSkeleton label={t('Đang tải khoản thực nhận...')} />
        ) : !list.error && !list.items.length ? (
          <div className="p-4">
            <EmptyState title={t('Chưa có khoản thực nhận phù hợp.')} />
          </div>
        ) : (
          <Table caption={t('Danh sách khoản thực nhận')}>
            <thead>
              <tr>
                <th scope="col">{t('Thời điểm nhận')}</th>
                <th scope="col">{t('Phiếu xuất')}</th>
                <th scope="col">{t('Hình thức')}</th>
                <th scope="col" className="cell-number">
                  {t('Số tiền')}
                </th>
                <th scope="col">{t('Trạng thái')}</th>
                <th scope="col">{t('Phiếu thu')}</th>
                <th scope="col" className="cell-actions">
                  {t('Thao tác')}
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
                      {t('Phiên bản #{issueRevisionId}', {
                        issueRevisionId: String(row.issueRevisionId),
                      })}
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
                      aria-label={t(
                        'Chi tiết khoản thực nhận phiếu xuất #{issueDocumentId}',
                        { issueDocumentId: String(row.issueDocumentId) },
                      )}
                      onClick={() => {
                        setDetail(null)
                        setReason('')
                        setSelected(String(row.id))
                      }}
                    >
                      {t('Chi tiết')}
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
          title={t('Ghi nhận tiền thực nhận')}
          maxWidth="lg"
        >
          <form onSubmit={submit} className="space-y-4">
            <WorkflowSteps
              label={t('Các bước xác nhận trả ngay')}
              steps={verifySteps(
                manual ? !!manualRevision : !!revisionId,
                !!evidence.trim() && !!receivedAt,
              )}
            />
            {error && <Alert type="error">{error}</Alert>}
            {!manual ? (
              <div className="space-y-3">
                <EntityPicker
                  resource="stock-issues"
                  label={t('Chọn phiếu xuất chờ ghi sổ')}
                  value={issueId}
                  onChange={(value) => {
                    setIssueId(value)
                    setAutoAmount(true)
                  }}
                  params={{ status: 'PENDING' }}
                  placeholder={t('Tìm theo số phiếu hoặc đại lý')}
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
                label={t('Mã phiên bản phiếu xuất (Sẵn sàng)')}
                helperText={t(
                  'Số mã phiên bản của phiếu xuất đang ở trạng thái Sẵn sàng, xem trong chi tiết phiếu xuất.',
                )}
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
                ? t('Chọn từ danh sách phiếu xuất')
                : t('Nhập mã phiên bản thủ công')}
            </Button>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('Số tiền (VND nguyên)')}
                inputMode="numeric"
                className="text-end tabular-nums"
                value={effectiveAmount}
                onChange={(event) => {
                  setAutoAmount(false)
                  setAmount(event.target.value)
                }}
                helperText={t('Phải bằng khoản trả ngay của phiếu xuất.')}
                required
              />
              <Select
                label={t('Phương thức')}
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                options={enumOptions(['CASH', 'BANK_TRANSFER'], methodLabel)}
              />
              <Input
                label={t('Thời điểm thực nhận')}
                type="datetime-local"
                helperText={t('Giờ Việt Nam (GMT+7)')}
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
                required
              />
              <Input
                label={t('Tham chiếu bằng chứng')}
                placeholder={t('Số biên lai, mã chuyển khoản…')}
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
                {t('Đóng')}
              </Button>
              <Button type="submit" isLoading={busy}>
                {t('Xác minh tiền thực nhận')}
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
        title={t('Chi tiết khoản thực nhận')}
        maxWidth="lg"
      >
        {!item ? (
          <div role="status" className="space-y-3">
            <span className="sr-only">{t('Đang tải chi tiết...')}</span>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <DetailHeader
              icon={<FileCheck2 />}
              code={t('Phiếu xuất #{issueDocumentId}', {
                issueDocumentId: String(item.issueDocumentId),
              })}
              badge={<StatusBadge status={String(item.state)} />}
              amount={formatVND(String(item.amount))}
              amountLabel={t('Số tiền thực nhận')}
              meta={t('Phiên bản #{issueRevisionId}', {
                issueRevisionId: String(item.issueRevisionId),
              })}
              tone={item.state === 'VERIFIED' ? 'neutral' : 'success'}
            />
            {upfrontLifecycle(item.state) && (
              <FlowSteps
                label={t('Vòng đời khoản tiền')}
                steps={upfrontLifecycle(item.state)!}
              />
            )}
            <DetailList
              entries={[
                [t('Hình thức'), methodLabel(item.method)],
                [t('Thời điểm nhận'), dateTime(item.receivedAt)],
                [t('Xác minh lúc'), dateTime(item.verifiedAt)],
                [
                  t('Phiếu thu'),
                  item.receiptDocumentId
                    ? `#${String(item.receiptDocumentId)}`
                    : t('Chưa có'),
                ],
                [
                  t('Bằng chứng'),
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
                  {t('Ghi nhận tiền riêng')}
                </Button>
              </ActionBar>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        isOpen={confirmSeparate}
        onClose={() => setConfirmSeparate(false)}
        title={t('Ghi nhận tiền riêng')}
        description={t(
          'Lập phiếu thu riêng cho khoản tiền này thay vì dùng cho phiếu xuất. Trạng thái phiếu xuất không thay đổi.',
        )}
        confirmLabel={t('Ghi nhận tiền riêng')}
        busy={busy}
        disabled={busy || !detail?.etag || !reason.trim()}
        onConfirm={() => void separate()}
      >
        <Input
          label={t('Lý do ghi nhận tiền riêng')}
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
            {t('Phiên bản {revisionNo} ({statusLabel}) · mã #{revisionId}', {
              revisionNo: issue.revisionNo,
              statusLabel: statusLabel(issue.revisionState),
              revisionId: issue.revisionId,
            })}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{t('Khoản trả ngay')}</p>
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
          {t(
            'Sẽ xác minh cho phiên bản này; số tiền được điền theo khoản trả ngay.',
          )}
        </p>
      )}
    </div>
  )
}
