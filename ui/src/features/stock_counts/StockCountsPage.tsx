import {
  ClipboardCheck,
  ClipboardList,
  ListPlus,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Card } from '../../components/shadcn/card'
import { Separator } from '../../components/shadcn/separator'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Table } from '../../components/ui/Table'
import { ApiError, apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { formatDateTime, formatQuantity } from '../../lib/formatters'
import { statusLabel } from '../../lib/labels'
import { useAuth } from '../authentication/useAuth'
import { exact, isZero, validId } from '../document_history/documentContracts'
import {
  Fact,
  FactGrid,
  Hint,
  SegmentedFilter,
  TableSkeleton,
} from '../document_history/DocumentParts'
import {
  errorMessage,
  useDocumentMutation,
  useDocumentPage,
} from '../document_history/useDocumentRequests'
import {
  canConfirmCount,
  parseCount,
  validInstant,
  type CountLine,
  type StockCount,
} from './countContracts'

type Variance = 'match' | 'surplus' | 'shortage'
function variance(difference: string): Variance {
  if (isZero(difference)) return 'match'
  return difference.startsWith('-') ? 'shortage' : 'surplus'
}
const varianceBadge: Record<
  Variance,
  { label: string; tone: 'success' | 'info' | 'danger' }
> = {
  match: { label: 'Khớp', tone: 'success' },
  surplus: { label: 'Thừa', tone: 'info' },
  shortage: { label: 'Thiếu', tone: 'danger' },
}
function varianceCounts(lines: CountLine[]) {
  const counts = { match: 0, surplus: 0, shortage: 0 }
  for (const line of lines) counts[variance(line.difference)] += 1
  return counts
}

/** Signed difference with an explicit plus sign; zero stays plain. */
function Difference({ value }: { value: string }) {
  if (isZero(value)) return <span className="text-muted-foreground">0</span>
  const down = value.startsWith('-')
  return (
    <span
      className={cn(
        'font-semibold',
        down ? 'doc-diff--down text-destructive' : 'doc-diff--up text-success',
      )}
    >
      {down ? '' : '+'}
      {formatQuantity(value)}
    </span>
  )
}

function VarianceBadge({ difference }: { difference: string }) {
  const badge = varianceBadge[variance(difference)]
  return <Badge variant={badge.tone}>{badge.label}</Badge>
}

export function StockCountsPage() {
  const { user, allowedFunctions } = useAuth()
  return <CountsScreen key={`${user?.id}:${allowedFunctions.join(',')}`} />
}
function CountsScreen() {
  const { hasPermission } = useAuth()
  const canCount = hasPermission('stock.count')
  const [draftCode, setDraftCode] = useState('')
  const [code, setCode] = useState('')
  const [state, setState] = useState('')
  const [cursors, setCursors] = useState([''])
  const [version, setVersion] = useState(0)
  const query = new URLSearchParams()
  if (code) query.set('code', code)
  if (state) query.set('state', state)
  query.set('limit', '25')
  query.set('sort', '-countedAt')
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!)
  const data = useDocumentPage(
    canCount ? `/stock-counts?${query}` : null,
    parseCount,
    version,
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    count: StockCount
    etag: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<
    'create' | 'header' | 'recount' | 'add' | 'line' | null
  >(null)
  const [countedAt, setCountedAt] = useState('')
  const [reason, setReason] = useState('')
  const [observations, setObservations] = useState<
    { productId: string; countedQuantity: string }[]
  >([])
  const [lineId, setLineId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const mutation = useDocumentMutation()
  useEffect(() => {
    if (!selected || !canCount) return
    const controller = new AbortController()
    apiFetch<unknown>(`/stock-counts/${selected}`, {
      signal: controller.signal,
    })
      .then((result) => {
        const count = parseCount(result.data)
        if (!controller.signal.aborted) setDetail({ count, etag: result.etag })
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure))
      })
    return () => controller.abort()
  }, [selected, version, canCount])
  function reload() {
    setDetail(null)
    setError(null)
    setCursors([''])
    setVersion((value) => value + 1)
  }
  function openDetail(id: string) {
    setDetail(null)
    setError(null)
    setSelected(id)
  }
  function open(
    mode: 'create' | 'header' | 'recount' | 'add' | 'line',
    line?: CountLine,
  ) {
    setMode(mode)
    setFormError(null)
    setReason(mode === 'header' ? (detail?.count.reason ?? '') : '')
    setCountedAt(mode === 'header' ? (detail?.count.countedAt ?? '') : '')
    setLineId(line?.id ?? '')
    // Recount always needs newly entered observations, never a silent copy/rebase.
    setObservations(
      mode === 'recount'
        ? detail!.count.lines.map((item) => ({
            productId: item.productId,
            countedQuantity: '',
          }))
        : [
            {
              productId: line?.productId ?? '',
              countedQuantity: line?.countedQuantity ?? '',
            },
          ],
    )
  }
  async function save() {
    if (!canCount || !mode || mutation.busy) return
    setFormError(null)
    try {
      if (mode !== 'add' && mode !== 'line' && !validInstant(countedAt))
        throw new Error(
          'Nhập thời điểm ISO 8601 đầy đủ múi giờ, ví dụ 2026-10-30T09:00:00+07:00.',
        )
      const ids = new Set<string>()
      if (mode !== 'header')
        for (const line of observations) {
          if (
            !validId(line.productId) ||
            ids.has(line.productId) ||
            !exact.quantity.test(line.countedQuantity)
          )
            throw new Error(
              'Chọn mỗi mặt hàng một lần và nhập số đếm không âm, tối đa 3 chữ số lẻ.',
            )
          ids.add(line.productId)
        }
      if (mode === 'recount' && !reason.trim())
        throw new Error('Cần lý do đếm lại.')
      if (
        mode !== 'create' &&
        (!detail?.etag || detail.count.state !== 'DRAFT')
      )
        throw new Error('Biên bản đã thay đổi. Hãy tải lại trước khi lưu.')
      let path = '/stock-counts'
      let body: unknown = {
        countedAt,
        reason: reason || null,
        lines: observations,
      }
      if (mode !== 'create') path += `/${detail!.count.id}`
      if (mode === 'header') body = { countedAt, reason: reason || null }
      if (mode === 'recount') {
        path += '/recount'
        body = { countedAt, reason: reason.trim(), lines: observations }
      }
      if (mode === 'add') {
        path += '/lines'
        body = observations[0]
      }
      if (mode === 'line') {
        path += `/lines/${lineId}`
        body = { countedQuantity: observations[0]!.countedQuantity }
      }
      await mutation.run(path, {
        method: mode === 'header' || mode === 'line' ? 'PATCH' : 'POST',
        body,
        ifMatch: mode === 'create' ? undefined : detail!.etag!,
      })
      setMode(null)
      setNotice('Đã lưu số đếm kiểm kê.')
      invalidateCache('/stock-counts')
      reload()
    } catch (failure) {
      setFormError(errorMessage(failure))
      if (failure instanceof ApiError && [412, 428].includes(failure.status))
        setDetail((value) => (value ? { ...value, etag: null } : null))
    }
  }
  async function confirm() {
    if (
      !detail?.etag ||
      !canConfirmCount(
        detail.count,
        canCount,
        hasPermission('stock.adjustment.post'),
      ) ||
      mutation.busy
    )
      return
    try {
      await mutation.run(`/stock-counts/${detail.count.id}/confirm`, {
        ifMatch: detail.etag,
      })
      setNotice('Đã xác nhận biên bản kiểm kê.')
      invalidateCache('/stock-counts')
      invalidateCache('/stock-adjustments')
      reload()
    } catch (failure) {
      setError(errorMessage(failure))
      if (failure instanceof ApiError && [412, 428].includes(failure.status))
        setDetail({ ...detail, etag: null })
    } finally {
      setConfirming(false)
    }
  }
  if (!canCount)
    return <Alert type="error">Bạn không có quyền kiểm kê kho.</Alert>
  // Recount and single-line edits keep the product fixed; show it by name.
  const knownLine = (productId: string) =>
    detail?.count.lines.find((line) => line.productId === productId)
  const isDraft = detail?.count.state === 'DRAFT'
  const confirmable =
    !!detail &&
    canConfirmCount(
      detail.count,
      canCount,
      hasPermission('stock.adjustment.post'),
    )
  const totals = detail ? varianceCounts(detail.count.lines) : null
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kho hàng"
        title="Kiểm kê kho hàng"
        description="Đối chiếu số đếm thực tế với sổ kho. Biên bản đã xác nhận không thể sửa."
        className="mb-0"
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => open('create')}
          >
            Lập kiểm kê
          </Button>
        }
      />
      {notice && <Alert type="success">{notice}</Alert>}
      <Card className="gap-0 p-4 shadow-xs">
        <form
          aria-label="Bộ lọc kiểm kê"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            setCode(draftCode)
            setCursors([''])
          }}
        >
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Input
              label="Mã kiểm kê"
              placeholder="Ví dụ KK-12"
              className="pl-9"
              value={draftCode}
              onChange={(event) => setDraftCode(event.target.value)}
            />
            <Search
              className="pointer-events-none absolute bottom-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <Button type="submit">Áp dụng bộ lọc</Button>
          {code && (
            <Button
              type="button"
              variant="ghost"
              icon={<RotateCcw className="size-4" />}
              onClick={() => {
                setDraftCode('')
                setCode('')
                setCursors([''])
              }}
            >
              Xóa lọc
            </Button>
          )}
        </form>
      </Card>
      {data.error && (
        <Alert type="error">
          <span className="flex flex-wrap items-center gap-3">
            {data.error}
            <Button variant="outline" size="sm" onClick={data.reload}>
              Thử lại
            </Button>
          </span>
        </Alert>
      )}
      <Card className="gap-0 overflow-hidden py-0 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <SegmentedFilter
            label="Trạng thái kiểm kê"
            value={state}
            options={[
              { value: '', label: 'Tất cả' },
              { value: 'DRAFT', label: statusLabel('DRAFT') },
              { value: 'CONFIRMED', label: statusLabel('CONFIRMED') },
            ]}
            onChange={(next) => {
              setState(next)
              setCursors([''])
            }}
          />
        </div>
        {data.loading && (
          <TableSkeleton columns={6} label="Đang tải kiểm kê..." />
        )}
        {data.page &&
          (data.page.items.length ? (
            <div className="overflow-x-auto">
              <Table caption="Danh sách kiểm kê" className="min-w-[680px]">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Thời điểm đếm</th>
                    <th>Trạng thái</th>
                    <th className="cell-number">Số mặt hàng</th>
                    <th>Đối chiếu</th>
                    <th>Lý do</th>
                    <th className="cell-actions">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.page.items.map((count) => {
                    const off = count.lines.filter(
                      (line) => !isZero(line.difference),
                    ).length
                    return (
                      <tr
                        key={count.id}
                        className="cursor-pointer"
                        onClick={() => openDetail(count.id)}
                      >
                        <td className="font-semibold whitespace-nowrap text-foreground">
                          {count.code}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">
                          {formatDateTime(count.countedAt)}
                        </td>
                        <td>
                          <StatusBadge status={count.state} />
                        </td>
                        <td className="cell-number">{count.lines.length}</td>
                        <td>
                          {off ? (
                            <Badge variant="warning">{off} dòng lệch</Badge>
                          ) : (
                            <Badge variant="success">Khớp sổ</Badge>
                          )}
                        </td>
                        <td className="max-w-56 truncate text-muted-foreground">
                          {count.reason ?? '—'}
                        </td>
                        <td
                          className="cell-actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Chi tiết ${count.code}`}
                            onClick={() => openDetail(count.id)}
                          >
                            Chi tiết
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<ClipboardList className="size-6" />}
                title="Chưa có biên bản kiểm kê phù hợp."
                description="Lập kiểm kê để đối chiếu số đếm thực tế với sổ kho."
              />
            </div>
          ))}
        {data.page && (
          <Pagination
            totalShowing={data.page.items.length}
            hasNext={data.page.pagination.hasMore}
            hasPrevious={cursors.length > 1}
            onNext={() => {
              if (data.page?.pagination.nextCursor)
                setCursors([...cursors, data.page.pagination.nextCursor])
            }}
            onPrevious={() => setCursors(cursors.slice(0, -1))}
          />
        )}
      </Card>
      <Modal
        isOpen={!!selected && !mode}
        title={detail ? `Biên bản ${detail.count.code}` : 'Biên bản kiểm kê'}
        maxWidth="xl"
        onClose={() => {
          if (!mutation.busy) setSelected(null)
        }}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              className="mr-auto"
              icon={<RefreshCw className="size-4" />}
              disabled={mutation.busy}
              onClick={reload}
            >
              Tải lại
            </Button>
            {detail && isDraft && (
              <>
                <Button
                  variant="outline"
                  icon={<PencilLine className="size-4" />}
                  disabled={!detail.etag || mutation.busy}
                  onClick={() => open('header')}
                >
                  Sửa thông tin kiểm kê
                </Button>
                <Button
                  variant="outline"
                  icon={<ListPlus className="size-4" />}
                  disabled={!detail.etag || mutation.busy}
                  onClick={() => open('add')}
                >
                  Thêm mặt hàng
                </Button>
                <Button
                  variant="outline"
                  icon={<RotateCcw className="size-4" />}
                  disabled={!detail.etag || mutation.busy}
                  onClick={() => open('recount')}
                >
                  Đếm lại toàn bộ
                </Button>
                <Button
                  icon={<ClipboardCheck className="size-4" />}
                  disabled={!detail.etag || !confirmable || mutation.busy}
                  onClick={() => setConfirming(true)}
                >
                  Xác nhận kiểm kê
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {!detail && !error && (
            <div role="status" className="space-y-4">
              <span className="sr-only">Đang tải biên bản...</span>
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}
          {detail && totals && (
            <>
              <Card className="gap-4 p-4 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">
                    {detail.count.code}
                  </span>
                  <StatusBadge status={detail.count.state} />
                </div>
                <Separator />
                <FactGrid className="lg:grid-cols-3">
                  <Fact label="Thời điểm đếm">
                    <span className="tabular-nums">
                      {formatDateTime(detail.count.countedAt)}
                    </span>
                  </Fact>
                  <Fact label="Phiếu điều chỉnh">
                    {detail.count.adjustmentDocumentId
                      ? `#${detail.count.adjustmentDocumentId}`
                      : 'Chưa có'}
                  </Fact>
                  <Fact label="Đối chiếu">
                    <span
                      className="flex flex-wrap gap-1.5"
                      aria-label={`${totals.match} khớp, ${totals.surplus} thừa, ${totals.shortage} thiếu`}
                    >
                      <Badge variant="success">Khớp: {totals.match}</Badge>
                      <Badge variant="info">Thừa: {totals.surplus}</Badge>
                      <Badge variant="danger">Thiếu: {totals.shortage}</Badge>
                    </span>
                  </Fact>
                  {detail.count.reason && (
                    <Fact label="Lý do" full>
                      {detail.count.reason}
                    </Fact>
                  )}
                </FactGrid>
              </Card>
              <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                <div className="overflow-x-auto">
                  <Table
                    caption="Số đếm so với sổ kho"
                    className="min-w-[640px]"
                  >
                    <thead>
                      <tr>
                        <th>Mặt hàng</th>
                        <th>Đơn vị</th>
                        <th className="cell-number">Sổ kho</th>
                        <th className="cell-number">Thực đếm</th>
                        <th className="cell-number">Chênh lệch</th>
                        <th>Kết quả</th>
                        {isDraft && (
                          <th className="cell-actions">
                            <span className="sr-only">Thao tác</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.count.lines.map((line) => (
                        <tr
                          key={line.id}
                          className={cn(
                            !isZero(line.difference) && 'bg-amber-500/5',
                          )}
                        >
                          <td>
                            <span className="font-semibold whitespace-nowrap text-foreground">
                              {line.productCode}
                            </span>{' '}
                            {line.productName}
                          </td>
                          <td className="text-muted-foreground">
                            {line.unitName}
                          </td>
                          <td className="cell-number">
                            {formatQuantity(line.bookQuantity)}
                          </td>
                          <td className="cell-number font-medium">
                            {formatQuantity(line.countedQuantity)}
                          </td>
                          <td className="cell-number">
                            <Difference value={line.difference} />
                          </td>
                          <td>
                            <VarianceBadge difference={line.difference} />
                          </td>
                          {isDraft && (
                            <td className="cell-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Sửa số đếm ${line.productCode}`}
                                disabled={!detail.etag || mutation.busy}
                                onClick={() => open('line', line)}
                              >
                                Sửa
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card>
              {isDraft && (
                <Hint>
                  Khi xác nhận, phần chênh lệch (nếu có) được ghi thành phiếu
                  điều chỉnh kho và cần quyền ghi sổ điều chỉnh. Nếu tồn kho
                  thay đổi sau lúc đếm, hãy đếm lại.
                </Hint>
              )}
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={confirming && !!detail}
        title="Xác nhận biên bản kiểm kê"
        maxWidth="sm"
        onClose={() => {
          if (!mutation.busy) setConfirming(false)
        }}
        footer={
          <>
            <Button
              variant="outline"
              disabled={mutation.busy}
              onClick={() => setConfirming(false)}
            >
              Quay lại
            </Button>
            <Button
              icon={<ClipboardCheck className="size-4" />}
              isLoading={mutation.busy}
              onClick={() => void confirm()}
            >
              Xác nhận
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-foreground">
          Xác nhận <strong>{detail?.count.code}</strong>?{' '}
          {totals && totals.surplus + totals.shortage > 0
            ? `${totals.surplus + totals.shortage} dòng lệch sẽ được ghi thành phiếu điều chỉnh kho.`
            : 'Mọi dòng khớp sổ kho, không sinh phiếu điều chỉnh.'}
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Biên bản đã xác nhận không thể sửa.
        </p>
      </Modal>
      <Modal
        isOpen={!!mode}
        title={
          mode === 'recount'
            ? 'Đếm lại toàn bộ mặt hàng'
            : mode === 'header'
              ? 'Sửa thông tin kiểm kê'
              : mode === 'create'
                ? 'Lập kiểm kê'
                : 'Ghi số đếm'
        }
        maxWidth="lg"
        onClose={() => {
          if (!mutation.busy) setMode(null)
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {formError && <Alert type="error">{formError}</Alert>}
          <fieldset disabled={mutation.busy} className="min-w-0 space-y-4">
            <legend className="sr-only">Số đếm kiểm kê</legend>
            {mode !== 'add' && mode !== 'line' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Thời điểm đếm (ISO 8601, có múi giờ)"
                  placeholder="2026-10-30T09:00:00+07:00"
                  className="tabular-nums"
                  value={countedAt}
                  onChange={(event) => setCountedAt(event.target.value)}
                />
                <Input
                  label="Lý do kiểm kê"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            )}
            {mode !== 'header' && (
              <div className="space-y-2 rounded-xl border bg-card p-3 shadow-xs">
                {observations.map((line, index) => {
                  const fixed = mode === 'line' || mode === 'recount'
                  const known = fixed ? knownLine(line.productId) : undefined
                  return (
                    <div
                      className="grid items-end gap-3 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                      key={index}
                    >
                      {fixed ? (
                        <div className="grid min-w-0 gap-1.5">
                          <span className="text-[13px] font-medium text-foreground/85">
                            Mặt hàng {index + 1}
                          </span>
                          <span className="flex h-9 items-center truncate rounded-md bg-muted/60 px-3 text-sm">
                            {known
                              ? `${known.productCode} — ${known.productName} (${known.unitName})`
                              : `#${line.productId}`}
                          </span>
                        </div>
                      ) : (
                        <EntityPicker
                          id={`count-${index}-product`}
                          resource="products"
                          label={`Mặt hàng ${index + 1}`}
                          required
                          disabled={mutation.busy}
                          value={line.productId}
                          onChange={(productId) =>
                            setObservations(
                              observations.map((item, position) =>
                                position === index
                                  ? { ...item, productId }
                                  : item,
                              ),
                            )
                          }
                        />
                      )}
                      <Input
                        label={`Số đếm thực tế ${index + 1}`}
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        value={line.countedQuantity}
                        onChange={(event) =>
                          setObservations(
                            observations.map((item, position) =>
                              position === index
                                ? {
                                    ...item,
                                    countedQuantity: event.target.value,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      {mode === 'create' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-9 p-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Xóa mặt hàng ${index + 1}`}
                          disabled={observations.length === 1}
                          onClick={() =>
                            setObservations(
                              observations.filter(
                                (_, position) => position !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      ) : (
                        <span className="hidden sm:block" />
                      )}
                    </div>
                  )
                })}
                {mode === 'create' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed sm:w-auto"
                    icon={<Plus className="size-4" />}
                    onClick={() =>
                      setObservations([
                        ...observations,
                        { productId: '', countedQuantity: '' },
                      ])
                    }
                  >
                    Thêm mặt hàng
                  </Button>
                )}
              </div>
            )}
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.busy}
              onClick={() => setMode(null)}
            >
              Đóng
            </Button>
            <Button type="submit" isLoading={mutation.busy}>
              Lưu số đếm
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
