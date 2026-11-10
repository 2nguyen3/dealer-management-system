import {
  BookCheck,
  Eye,
  History,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DateField } from '../../components/blocks/DateField'
import { PageHeader } from '../../components/blocks/PageHeader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/shadcn/dropdown-menu'
import { Separator } from '../../components/shadcn/separator'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { apiFetch, ApiError } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { formatDate, formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import { RevisionHistory } from '../document_history/DocumentHistoryPage'
import { DocumentList } from '../document_history/DocumentList'
import {
  canReadKind,
  documentKinds,
  exact,
  inputLines,
  parseDocument,
  validDate,
  validId,
  vietnamToday,
  type DocumentDetail,
  type DocumentSummary,
  type GoodsKind,
  type LineInput,
} from '../document_history/documentContracts'
import { Hint, SectionCard } from '../document_history/DocumentParts'
import {
  errorMessage,
  useDocumentMutation,
} from '../document_history/useDocumentRequests'
import { CorrectionDialog } from '../document_corrections/CorrectionDialog'
import { DocumentSnapshot } from './DocumentSnapshot'
import { GoodsLineEditor } from './GoodsLineEditor'
import { canEstimate, emptyLine, summarizeLines } from './lineEstimates'

const descriptions: Record<GoodsKind, string> = {
  STOCK_RECEIPT: 'Ghi nhận hàng nhập vào kho.',
  STOCK_ISSUE:
    'Lập phiếu giao hàng cho đại lý, nộp phiếu rồi ghi sổ khi xuất kho.',
  SALES_RETURN: 'Ghi nhận hàng đại lý trả lại theo phiếu xuất gốc.',
  STOCK_ADJUSTMENT: 'Điều chỉnh tăng hoặc giảm tồn kho, luôn kèm lý do.',
}
const postEffects: Record<GoodsKind, string> = {
  STOCK_RECEIPT: 'tăng tồn kho và cập nhật giá nhập hiện hành',
  STOCK_ISSUE: 'giảm tồn kho và ghi nhận công nợ cho đại lý',
  SALES_RETURN: 'nhập lại hàng và giảm công nợ hoặc ghi có cho đại lý',
  STOCK_ADJUSTMENT: 'thay đổi tồn kho theo số lượng điều chỉnh',
}
type FormMode = 'create' | 'header' | 'pending'

/** Sticky editor summary: line count, estimated subtotal and the save actions. */
function EditorSummary({
  kind,
  mode,
  lines,
  immediatePayment,
  originLines,
  busy,
  onClose,
}: {
  kind: GoodsKind
  mode: FormMode
  lines: LineInput[]
  immediatePayment: string
  originLines?: DocumentDetail['currentRevision']['lines'] | null
  busy: boolean
  onClose: () => void
}) {
  const summary = summarizeLines(kind, lines, originLines)
  const priced = canEstimate(kind, originLines)
  const missing = summary.lineCount - summary.pricedLines
  const payment = exact.money.test(immediatePayment) ? immediatePayment : null
  return (
    <aside
      aria-label="Tóm tắt chứng từ"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-xs lg:sticky lg:top-0"
    >
      <h3 className="text-sm font-semibold text-foreground">Tóm tắt</h3>
      {mode === 'header' ? (
        <p className="text-[13px] text-muted-foreground">
          Chỉ sửa thông tin chung; dòng hàng giữ nguyên.
        </p>
      ) : (
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Số dòng hàng</dt>
            <dd className="font-medium tabular-nums">{summary.lineCount}</dd>
          </div>
          {kind === 'STOCK_ADJUSTMENT' && (
            <>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Dòng tăng kho</dt>
                <dd className="font-medium text-success tabular-nums">
                  {summary.increases}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Dòng giảm kho</dt>
                <dd className="font-medium text-destructive tabular-nums">
                  {summary.decreases}
                </dd>
              </div>
            </>
          )}
          {kind === 'STOCK_ISSUE' && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Trả ngay dự kiến</dt>
              <dd className="font-medium tabular-nums">
                {payment === null ? '—' : formatVND(payment)}
              </dd>
            </div>
          )}
          {priced && (
            <>
              <Separator />
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-medium text-foreground">Tạm tính</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatVND(summary.subtotal.toString())}
                </dd>
              </div>
              {missing > 0 && (
                <p className="text-xs text-muted-foreground">
                  {missing} dòng chưa đủ số lượng hoặc đơn giá.
                </p>
              )}
            </>
          )}
        </dl>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {kind === 'STOCK_ISSUE'
          ? 'Giá bán được hệ thống chốt khi nộp phiếu; tồn kho và trả ngay được kiểm tra lại khi ghi sổ.'
          : 'Số tiền chính thức do hệ thống tính khi lưu.'}
      </p>
      <div className="grid gap-2">
        <Button type="submit" isLoading={busy}>
          {mode === 'pending' ? 'Lưu thay thế' : 'Lưu nháp'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          Đóng
        </Button>
      </div>
    </aside>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Đang tải chứng từ...</span>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

export function GoodsDocumentsPage({ kind }: { kind: GoodsKind }) {
  const { user, allowedFunctions } = useAuth()
  return (
    <GoodsDocumentsScreen
      key={`${kind}:${user?.id}:${allowedFunctions.join(',')}`}
      kind={kind}
    />
  )
}
function GoodsDocumentsScreen({ kind }: { kind: GoodsKind }) {
  const { hasPermission, user, allowedFunctions } = useAuth()
  const config = documentKinds[kind]
  const [version, setVersion] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    doc: DocumentDetail
    etag: string | null
  } | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [create, setCreate] = useState(false)
  const [editHeader, setEditHeader] = useState(false)
  const [replacePending, setReplacePending] = useState(false)
  const [date, setDate] = useState(vietnamToday)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [agencyId, setAgencyId] = useState('')
  const [originId, setOriginId] = useState('')
  const [immediatePayment, setImmediatePayment] = useState('0')
  const [lines, setLines] = useState<LineInput[]>([emptyLine()])
  const [formError, setFormError] = useState<string | null>(null)
  const [source, setSource] = useState<DocumentDetail | null>(null)
  const [sourceBusy, setSourceBusy] = useState(false)
  const sourceController = useRef<AbortController | null>(null)
  const [correction, setCorrection] = useState<'correct' | 'cancel' | null>(
    null,
  )
  const [confirmPost, setConfirmPost] = useState(false)
  const [history, setHistory] = useState<DocumentSummary | null>(null)
  const mutation = useDocumentMutation()
  const scope = `${user?.id}:${allowedFunctions.join(',')}`
  const readable = canReadKind(kind, hasPermission)
  const issueReadable = canReadKind('STOCK_ISSUE', hasPermission)
  useEffect(() => {
    if (!selected || !readable) return
    const controller = new AbortController()
    apiFetch<unknown>(`${config.path}/${selected}`, {
      signal: controller.signal,
    })
      .then((result) => {
        const doc = parseDocument(result.data)
        if (doc.kind !== kind) throw new Error('Sai loại chứng từ.')
        if (!controller.signal.aborted) {
          setDetail({ doc, etag: result.etag })
          setDetailLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetailError(errorMessage(error))
          setDetailLoading(false)
        }
      })
    return () => controller.abort()
  }, [selected, config.path, kind, version, scope, readable])
  useEffect(() => () => sourceController.current?.abort(), [])
  function openDetail(id: string) {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    setSelected(id)
  }
  function reload() {
    setDetail(null)
    setDetailLoading(true)
    setVersion((value) => value + 1)
  }
  function openForm(mode: FormMode) {
    const revision = mode === 'create' ? null : detail?.doc.currentRevision
    setDate(revision?.businessDate ?? vietnamToday())
    setNote(revision?.note ?? '')
    setReason('')
    setFormError(null)
    setImmediatePayment(revision?.immediatePayment ?? '0')
    setAgencyId('')
    setOriginId('')
    setSource(null)
    setLines(
      revision
        ? revision.lines.map((line) => ({
            productId: line.productId,
            originLineId: line.originLineId ?? '',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          }))
        : [emptyLine()],
    )
    setCreate(mode === 'create')
    setEditHeader(mode === 'header')
    setReplacePending(mode === 'pending')
  }
  // Demand-loads the chosen original issue once per selection; a newer choice aborts it.
  async function loadSource(originId: string) {
    sourceController.current?.abort()
    if (!validId(originId)) return
    const controller = new AbortController()
    sourceController.current = controller
    setSourceBusy(true)
    setFormError(null)
    try {
      const result = await apiFetch<unknown>(`/stock-issues/${originId}`, {
        signal: controller.signal,
      })
      const doc = parseDocument(result.data)
      if (doc.kind !== 'STOCK_ISSUE' || doc.status !== 'POSTED')
        throw new Error('Chỉ nhận hàng từ phiếu xuất đã ghi sổ.')
      if (!controller.signal.aborted) setSource(doc)
    } catch (error) {
      if (!controller.signal.aborted) setFormError(errorMessage(error))
    } finally {
      if (!controller.signal.aborted) setSourceBusy(false)
    }
  }
  function chooseOrigin(id: string) {
    sourceController.current?.abort()
    setSourceBusy(false)
    setOriginId(id)
    setSource(null)
    // Lines belong to the previous original issue; start over for the new one.
    setLines([emptyLine()])
    if (id && issueReadable) void loadSource(id)
  }
  async function save() {
    if (!hasPermission(config.prepare) || mutation.busy) return
    setFormError(null)
    try {
      if (!validDate(date)) throw new Error('Ngày nghiệp vụ không hợp lệ.')
      if (kind === 'STOCK_ISSUE' && !exact.money.test(immediatePayment))
        throw new Error('Trả ngay phải là chuỗi số nguyên VNĐ.')
      if (
        (kind === 'STOCK_ADJUSTMENT' || replacePending) &&
        !reason.trim() &&
        !editHeader
      )
        throw new Error('Cần lý do nghiệp vụ.')
      let path: string = config.path
      const body: Record<string, unknown> = {
        businessDate: date,
        note: note || null,
      }
      if (kind === 'STOCK_ISSUE') body.immediatePayment = immediatePayment
      if (kind === 'STOCK_ADJUSTMENT')
        body.reason = reason.trim() || detail?.doc.currentRevision.reason
      if (!editHeader) body.lines = inputLines(kind, lines)
      if (create && kind === 'STOCK_ISSUE') {
        if (!validId(agencyId)) throw new Error('Vui lòng chọn đại lý.')
        body.agencyId = agencyId
      }
      if (create && kind === 'SALES_RETURN') {
        if (!validId(originId)) throw new Error('Vui lòng chọn phiếu xuất gốc.')
        body.originDocumentId = originId
      }
      if (editHeader || replacePending) {
        if (!detail?.etag)
          throw new Error('Cần tải lại phiên bản và ETag trước khi sửa.')
        path = `${config.path}/${detail.doc.id}${replacePending ? '/revisions' : ''}`
        if (replacePending) body.reason = reason.trim()
      }
      await mutation.run(path, {
        method: editHeader ? 'PATCH' : 'POST',
        body,
        ifMatch: create ? undefined : (detail?.etag ?? undefined),
      })
      setCreate(false)
      setEditHeader(false)
      setReplacePending(false)
      setNotice('Đã lưu chứng từ.')
      invalidateCache(config.path)
      reload()
    } catch (error) {
      setFormError(errorMessage(error))
      if (error instanceof ApiError && [412, 428].includes(error.status))
        setDetail((value) => (value ? { ...value, etag: null } : null))
    }
  }
  async function action(actionName: 'submit' | 'post') {
    if (
      !detail?.etag ||
      mutation.busy ||
      !hasPermission(actionName === 'post' ? config.post : config.prepare)
    )
      return
    try {
      await mutation.run(`${config.path}/${detail.doc.id}/${actionName}`, {
        ifMatch: detail.etag,
      })
      setNotice(actionName === 'post' ? 'Đã ghi sổ chứng từ.' : 'Đã nộp phiếu.')
      invalidateCache(config.path)
      reload()
    } catch (error) {
      setDetailError(errorMessage(error))
      if (error instanceof ApiError && [412, 428].includes(error.status))
        setDetail({ ...detail, etag: null })
    } finally {
      setConfirmPost(false)
    }
  }
  const draft =
    detail?.doc.status === 'DRAFT' &&
    detail.doc.currentRevision.state === 'DRAFT'
  const independent =
    kind !== 'STOCK_ADJUSTMENT' || detail?.doc.stockCountId === null
  const canPost =
    !!detail &&
    independent &&
    hasPermission(config.post) &&
    (kind === 'STOCK_ISSUE'
      ? detail.doc.status === 'PENDING' &&
        detail.doc.currentRevision.state === 'READY'
      : draft)
  const formOpen = create || editHeader || replacePending
  const formMode: FormMode = create
    ? 'create'
    : replacePending
      ? 'pending'
      : 'header'
  const originLines =
    create && kind === 'SALES_RETURN' && issueReadable
      ? (source?.currentRevision.lines ?? null)
      : undefined
  const closeForm = () => {
    if (!mutation.busy) {
      setCreate(false)
      setEditHeader(false)
      setReplacePending(false)
      sourceController.current?.abort()
      setSourceBusy(false)
    }
  }
  const detailActions = detail && (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <Button
        variant="ghost"
        className="mr-auto"
        icon={<RefreshCw className="size-4" />}
        onClick={reload}
        disabled={mutation.busy}
      >
        Tải lại
      </Button>
      {detail.doc.status !== 'CANCELLED' && (
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          icon={<XCircle className="size-4" />}
          disabled={mutation.busy}
          onClick={() => setCorrection('cancel')}
        >
          Hủy phiếu
        </Button>
      )}
      {detail.doc.status === 'POSTED' && (
        <Button
          variant="outline"
          icon={<Undo2 className="size-4" />}
          disabled={mutation.busy}
          onClick={() => setCorrection('correct')}
        >
          Sửa sai
        </Button>
      )}
      {draft && independent && hasPermission(config.prepare) && (
        <Button
          variant="outline"
          icon={<PencilLine className="size-4" />}
          disabled={!detail.etag || mutation.busy}
          onClick={() => openForm('header')}
        >
          Sửa thông tin nháp
        </Button>
      )}
      {kind === 'STOCK_ISSUE' &&
        detail.doc.status === 'PENDING' &&
        hasPermission(config.prepare) && (
          <Button
            variant="outline"
            icon={<PencilLine className="size-4" />}
            disabled={!detail.etag || mutation.busy}
            onClick={() => openForm('pending')}
          >
            Thay nội dung chờ xuất
          </Button>
        )}
      {kind === 'STOCK_ISSUE' && draft && hasPermission(config.prepare) && (
        <Button
          icon={<Send className="size-4" />}
          disabled={!detail.etag}
          isLoading={mutation.busy}
          onClick={() => void action('submit')}
        >
          Nộp phiếu
        </Button>
      )}
      {canPost && (
        <Button
          icon={<BookCheck className="size-4" />}
          disabled={!detail.etag || mutation.busy}
          onClick={() => setConfirmPost(true)}
        >
          Ghi sổ
        </Button>
      )}
    </div>
  )
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kho hàng"
        title={config.title}
        description={descriptions[kind]}
        className="mb-0"
        actions={
          hasPermission(config.prepare) && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => openForm('create')}
            >
              Tạo phiếu
            </Button>
          )
        }
      />
      {notice && <Alert type="success">{notice}</Alert>}
      <DocumentList
        kind={kind}
        version={version}
        onRowClick={(row) => openDetail(row.id)}
        actions={(row) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Chi tiết ${row.code}`}
              onClick={() => openDetail(row.id)}
            >
              Chi tiết
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0"
                  aria-label={`Thao tác khác ${row.code}`}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openDetail(row.id)}>
                  <Eye aria-hidden="true" />
                  Xem chi tiết
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setHistory(row)}>
                  <History aria-hidden="true" />
                  Lịch sử phiên bản
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      />
      <Modal
        isOpen={!!selected}
        title={detail ? `Chi tiết ${detail.doc.code}` : 'Chi tiết chứng từ'}
        onClose={() => {
          if (!mutation.busy) {
            setSelected(null)
            setDetail(null)
            setCorrection(null)
          }
        }}
        maxWidth="xl"
        footer={detailActions || undefined}
      >
        <div className="space-y-4">
          {detailError && <Alert type="error">{detailError}</Alert>}
          {detailLoading && <DetailSkeleton />}
          {detail && (
            <>
              <DocumentSnapshot doc={detail.doc} />
              {kind === 'STOCK_ISSUE' &&
                detail.doc.currentRevision.state === 'READY' && (
                  <Hint>
                    Phiếu đã sẵn sàng và chốt giá. Tồn kho và khoản trả ngay
                    được kiểm tra lại khi ghi sổ.
                  </Hint>
                )}
              {!independent && (
                <Hint>
                  Phiếu điều chỉnh sinh từ biên bản kiểm kê được ghi sổ cùng
                  biên bản, không sửa hoặc ghi sổ riêng tại đây.
                </Hint>
              )}
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={confirmPost && !!detail}
        title="Xác nhận ghi sổ"
        maxWidth="sm"
        onClose={() => {
          if (!mutation.busy) setConfirmPost(false)
        }}
        footer={
          <>
            <Button
              variant="outline"
              disabled={mutation.busy}
              onClick={() => setConfirmPost(false)}
            >
              Quay lại
            </Button>
            <Button
              icon={<BookCheck className="size-4" />}
              isLoading={mutation.busy}
              onClick={() => void action('post')}
            >
              Xác nhận ghi sổ
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-foreground">
          Ghi sổ <strong>{detail?.doc.code}</strong> sẽ {postEffects[kind]}.
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Sau khi ghi sổ, chỉ có thể sửa sai hoặc hủy bằng phiên bản mới có lý
          do.
        </p>
      </Modal>
      <Modal
        isOpen={formOpen}
        title={
          create
            ? `Tạo ${config.title.toLowerCase()}`
            : replacePending
              ? 'Thay toàn bộ nội dung chờ xuất'
              : 'Sửa thông tin nháp'
        }
        onClose={closeForm}
        maxWidth="xl"
      >
        <form
          noValidate
          className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="min-w-0 space-y-4">
            {formError && <Alert type="error">{formError}</Alert>}
            <SectionCard title="Thông tin chung">
              <fieldset
                disabled={mutation.busy}
                className="grid min-w-0 gap-4 sm:grid-cols-2"
              >
                <legend className="sr-only">Thông tin chung</legend>
                <DateField
                  label="Ngày nghiệp vụ"
                  required
                  disabled={mutation.busy}
                  value={date}
                  onChange={setDate}
                />
                {create && kind === 'STOCK_ISSUE' && (
                  <EntityPicker
                    resource="agencies"
                    label="Đại lý"
                    required
                    disabled={mutation.busy}
                    params={{ status: 'ACTIVE' }}
                    value={agencyId}
                    onChange={(id) => setAgencyId(id)}
                  />
                )}
                {create &&
                  kind === 'SALES_RETURN' &&
                  (issueReadable ? (
                    <EntityPicker
                      resource="stock-issues"
                      label="Phiếu xuất gốc"
                      required
                      disabled={mutation.busy}
                      params={{ status: 'POSTED' }}
                      value={originId}
                      onChange={(id) => chooseOrigin(id)}
                    />
                  ) : (
                    <Input
                      label="Mã số phiếu xuất gốc"
                      aria-label="Mã số phiếu xuất gốc"
                      required
                      value={originId}
                      onChange={(event) => chooseOrigin(event.target.value)}
                    />
                  ))}
                {kind === 'STOCK_ISSUE' && (
                  <Input
                    label="Trả ngay dự kiến (VNĐ)"
                    aria-label="Trả ngay dự kiến (VNĐ)"
                    required
                    inputMode="numeric"
                    className="tabular-nums"
                    value={immediatePayment}
                    onChange={(event) =>
                      setImmediatePayment(event.target.value)
                    }
                  />
                )}
                {(kind === 'STOCK_ADJUSTMENT' || replacePending) && (
                  <Input
                    label="Lý do"
                    aria-label="Lý do"
                    required={!editHeader}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
                <div className="sm:col-span-2">
                  <Input
                    label="Ghi chú"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </fieldset>
              {sourceBusy && <Spinner label="Đang tải phiếu xuất gốc..." />}
              {source && (
                <details className="group mt-4 rounded-lg border bg-muted/30 px-3 py-2">
                  <summary className="cursor-pointer text-[13px] font-medium text-foreground">
                    Xem phiếu xuất gốc {source.code} (
                    {formatDate(source.currentRevision.businessDate)})
                  </summary>
                  <div className="mt-3">
                    <DocumentSnapshot doc={source} />
                  </div>
                </details>
              )}
            </SectionCard>
            {!editHeader && (
              <GoodsLineEditor
                kind={kind}
                lines={lines}
                onChange={setLines}
                disabled={mutation.busy}
                originLines={originLines}
              />
            )}
          </div>
          <EditorSummary
            kind={kind}
            mode={formMode}
            lines={lines}
            immediatePayment={immediatePayment}
            originLines={originLines}
            busy={mutation.busy}
            onClose={closeForm}
          />
        </form>
      </Modal>
      {correction && detail && (
        <CorrectionDialog
          doc={detail.doc}
          etag={detail.etag}
          mode={correction}
          onClose={() => setCorrection(null)}
          onSaved={() => {
            setCorrection(null)
            reload()
          }}
        />
      )}
      {history && (
        <RevisionHistory doc={history} onClose={() => setHistory(null)} />
      )}
    </div>
  )
}
