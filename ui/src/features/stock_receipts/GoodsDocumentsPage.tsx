import {
  BookCheck,
  HandCoins,
  PencilLine,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/guide/ErrorNotice'
import { LockedButton } from '../../components/guide/LockedButton'
import { NextActionCallout } from '../../components/guide/NextActionCallout'
import { notifyNextStep } from '../../components/guide/notifyNextStep'
import { WorkflowSteps } from '../../components/guide/WorkflowSteps'
import { t } from '../../lib/i18n/core'
import { ApiError, apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { formatVND } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import { CancelDialog } from '../document_history/CancelDialog'
import { DebtPanel } from '../document_history/DebtPanel'
import { DocumentList } from '../document_history/DocumentList'
import {
  canReadKind,
  changeBlock,
  documentBody,
  documentKinds,
  emptyForm,
  exact,
  formFromDocument,
  parseDocument,
  receiptAmountAfterIssue,
  receiptFormLink,
  validId,
  type DocumentDetail,
  type DocumentForm,
  type DocumentKind,
} from '../document_history/documentContracts'
import {
  errorMessage,
  useDocumentMutation,
} from '../document_history/useDocumentRequests'
import {
  documentNext,
  documentNotice,
  documentSteps,
  postEffect,
} from '../document_history/workflow'
import { usePathAllowed } from '../guide/usePathAllowed'
import { payment as onlinePayment } from '../online_payments/paymentFlow'
import {
  id,
  Intent,
  positiveMoney,
  type Row,
} from '../payment_receipts/contracts'
import { PdfButton } from '../payment_receipts/PdfButton'
import { TransferHandoff } from '../payment_receipts/TransferHandoff'
import { DocumentFormModal, type FormMode } from './DocumentFormModal'
import { DocumentSnapshot } from './DocumentSnapshot'

const descriptions: Record<DocumentKind, string> = {
  STOCK_RECEIPT: t('Lập nháp → ghi sổ: tồn kho tăng, giá nhập cập nhật.'),
  STOCK_ISSUE: t(
    'Lập nháp → ghi sổ: tồn kho giảm, công nợ đại lý tăng; thu tiền bằng phiếu thu.',
  ),
  PAYMENT_RECEIPT: t('Lập nháp → ghi sổ: công nợ đại lý giảm.'),
}
const eyebrows: Record<DocumentKind, string> = {
  STOCK_RECEIPT: t('Kho hàng'),
  STOCK_ISSUE: t('Kho hàng'),
  PAYMENT_RECEIPT: t('Tài chính'),
}
/** Lists/balances that change when a document of this kind changes. */
const affected: Record<DocumentKind, string[]> = {
  STOCK_RECEIPT: ['/stock-receipts', '/products', '/documents', '/reports'],
  STOCK_ISSUE: [
    '/stock-issues',
    '/products',
    '/agencies',
    '/documents',
    '/reports',
  ],
  PAYMENT_RECEIPT: ['/payment-receipts', '/agencies', '/documents', '/reports'],
}

type Confirm = 'post' | 'collect' | 'delete'

function DetailSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{t('Đang tải chứng từ...')}</span>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

/** Deep-link intents read from the page URL (`?document=` / `?new=1&…`). */
function linkIntent(params: URLSearchParams) {
  const document = params.get('document')
  const agencyId = params.get('agencyId') ?? ''
  const amount = params.get('amount') ?? ''
  return {
    document: document && validId(document) ? document : null,
    create: params.get('new') === '1',
    agencyId: validId(agencyId) ? agencyId : '',
    amount: exact.positiveMoney.test(amount) ? amount : '',
  }
}

/**
 * Workbench of one document kind: list, detail with the actions its state
 * allows (draft edit/delete/post; posted cancel/correct with a reason), and
 * the create/edit/correct form. Shared by receipts, issues and payments.
 */
export function DocumentWorkbench({ kind }: { kind: DocumentKind }) {
  const { user, allowedFunctions } = useAuth()
  return (
    <WorkbenchScreen
      key={`${kind}:${user?.id}:${allowedFunctions.join(',')}`}
      kind={kind}
    />
  )
}
/** Goods pages (receipts and issues) use the shared workbench. */
export const GoodsDocumentsPage = DocumentWorkbench

function WorkbenchScreen({ kind }: { kind: DocumentKind }) {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const pathAllowed = usePathAllowed()
  const [searchParams, setSearchParams] = useSearchParams()
  const config = documentKinds[kind]
  const readable = canReadKind(kind, hasPermission)
  const canPrepare = hasPermission(config.prepare)
  const canPost = hasPermission(config.post)
  const canCollect = hasPermission('cash.receipt.prepare')
  const canTransfer =
    kind === 'PAYMENT_RECEIPT' && hasPermission('payments.online')
  const [handoff, setHandoff] = useState<Row | null>(null)
  const [transferIntent] = useState(() => new Intent())
  const [transferBusy, setTransferBusy] = useState(false)
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
  const [form, setForm] = useState<{
    mode: FormMode
    initial: DocumentForm
    doc: DocumentDetail | null
  } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formFailure, setFormFailure] = useState<unknown>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelFailure, setCancelFailure] = useState<unknown>(null)
  const mutation = useDocumentMutation()

  // Deep links: open a document, or the prefilled create form (A2 shortcut).
  const linkKey = searchParams.toString()
  const [consumedLink, setConsumedLink] = useState<string | null>(null)
  if (!linkKey && consumedLink !== null) setConsumedLink(null)
  if (linkKey && consumedLink !== linkKey) {
    setConsumedLink(linkKey)
    const intent = linkIntent(searchParams)
    if (intent.document && readable) {
      setDetail(null)
      setDetailError(null)
      setDetailLoading(true)
      setSelected(intent.document)
    } else if (intent.create && canPrepare) {
      setFormError(null)
      setFormFailure(null)
      setForm({
        mode: 'create',
        initial: {
          ...emptyForm(),
          agencyId: kind === 'STOCK_RECEIPT' ? '' : intent.agencyId,
          amount: kind === 'PAYMENT_RECEIPT' ? intent.amount : '',
        },
        doc: null,
      })
    }
  }
  useEffect(() => {
    if (linkKey) setSearchParams({}, { replace: true })
  }, [linkKey, setSearchParams])

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
          setDetailFailure(error)
          setDetailLoading(false)
        }
      })
    return () => controller.abort()
  }, [selected, config.path, kind, version, readable])

  function openDetail(id: string) {
    setDetail(null)
    setDetailError(null)
    setDetailFailure(null)
    setDetailLoading(true)
    setSelected(id)
  }
  function refresh() {
    for (const prefix of affected[kind]) invalidateCache(prefix)
    setDetail(null)
    setDetailLoading(true)
    setVersion((value) => value + 1)
  }
  function closeDetail() {
    if (mutation.busy) return
    setSelected(null)
    setDetail(null)
    setDetailError(null)
    setConfirm(null)
    setCancelOpen(false)
  }
  function failed(
    error: unknown,
    report: (message: string, error: unknown) => void,
  ) {
    report(errorMessage(error), error)
    if (error instanceof ApiError && [412, 428].includes(error.status))
      setDetail((value) => (value ? { ...value, etag: null } : null))
  }
  function openForm(mode: FormMode) {
    setFormError(null)
    setFormFailure(null)
    if (mode === 'create') {
      setForm({ mode, initial: emptyForm(), doc: null })
      return
    }
    if (!detail) return
    setForm({ mode, initial: formFromDocument(detail.doc), doc: detail.doc })
  }

  async function post(id: string, etag: string, code: string) {
    const result = await mutation.run(`${config.path}/${id}/post`, {
      ifMatch: etag,
    })
    const doc = parseDocument(result.data)
    notifyNextStep(documentNotice('post', kind, doc.code || code))
    return { doc, etag: result.etag }
  }

  /** After posting an issue: open the prefilled payment receipt form (A2). */
  function collect(doc: DocumentDetail) {
    const amount = receiptAmountAfterIssue(doc.totalAmount, doc.agencyDebt)
    if (!doc.agencyId || amount === null) {
      setNotice(
        t(
          'Đã ghi sổ {code}. Đại lý không còn nợ nên không cần lập phiếu thu.',
          {
            code: doc.code,
          },
        ),
      )
      return
    }
    navigate(receiptFormLink(doc.agencyId, amount))
  }

  async function save(values: DocumentForm, postNow: boolean) {
    if (!form || mutation.busy) return
    setFormError(null)
    setFormFailure(null)
    try {
      const mode = form.mode
      const body = documentBody(
        kind,
        values,
        mode === 'correct' ? 'correct' : 'draft',
      )
      if (mode !== 'create' && !detail?.etag)
        throw new Error(t('Cần tải lại chứng từ trước khi sửa.'))
      const id = form.doc?.id ?? ''
      const result = await mutation.run(
        mode === 'create'
          ? config.path
          : mode === 'edit'
            ? `${config.path}/${id}`
            : `${config.path}/${id}/corrections`,
        {
          method: mode === 'edit' ? 'PUT' : 'POST',
          body,
          ifMatch: mode === 'create' ? undefined : detail!.etag!,
        },
      )
      const saved = parseDocument(result.data)
      setForm(null)
      let postFailure: unknown = null
      if (mode === 'correct') {
        notifyNextStep(documentNotice('correct', kind, saved.code))
        setNotice(
          t('Đã hủy {old} và lập {code} thay thế.', {
            old: form.doc?.code ?? '',
            code: saved.code,
          }),
        )
      } else if (postNow) {
        try {
          if (!result.etag)
            throw new Error(t('Cần tải lại chứng từ trước khi ghi sổ.'))
          await post(saved.id, result.etag, saved.code)
          setNotice(t('Đã lưu và ghi sổ {code}.', { code: saved.code }))
        } catch (error) {
          postFailure = error
          setNotice(
            t('Đã lưu nháp {code} nhưng chưa ghi sổ được.', {
              code: saved.code,
            }),
          )
        }
      } else {
        notifyNextStep(
          documentNotice(
            mode === 'edit' ? 'update' : 'create',
            kind,
            saved.code,
          ),
        )
        setNotice(t('Đã lưu nháp {code}.', { code: saved.code }))
      }
      for (const prefix of affected[kind]) invalidateCache(prefix)
      setVersion((value) => value + 1)
      openDetail(saved.id)
      if (postFailure) {
        setDetailError(errorMessage(postFailure))
        setDetailFailure(postFailure)
      }
    } catch (error) {
      failed(error, (message, failure) => {
        setFormError(message)
        setFormFailure(failure)
      })
    }
  }

  /** New receipt by transfer: a pending VNPAY payment, not a document. */
  async function transfer(values: DocumentForm) {
    if (!form || mutation.busy) return
    setFormError(null)
    setFormFailure(null)
    setTransferBusy(true)
    try {
      const result = await transferIntent.send<unknown>('/online-payments', {
        method: 'POST',
        body: {
          agencyId: id(values.agencyId),
          provider: 'VNPAY',
          amount: positiveMoney(values.amount.trim()),
        },
      })
      const created = onlinePayment(result.data)
      setForm(null)
      setHandoff(created)
      for (const prefix of ['/online-payments', '/agencies'])
        invalidateCache(prefix)
      notifyNextStep({
        done: t('Đã tạo giao dịch chuyển khoản VNPAY.'),
        next: t(
          'Bước tiếp: gửi mã QR hoặc phiếu báo PDF cho đại lý. Phiếu thu được lập tự động khi tiền về.',
        ),
      })
    } catch (error) {
      setFormError(errorMessage(error))
      setFormFailure(error)
    } finally {
      setTransferBusy(false)
    }
  }

  async function runPost(then: 'stay' | 'collect') {
    if (!detail?.etag || mutation.busy || !canPost) return
    setDetailError(null)
    try {
      const posted = await post(detail.doc.id, detail.etag, detail.doc.code)
      setConfirm(null)
      refresh()
      if (then === 'collect') collect(posted.doc)
      else setNotice(t('Đã ghi sổ {code}.', { code: posted.doc.code }))
    } catch (error) {
      setConfirm(null)
      failed(error, (message, failure) => {
        setDetailError(message)
        setDetailFailure(failure)
      })
    }
  }

  async function runDelete() {
    if (!detail?.etag || mutation.busy || !canPrepare) return
    setDetailError(null)
    try {
      await mutation.run(`${config.path}/${detail.doc.id}`, {
        method: 'DELETE',
        ifMatch: detail.etag,
      })
      notifyNextStep(documentNotice('delete', kind, detail.doc.code))
      setNotice(t('Đã xóa nháp {code}.', { code: detail.doc.code }))
      setConfirm(null)
      setSelected(null)
      setDetail(null)
      for (const prefix of affected[kind]) invalidateCache(prefix)
      setVersion((value) => value + 1)
    } catch (error) {
      setConfirm(null)
      failed(error, (message, failure) => {
        setDetailError(message)
        setDetailFailure(failure)
      })
    }
  }

  async function runCancel(reason: string) {
    if (!detail?.etag || mutation.busy) return
    setCancelError(null)
    setCancelFailure(null)
    try {
      const result = await mutation.run(
        `${config.path}/${detail.doc.id}/cancel`,
        {
          body: { reason },
          ifMatch: detail.etag,
        },
      )
      const doc = parseDocument(result.data)
      notifyNextStep(documentNotice('cancel', kind, doc.code))
      setNotice(t('Đã hủy {code}.', { code: doc.code }))
      setCancelOpen(false)
      refresh()
    } catch (error) {
      failed(error, (message, failure) => {
        setCancelError(message)
        setCancelFailure(failure)
      })
    }
  }

  const doc = detail?.doc ?? null
  const grants = { prepare: canPrepare, post: canPost, collect: canCollect }
  const flow = doc ? documentSteps(doc, grants) : null
  const next = doc ? documentNext(doc, grants) : null
  const nextAction =
    next?.to && !pathAllowed(next.to) ? { ...next, to: undefined } : next
  const draft = doc?.status === 'DRAFT'
  const block = doc ? changeBlock(doc) : null
  const mayCancel = !!doc && hasPermission('documents.cancel')
  const mayCorrect = !!doc && hasPermission('documents.correct') && canPost
  const showChange = doc?.status === 'POSTED' && doc.receiptType !== 'ONLINE'
  const collectAllowed =
    kind === 'STOCK_ISSUE' && canCollect && pathAllowed('/payment-receipts')
  const issueChange =
    doc && kind === 'STOCK_ISSUE' && draft ? BigInt(doc.totalAmount) : null

  const detailActions = doc && (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <Button
        variant="ghost"
        className="me-auto"
        icon={<RefreshCw className="size-4" />}
        onClick={refresh}
        disabled={mutation.busy}
      >
        {t('Tải lại')}
      </Button>
      {kind === 'PAYMENT_RECEIPT' && (
        <PdfButton
          path={`/documents/${doc.id}/print`}
          filename={`${doc.code}.pdf`}
          disabled={mutation.busy}
        >
          {t('Xuất PDF phiếu thu')}
        </PdfButton>
      )}
      {draft && canPrepare && (
        <>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            icon={<Trash2 className="size-4" />}
            disabled={!detail?.etag || mutation.busy}
            onClick={() => setConfirm('delete')}
          >
            {t('Xóa nháp')}
          </Button>
          <Button
            variant="outline"
            icon={<PencilLine className="size-4" />}
            disabled={!detail?.etag || mutation.busy}
            onClick={() => openForm('edit')}
          >
            {t('Sửa nháp')}
          </Button>
        </>
      )}
      {draft && canPost && (
        <>
          {collectAllowed && (
            <Button
              variant="outline"
              icon={<HandCoins className="size-4" />}
              disabled={!detail?.etag || mutation.busy}
              onClick={() => setConfirm('collect')}
            >
              {t('Ghi sổ & lập phiếu thu')}
            </Button>
          )}
          <Button
            icon={<BookCheck className="size-4" />}
            disabled={!detail?.etag || mutation.busy}
            onClick={() => setConfirm('post')}
          >
            {t('Ghi sổ')}
          </Button>
        </>
      )}
      {showChange && mayCancel && (
        <LockedButton
          variant="outline"
          className="text-destructive hover:text-destructive"
          icon={<XCircle className="size-4" />}
          disabled={!detail?.etag || mutation.busy}
          lockedReason={block}
          onClick={() => {
            setCancelError(null)
            setCancelOpen(true)
          }}
        >
          {t('Hủy')}
        </LockedButton>
      )}
      {showChange && mayCorrect && (
        <LockedButton
          variant="outline"
          icon={<Undo2 className="size-4" />}
          disabled={!detail?.etag || mutation.busy}
          lockedReason={block}
          onClick={() => openForm('correct')}
        >
          {t('Sửa có lý do')}
        </LockedButton>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrows[kind]}
        title={config.title}
        description={descriptions[kind]}
        className="mb-0"
        actions={
          canPrepare && (
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
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('Chi tiết {code}', { code: row.code })}
            onClick={() => openDetail(row.id)}
          >
            {t('Chi tiết')}
          </Button>
        )}
      />
      <Modal
        isOpen={!!selected}
        title={
          doc
            ? t('Chi tiết {code}', { code: doc.code })
            : t('Chi tiết chứng từ')
        }
        onClose={closeDetail}
        maxWidth="xl"
        footer={detailActions || undefined}
      >
        <div className="space-y-4">
          {detailError && (
            <ErrorNotice error={detailFailure} message={detailError} />
          )}
          {detailLoading && <DetailSkeleton />}
          {doc && (
            <>
              {flow && (
                <WorkflowSteps
                  label={t('Quy trình {document}', {
                    document: config.title.toLowerCase(),
                  })}
                  steps={flow}
                />
              )}
              <NextActionCallout action={nextAction} />
              <DocumentSnapshot doc={doc} onOpenDocument={openDetail} />
            </>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={(confirm === 'post' || confirm === 'collect') && !!doc}
        title={t('Xác nhận ghi sổ')}
        maxWidth="sm"
        onClose={() => {
          if (!mutation.busy) setConfirm(null)
        }}
        footer={
          <>
            <Button
              variant="outline"
              disabled={mutation.busy}
              onClick={() => setConfirm(null)}
            >
              {t('Quay lại')}
            </Button>
            <Button
              icon={
                confirm === 'collect' ? (
                  <HandCoins className="size-4" />
                ) : (
                  <BookCheck className="size-4" />
                )
              }
              isLoading={mutation.busy}
              onClick={() =>
                void runPost(confirm === 'collect' ? 'collect' : 'stay')
              }
            >
              {confirm === 'collect'
                ? t('Ghi sổ & lập phiếu thu')
                : t('Xác nhận ghi sổ')}
            </Button>
          </>
        }
      >
        {doc && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground">
              {t('Ghi sổ {code}: {effect}', {
                code: doc.code,
                effect: postEffect(kind),
              })}
            </p>
            {kind === 'STOCK_ISSUE' &&
              doc.agencyDebt !== null &&
              doc.agencyMaxDebt !== null && (
                <DebtPanel
                  debt={doc.agencyDebt}
                  maxDebt={doc.agencyMaxDebt}
                  change={issueChange}
                />
              )}
            {kind === 'PAYMENT_RECEIPT' &&
              doc.agencyDebt !== null &&
              doc.agencyMaxDebt !== null && (
                <DebtPanel
                  debt={doc.agencyDebt}
                  maxDebt={doc.agencyMaxDebt}
                  change={-BigInt(doc.totalAmount)}
                  afterLabel={t('Nợ sau khi thu')}
                />
              )}
            {confirm === 'collect' && (
              <p className="text-[13px] text-muted-foreground">
                {t(
                  'Sau khi ghi sổ, mở phiếu thu đã điền sẵn đại lý và số tiền {amount}.',
                  { amount: formatVND(doc.totalAmount) },
                )}
              </p>
            )}
            <p className="text-[13px] text-muted-foreground">
              {t(
                'Sau khi ghi sổ chỉ hủy hoặc sửa có lý do được, trong tháng hiện tại.',
              )}
            </p>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={confirm === 'delete' && !!doc}
        title={t('Xóa nháp')}
        maxWidth="sm"
        onClose={() => {
          if (!mutation.busy) setConfirm(null)
        }}
        footer={
          <>
            <Button
              variant="outline"
              disabled={mutation.busy}
              onClick={() => setConfirm(null)}
            >
              {t('Quay lại')}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              isLoading={mutation.busy}
              onClick={() => void runDelete()}
            >
              {t('Xóa nháp')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {t('Xóa hẳn nháp {code}? Nháp chưa ảnh hưởng tồn kho hay công nợ.', {
            code: doc?.code ?? '',
          })}
        </p>
      </Modal>
      {form && (
        <DocumentFormModal
          kind={kind}
          mode={form.mode}
          initial={form.initial}
          doc={form.doc}
          busy={mutation.busy || transferBusy}
          error={formError}
          failure={formFailure}
          canPostNow={form.mode !== 'correct' && canPost}
          canTransfer={canTransfer}
          onTransfer={(values) => void transfer(values)}
          onSubmit={(values, postNow) => void save(values, postNow)}
          onClose={() => {
            if (!mutation.busy) setForm(null)
          }}
        />
      )}
      {handoff && (
        <TransferHandoff payment={handoff} onClose={() => setHandoff(null)} />
      )}
      {cancelOpen && doc && (
        <CancelDialog
          doc={doc}
          busy={mutation.busy}
          error={cancelError}
          failure={cancelFailure}
          onConfirm={(reason) => void runCancel(reason)}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </div>
  )
}
