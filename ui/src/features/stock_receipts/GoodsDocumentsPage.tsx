import {
  BookCheck,
  ChevronDown,
  Eye,
  History,
  Info,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../components/shadcn/collapsible'
import { Separator } from '../../components/shadcn/separator'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { ErrorNotice } from '../../components/guide/ErrorNotice'
import { LockedButton } from '../../components/guide/LockedButton'
import { NextActionCallout } from '../../components/guide/NextActionCallout'
import { notifyNextStep } from '../../components/guide/notifyNextStep'
import { WorkflowSteps } from '../../components/guide/WorkflowSteps'
import { t } from '../../lib/i18n/core'
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
import { Hint, InfoTip, SectionCard } from '../document_history/DocumentParts'
import {
  errorMessage,
  useDocumentMutation,
} from '../document_history/useDocumentRequests'
import { CorrectionDialog } from '../document_corrections/CorrectionDialog'
import { usePathAllowed } from '../guide/usePathAllowed'
import { useUpfrontState } from '../guide/useUpfrontState'
import {
  goodsPostEffects,
  goodsWorkflow,
  issuePostEffects,
  positiveMoney,
  stockIssueWorkflow,
  upfrontLink,
} from '../guide/workflows'
import { DocumentSnapshot } from './DocumentSnapshot'
import { GoodsLineEditor } from './GoodsLineEditor'
import { canEstimate, emptyLine, summarizeLines } from './lineEstimates'

const descriptions: Record<GoodsKind, string> = {
  STOCK_RECEIPT: t('Nhập hàng vào kho.'),
  STOCK_ISSUE: t('Lập → nộp → ghi sổ khi xuất kho.'),
  SALES_RETURN: t('Nhận hàng trả theo phiếu xuất gốc.'),
  STOCK_ADJUSTMENT: t('Tăng/giảm tồn kho kèm lý do.'),
}
const postEffects: Record<GoodsKind, string> = {
  STOCK_RECEIPT: t('tăng tồn kho và cập nhật giá nhập hiện hành'),
  STOCK_ISSUE: t('giảm tồn kho và ghi nhận công nợ cho đại lý'),
  SALES_RETURN: t('nhập lại hàng và giảm công nợ hoặc ghi có cho đại lý'),
  STOCK_ADJUSTMENT: t('thay đổi tồn kho theo số lượng điều chỉnh'),
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
      aria-label={t('Tóm tắt chứng từ')}
      className="space-y-4 rounded-xl border bg-card p-4 shadow-xs lg:sticky lg:top-0"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t('Tóm tắt')}
        </h3>
        <InfoTip label={t('Cách tính tóm tắt')}>
          {kind === 'STOCK_ISSUE'
            ? t(
                'Giá bán được hệ thống chốt khi nộp phiếu; tồn kho và trả ngay được kiểm tra lại khi ghi sổ.',
              )
            : t('Số tiền chính thức do hệ thống tính khi lưu.')}
        </InfoTip>
      </div>
      {mode === 'header' ? (
        <p className="text-[13px] text-muted-foreground">
          {t('Chỉ sửa thông tin chung.')}
        </p>
      ) : (
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('Số dòng hàng')}</dt>
            <dd className="font-medium tabular-nums">{summary.lineCount}</dd>
          </div>
          {kind === 'STOCK_ADJUSTMENT' && (
            <>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('Dòng tăng kho')}</dt>
                <dd className="font-medium text-success tabular-nums">
                  {summary.increases}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('Dòng giảm kho')}</dt>
                <dd className="font-medium text-destructive tabular-nums">
                  {summary.decreases}
                </dd>
              </div>
            </>
          )}
          {kind === 'STOCK_ISSUE' && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('Trả ngay dự kiến')}</dt>
              <dd className="font-medium tabular-nums">
                {payment === null ? '—' : formatVND(payment)}
              </dd>
            </div>
          )}
          {priced && (
            <>
              <Separator />
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-medium text-foreground">{t('Tạm tính')}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatVND(summary.subtotal.toString())}
                </dd>
              </div>
              {missing > 0 && (
                <p className="text-xs text-warning">
                  {t('{missing} dòng chưa đủ số lượng/đơn giá', { missing })}
                </p>
              )}
            </>
          )}
        </dl>
      )}
      <div className="grid gap-2">
        <Button type="submit" isLoading={busy}>
          {mode === 'pending' ? t('Lưu thay thế') : t('Lưu nháp')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onClose}
        >
          {t('Đóng')}
        </Button>
      </div>
    </aside>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{t('Đang tải chứng từ...')}</span>
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
  const [detailFailure, setDetailFailure] = useState<unknown>(null)
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
  const pathAllowed = usePathAllowed()
  const upfrontState = useUpfrontState(
    kind === 'STOCK_ISSUE' ? detail?.doc.upfrontConfirmationId : null,
    version,
  )
  useEffect(() => {
    if (!selected || !readable) return
    const controller = new AbortController()
    apiFetch<unknown>(`${config.path}/${selected}`, {
      signal: controller.signal,
    })
      .then((result) => {
        const doc = parseDocument(result.data)
        if (doc.kind !== kind) throw new Error(t('Sai loại chứng từ.'))
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
    setDetailFailure(null)
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
        throw new Error(t('Chỉ nhận hàng từ phiếu xuất đã ghi sổ.'))
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
      if (!validDate(date)) throw new Error(t('Ngày nghiệp vụ không hợp lệ.'))
      if (kind === 'STOCK_ISSUE' && !exact.money.test(immediatePayment))
        throw new Error(t('Trả ngay phải là chuỗi số nguyên VNĐ.'))
      if (
        (kind === 'STOCK_ADJUSTMENT' || replacePending) &&
        !reason.trim() &&
        !editHeader
      )
        throw new Error(t('Cần lý do nghiệp vụ.'))
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
        if (!validId(agencyId)) throw new Error(t('Vui lòng chọn đại lý.'))
        body.agencyId = agencyId
      }
      if (create && kind === 'SALES_RETURN') {
        if (!validId(originId))
          throw new Error(t('Vui lòng chọn phiếu xuất gốc.'))
        body.originDocumentId = originId
      }
      if (editHeader || replacePending) {
        if (!detail?.etag)
          throw new Error(t('Cần tải lại phiên bản và ETag trước khi sửa.'))
        path = `${config.path}/${detail.doc.id}${replacePending ? '/revisions' : ''}`
        if (replacePending) body.reason = reason.trim()
      }
      const saved = await mutation.run(path, {
        method: editHeader ? 'PATCH' : 'POST',
        body,
        ifMatch: create ? undefined : (detail?.etag ?? undefined),
      })
      const savedCode =
        typeof saved?.data === 'object' &&
        saved.data !== null &&
        'code' in saved.data &&
        typeof saved.data.code === 'string'
          ? saved.data.code
          : (detail?.doc.code ?? '')
      notifyNextStep({
        done: savedCode
          ? t('Đã lưu nháp {code}.', { code: savedCode })
          : t('Đã lưu chứng từ.'),
        next:
          kind === 'STOCK_ISSUE'
            ? t('Bước tiếp: mở phiếu, kiểm tra rồi bấm Nộp phiếu để chốt giá.')
            : t('Bước tiếp: mở phiếu, kiểm tra các dòng rồi Ghi sổ.'),
      })
      setCreate(false)
      setEditHeader(false)
      setReplacePending(false)
      setNotice(t('Đã lưu chứng từ.'))
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
      setNotice(
        actionName === 'post' ? t('Đã ghi sổ chứng từ.') : t('Đã nộp phiếu.'),
      )
      announce(actionName, detail.doc)
      invalidateCache(config.path)
      reload()
    } catch (error) {
      setDetailError(errorMessage(error))
      setDetailFailure(error)
      if (error instanceof ApiError && [412, 428].includes(error.status))
        setDetail({ ...detail, etag: null })
    } finally {
      setConfirmPost(false)
    }
  }
  function announce(actionName: 'submit' | 'post', doc: DocumentDetail) {
    const upfront = doc.currentRevision.immediatePayment
    if (actionName === 'submit') {
      const needsUpfront = positiveMoney(upfront)
      const to = needsUpfront ? upfrontLink(doc.id) : undefined
      notifyNextStep({
        done: t('Đã nộp {code}.', { code: doc.code }),
        next: needsUpfront
          ? t(
              'Bước tiếp: Kế toán xác nhận trả ngay {amount}, rồi Kho ghi sổ.',
              {
                amount: formatVND(upfront),
              },
            )
          : t('Bước tiếp: Kho ghi sổ phiếu xuất.'),
        ...(to && pathAllowed(to) ? { to } : {}),
      })
      return
    }
    const to =
      kind === 'STOCK_ISSUE' || kind === 'SALES_RETURN'
        ? '/receivables'
        : '/inventory'
    notifyNextStep({
      done: t('Đã ghi sổ {code}.', { code: doc.code }),
      next:
        kind === 'STOCK_ISSUE'
          ? positiveMoney(upfront)
            ? t(
                'Tồn kho đã giảm, công nợ đã cập nhật và phiếu thu trả ngay đã được lập.',
              )
            : t(
                'Tồn kho đã giảm và công nợ đại lý đã cập nhật. Thu tiền bằng Phiếu thu khi đại lý thanh toán.',
              )
          : kind === 'SALES_RETURN'
            ? t(
                'Hàng đã nhập lại kho; công nợ hoặc dư có của đại lý đã cập nhật.',
              )
            : t('Tồn kho đã cập nhật. Xem thẻ kho để đối chiếu.'),
      ...(pathAllowed(to) ? { to } : {}),
    })
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
  const issueFlow =
    kind === 'STOCK_ISSUE' && detail
      ? stockIssueWorkflow(detail.doc, upfrontState, {
          prepare: hasPermission(config.prepare),
          post: hasPermission(config.post),
          verify: hasPermission('cash.upfront.verify'),
        })
      : null
  const goodsFlow =
    kind !== 'STOCK_ISSUE' && detail
      ? goodsWorkflow(kind, detail.doc, hasPermission(config.post))
      : null
  const flow = issueFlow ?? goodsFlow
  const nextAction =
    flow?.next?.to && !pathAllowed(flow.next.to)
      ? { ...flow.next, to: undefined }
      : (flow?.next ?? null)
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
        className="me-auto"
        icon={<RefreshCw className="size-4" />}
        onClick={reload}
        disabled={mutation.busy}
      >
        {t('Tải lại')}
      </Button>
      {detail.doc.status !== 'CANCELLED' && (
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          icon={<XCircle className="size-4" />}
          disabled={mutation.busy}
          onClick={() => setCorrection('cancel')}
        >
          {t('Hủy phiếu')}
        </Button>
      )}
      {detail.doc.status === 'POSTED' && (
        <Button
          variant="outline"
          icon={<Undo2 className="size-4" />}
          disabled={mutation.busy}
          onClick={() => setCorrection('correct')}
        >
          {t('Sửa sai')}
        </Button>
      )}
      {draft && independent && hasPermission(config.prepare) && (
        <Button
          variant="outline"
          icon={<PencilLine className="size-4" />}
          disabled={!detail.etag || mutation.busy}
          onClick={() => openForm('header')}
        >
          {t('Sửa thông tin nháp')}
        </Button>
      )}
      {kind === 'STOCK_ISSUE' &&
        detail.doc.status === 'PENDING' &&
        hasPermission(config.prepare) && (
          <LockedButton
            variant="outline"
            icon={<PencilLine className="size-4" />}
            disabled={!detail.etag || mutation.busy}
            lockedReason={issueFlow?.replaceLock}
            onClick={() => openForm('pending')}
          >
            {t('Thay nội dung chờ xuất')}
          </LockedButton>
        )}
      {kind === 'STOCK_ISSUE' && draft && hasPermission(config.prepare) && (
        <LockedButton
          icon={<Send className="size-4" />}
          disabled={!detail.etag}
          isLoading={mutation.busy}
          lockedReason={issueFlow?.submitLock}
          onClick={() => void action('submit')}
        >
          {t('Nộp phiếu')}
        </LockedButton>
      )}
      {canPost && (
        <LockedButton
          icon={<BookCheck className="size-4" />}
          disabled={!detail.etag || mutation.busy}
          lockedReason={issueFlow?.postLock}
          onClick={() => setConfirmPost(true)}
        >
          {t('Ghi sổ')}
        </LockedButton>
      )}
    </div>
  )
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Kho hàng')}
        title={config.title}
        description={descriptions[kind]}
        className="mb-0"
        actions={
          hasPermission(config.prepare) && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => openForm('create')}
            >
              {t('Tạo phiếu')}
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
              aria-label={t('Chi tiết {code}', { code: row.code })}
              onClick={() => openDetail(row.id)}
            >
              {t('Chi tiết')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0"
                  aria-label={t('Thao tác khác {code}', { code: row.code })}
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openDetail(row.id)}>
                  <Eye aria-hidden="true" />
                  {t('Xem chi tiết')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setHistory(row)}>
                  <History aria-hidden="true" />
                  {t('Lịch sử phiên bản')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      />
      <Modal
        isOpen={!!selected}
        title={
          detail
            ? t('Chi tiết {code}', { code: detail.doc.code })
            : t('Chi tiết chứng từ')
        }
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
          {detailError && (
            <ErrorNotice
              error={detailFailure}
              message={detailError}
              to={
                detail &&
                detailFailure instanceof ApiError &&
                detailFailure.code === 'UPFRONT_REQUIRED'
                  ? upfrontLink(detail.doc.id)
                  : undefined
              }
            />
          )}
          {detailLoading && <DetailSkeleton />}
          {detail && (
            <>
              {flow && (
                <WorkflowSteps
                  label={t('Quy trình {document}', {
                    document: config.title.toLowerCase(),
                  })}
                  steps={flow.steps}
                />
              )}
              <NextActionCallout action={nextAction} />
              <DocumentSnapshot doc={detail.doc} />
              {kind === 'STOCK_ISSUE' &&
                detail.doc.currentRevision.state === 'READY' && (
                  <Hint>
                    {t(
                      'Đã chốt giá; tồn kho và trả ngay kiểm tra lại khi ghi sổ.',
                    )}
                  </Hint>
                )}
              {!independent && (
                <Hint>
                  {t('Sinh từ kiểm kê: ghi sổ cùng biên bản, không sửa riêng.')}
                </Hint>
              )}
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={confirmPost && !!detail}
        title={t('Xác nhận ghi sổ')}
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
              {t('Quay lại')}
            </Button>
            <Button
              icon={<BookCheck className="size-4" />}
              isLoading={mutation.busy}
              onClick={() => void action('post')}
            >
              {t('Xác nhận ghi sổ')}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-foreground">
          {t('Ghi sổ')} <strong>{detail?.doc.code}</strong>{' '}
          {t('sẽ {postEffects}.', { postEffects: postEffects[kind] })}
        </p>
        {detail && (
          <ul
            className="mt-3 list-disc space-y-1 ps-5 text-[13px] text-foreground"
            aria-label={t('Hệ quả khi ghi sổ')}
          >
            {(kind === 'STOCK_ISSUE'
              ? issuePostEffects(detail.doc)
              : goodsPostEffects(kind, detail.doc)
            ).map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[13px] text-muted-foreground">
          {t('Sau đó chỉ sửa sai/hủy bằng phiên bản mới.')}
        </p>
      </Modal>
      <Modal
        isOpen={formOpen}
        title={
          create
            ? t('Tạo {title}', { title: config.title.toLowerCase() })
            : replacePending
              ? t('Thay toàn bộ nội dung chờ xuất')
              : t('Sửa thông tin nháp')
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
            {replacePending &&
              kind === 'STOCK_ISSUE' &&
              positiveMoney(detail?.doc.currentRevision.immediatePayment) && (
                <Alert type="warning" title={t('Cần xác nhận trả ngay lại')}>
                  {t(
                    'Thay nội dung sẽ tạo phiên bản mới ở trạng thái nháp. Xác nhận trả ngay cũ không dùng cho phiên bản mới: nếu phiên bản mới có trả ngay, sau khi nộp lại Kế toán phải xác nhận khoản tiền mới trước khi Kho ghi sổ. Tiền đã ghi nhận riêng không nhập lại vào trả ngay.',
                  )}
                </Alert>
              )}
            <SectionCard title={t('Thông tin chung')} icon={<Info />}>
              <fieldset
                disabled={mutation.busy}
                className="grid min-w-0 gap-4 sm:grid-cols-2"
              >
                <legend className="sr-only">{t('Thông tin chung')}</legend>
                <DateField
                  label={t('Ngày nghiệp vụ')}
                  required
                  disabled={mutation.busy}
                  value={date}
                  onChange={setDate}
                />
                {create && kind === 'STOCK_ISSUE' && (
                  <EntityPicker
                    resource="agencies"
                    label={t('Đại lý')}
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
                      label={t('Phiếu xuất gốc')}
                      required
                      disabled={mutation.busy}
                      params={{ status: 'POSTED' }}
                      value={originId}
                      onChange={(id) => chooseOrigin(id)}
                    />
                  ) : (
                    <Input
                      label={t('Mã số phiếu xuất gốc')}
                      aria-label={t('Mã số phiếu xuất gốc')}
                      required
                      value={originId}
                      onChange={(event) => chooseOrigin(event.target.value)}
                    />
                  ))}
                {kind === 'STOCK_ISSUE' && (
                  <Input
                    label={t('Trả ngay dự kiến (VNĐ)')}
                    aria-label={t('Trả ngay dự kiến (VNĐ)')}
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
                    label={t('Lý do')}
                    aria-label={t('Lý do')}
                    required={!editHeader}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
                <div className="sm:col-span-2">
                  <Input
                    label={t('Ghi chú')}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </fieldset>
              {sourceBusy && (
                <Spinner label={t('Đang tải phiếu xuất gốc...')} />
              )}
              {source && (
                <Collapsible className="group mt-4 rounded-lg border bg-muted/30">
                  <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-start text-[13px] font-medium text-foreground">
                    {t('Phiếu xuất gốc {code} · {businessDate}', {
                      code: source.code,
                      businessDate: formatDate(
                        source.currentRevision.businessDate,
                      ),
                    })}
                    <ChevronDown
                      className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t p-3">
                    <DocumentSnapshot doc={source} />
                  </CollapsibleContent>
                </Collapsible>
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
