import { useEffect, useRef, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { PlusIcon, TrashIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch, ApiError } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { useAuth } from '../authentication/useAuth'
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
  type GoodsKind,
  type LineInput,
} from '../document_history/documentContracts'
import {
  errorMessage,
  useDocumentMutation,
} from '../document_history/useDocumentRequests'
import { CorrectionDialog } from '../document_corrections/CorrectionDialog'

const emptyLine = (): LineInput => ({
  productId: '',
  originLineId: '',
  quantity: '',
  unitPrice: '',
})
export function GoodsLineEditor({
  kind,
  lines,
  onChange,
  disabled = false,
}: {
  kind: GoodsKind
  lines: LineInput[]
  onChange: (lines: LineInput[]) => void
  disabled?: boolean
}) {
  const isReturn = kind === 'SALES_RETURN'
  const idLabel = isReturn ? 'ID dòng bán gốc' : 'ID mặt hàng'
  const quantityLabel = `Số lượng${kind === 'STOCK_ADJUSTMENT' ? ' (+/-)' : ''}`
  function update(index: number, patch: Partial<LineInput>) {
    onChange(
      lines.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    )
  }
  return (
    <fieldset className="line-editor" disabled={disabled}>
      <legend className="line-editor-title">
        Danh sách dòng hàng
        <span className="line-editor-count">{lines.length}</span>
      </legend>
      {lines.map((line, index) => (
        <div className="line-card" key={index}>
          <div className="line-card-head">
            <span className="line-card-no">Dòng {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="line-card-remove"
              aria-label={`Xóa dòng ${index + 1}`}
              disabled={lines.length === 1}
              icon={<TrashIcon size={16} />}
              onClick={() =>
                onChange(lines.filter((_, position) => position !== index))
              }
            >
              Xóa
            </Button>
          </div>
          <div className="line-card-fields">
            <Input
              id={`line-${index}-id`}
              label={idLabel}
              aria-label={`${idLabel} ${index + 1}`}
              required
              value={isReturn ? line.originLineId : line.productId}
              onChange={(event) =>
                update(
                  index,
                  isReturn
                    ? { originLineId: event.target.value }
                    : { productId: event.target.value },
                )
              }
            />
            <Input
              id={`line-${index}-quantity`}
              label={quantityLabel}
              aria-label={`${quantityLabel.replace(' (+/-)', '')} ${index + 1}${kind === 'STOCK_ADJUSTMENT' ? ' (+/-)' : ''}`}
              required
              inputMode="decimal"
              value={line.quantity}
              onChange={(event) =>
                update(index, { quantity: event.target.value })
              }
            />
            {kind === 'STOCK_RECEIPT' && (
              <Input
                id={`line-${index}-price`}
                label="Đơn giá nhập (VNĐ)"
                aria-label={`Đơn giá nhập ${index + 1} (VNĐ)`}
                required
                inputMode="numeric"
                value={line.unitPrice}
                onChange={(event) =>
                  update(index, { unitPrice: event.target.value })
                }
              />
            )}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="line-editor-add"
        icon={<PlusIcon size={16} />}
        onClick={() => onChange([...lines, emptyLine()])}
      >
        Thêm dòng
      </Button>
    </fieldset>
  )
}
export function DocumentSnapshot({ doc }: { doc: DocumentDetail }) {
  const revision = doc.currentRevision
  return (
    <>
      <p>
        {doc.code} / {doc.status} / {revision.state} / v{revision.revisionNo}
      </p>
      <p>
        Ngày nghiệp vụ: {revision.businessDate}. Tổng tiền máy chủ:{' '}
        {revision.totalAmount} VNĐ.
      </p>
      {revision.agencySnapshot && (
        <p>
          {revision.agencySnapshot.name} | {revision.agencySnapshot.address} |{' '}
          {revision.agencySnapshot.phone}
        </p>
      )}
      {revision.reason && <p>Lý do: {revision.reason}</p>}
      {revision.note && <p>Ghi chú: {revision.note}</p>}
      {doc.kind === 'STOCK_ISSUE' && (
        <p>
          Trả ngay: {revision.immediatePayment}. Còn nợ lúc xuất:{' '}
          {doc.remainingAtIssue ?? '-'}. Còn nợ hiện tại:{' '}
          {doc.invoiceBalance?.outstandingAmount ?? '-'}. Xác nhận tiền:{' '}
          {doc.upfrontConfirmationId ?? '-'}. Phiếu thu tự động:{' '}
          {doc.autoReceiptId ?? '-'}.
        </p>
      )}
      {doc.kind === 'SALES_RETURN' && (
        <p>
          Phiếu xuất gốc: {doc.originDocumentId}. Nợ giảm:{' '}
          {doc.debtReducedAmount ?? '-'}. Dư có tạo:{' '}
          {doc.creditCreatedAmount ?? '-'}. Không tự động hoàn tiền.
        </p>
      )}
      {doc.kind === 'STOCK_ADJUSTMENT' && (
        <p>
          Nguồn kiểm kê: {doc.stockCountId ?? 'Điều chỉnh độc lập'}. Không tạo
          doanh thu hay đổi nguồn giá nhập.
        </p>
      )}
      <Table caption="Dòng hàng theo phiên bản máy chủ">
        <thead>
          <tr>
            <th>ID dòng</th>
            <th>Mặt hàng đã ghi nhận</th>
            <th>Số lượng</th>
            <th>Đơn vị</th>
            <th>Đơn giá</th>
            <th>Thành tiền</th>
            <th>Dòng gốc</th>
          </tr>
        </thead>
        <tbody>
          {revision.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.id}</td>
              <td>
                {line.productName} (#{line.productId})
              </td>
              <td>{line.quantity}</td>
              <td>{line.unitName}</td>
              <td>{line.unitPrice}</td>
              <td>{line.lineAmount}</td>
              <td>{line.originLineId ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
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
  const mutation = useDocumentMutation()
  const scope = `${user?.id}:${allowedFunctions.join(',')}`
  const readable = canReadKind(kind, hasPermission)
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
  function openForm(mode: 'create' | 'header' | 'pending') {
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
  async function loadSource() {
    if (!validId(originId) || sourceBusy) return
    sourceController.current?.abort()
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
        if (!validId(agencyId)) throw new Error('ID đại lý không hợp lệ.')
        body.agencyId = agencyId
      }
      if (create && kind === 'SALES_RETURN') {
        if (!validId(originId))
          throw new Error('ID phiếu xuất gốc không hợp lệ.')
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
      setNotice('Máy chủ đã xác nhận lưu chứng từ.')
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
      setNotice('Máy chủ đã xác nhận thao tác.')
      invalidateCache(config.path)
      reload()
    } catch (error) {
      setDetailError(errorMessage(error))
      if (error instanceof ApiError && [412, 428].includes(error.status))
        setDetail({ ...detail, etag: null })
    }
  }
  const draft =
    detail?.doc.status === 'DRAFT' &&
    detail.doc.currentRevision.state === 'DRAFT'
  const independent =
    kind !== 'STOCK_ADJUSTMENT' || detail?.doc.stockCountId === null
  const closeForm = () => {
    if (!mutation.busy) {
      setCreate(false)
      setEditHeader(false)
      setReplacePending(false)
      sourceController.current?.abort()
      setSourceBusy(false)
    }
  }
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{config.title}</h1>
          <p className="page-desc">
            Dữ liệu và số tiền do máy chủ xác nhận. Không sửa dữ liệu gốc đã ghi
            sổ.
          </p>
        </div>
        {hasPermission(config.prepare) && (
          <Button onClick={() => openForm('create')}>Lập phiếu mới</Button>
        )}
      </div>
      {notice && <Alert type="success">{notice}</Alert>}
      <DocumentList
        key={version}
        kind={kind}
        actions={(row) => (
          <Button variant="outline" onClick={() => openDetail(row.id)}>
            Chi tiết {row.code}
          </Button>
        )}
      />
      <Modal
        isOpen={!!selected}
        title="Chi tiết chứng từ"
        onClose={() => {
          if (!mutation.busy) {
            setSelected(null)
            setDetail(null)
            setCorrection(null)
          }
        }}
        maxWidth="lg"
      >
        {detailLoading && <Spinner label="Đang tải phiên bản và ETag..." />}
        {detailError && <Alert type="error">{detailError}</Alert>}
        {detail && (
          <>
            <DocumentSnapshot doc={detail.doc} />
            {kind === 'STOCK_ISSUE' &&
              detail.doc.currentRevision.state === 'READY' && (
                <p>
                  READY đã chốt giá, không giữ chỗ tồn kho. Máy chủ kiểm tra
                  bằng chứng trả ngay và tồn kho khi xuất.
                </p>
              )}
            <div className="modal-actions">
              <Button
                variant="outline"
                onClick={reload}
                disabled={mutation.busy}
              >
                Tải lại phiên bản
              </Button>
              {draft && independent && hasPermission(config.prepare) && (
                <Button
                  disabled={!detail.etag || mutation.busy}
                  onClick={() => openForm('header')}
                >
                  Sửa thông tin nháp
                </Button>
              )}
              {kind === 'STOCK_ISSUE' &&
                draft &&
                hasPermission(config.prepare) && (
                  <Button
                    disabled={!detail.etag}
                    isLoading={mutation.busy}
                    onClick={() => void action('submit')}
                  >
                    Nộp phiếu
                  </Button>
                )}
              {kind === 'STOCK_ISSUE' &&
                detail.doc.status === 'PENDING' &&
                hasPermission(config.prepare) && (
                  <Button
                    disabled={!detail.etag || mutation.busy}
                    onClick={() => openForm('pending')}
                  >
                    Thay nội dung chờ xuất
                  </Button>
                )}
              {independent &&
                hasPermission(config.post) &&
                (kind === 'STOCK_ISSUE'
                  ? detail.doc.status === 'PENDING' &&
                    detail.doc.currentRevision.state === 'READY'
                  : draft) && (
                  <Button
                    disabled={!detail.etag}
                    isLoading={mutation.busy}
                    onClick={() => void action('post')}
                  >
                    Ghi sổ
                  </Button>
                )}
              {detail.doc.status !== 'CANCELLED' && (
                <Button
                  variant="outline"
                  disabled={mutation.busy}
                  onClick={() => setCorrection('cancel')}
                >
                  Xem quyền hủy
                </Button>
              )}
              {detail.doc.status === 'POSTED' && (
                <Button
                  variant="outline"
                  disabled={mutation.busy}
                  onClick={() => setCorrection('correct')}
                >
                  Xem quyền sửa sai
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
      <Modal
        isOpen={create || editHeader || replacePending}
        title={
          create
            ? 'Lập phiếu mới'
            : replacePending
              ? 'Thay toàn bộ nội dung chờ xuất'
              : 'Sửa thông tin nháp'
        }
        onClose={closeForm}
        maxWidth="lg"
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {formError && <Alert type="error">{formError}</Alert>}
          <fieldset disabled={mutation.busy}>
            <Input
              label="Ngày nghiệp vụ"
              aria-label="Ngày nghiệp vụ"
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            {create && kind === 'STOCK_ISSUE' && (
              <Input
                label="ID đại lý"
                aria-label="ID đại lý"
                required
                value={agencyId}
                onChange={(event) => setAgencyId(event.target.value)}
              />
            )}
            {create && kind === 'SALES_RETURN' && (
              <>
                <Input
                  label="ID phiếu xuất gốc"
                  aria-label="ID phiếu xuất gốc"
                  required
                  value={originId}
                  onChange={(event) => {
                    sourceController.current?.abort()
                    setSourceBusy(false)
                    setOriginId(event.target.value)
                    setSource(null)
                  }}
                />
                {canReadKind('STOCK_ISSUE', hasPermission) && (
                  <Button
                    type="button"
                    onClick={() => void loadSource()}
                    disabled={!validId(originId)}
                    isLoading={sourceBusy}
                  >
                    Xem phiếu xuất gốc
                  </Button>
                )}
                {source && (
                  <>
                    <DocumentSnapshot doc={source} />
                    <p>
                      Chọn dòng gốc, sau đó nhập lượng hàng thực nhận. Máy chủ
                      kiểm tra lượng đã trả; không suy ra lượng còn có thể trả
                      tại đây.
                    </p>
                    {source.currentRevision.lines.map((line) => (
                      <Button
                        key={line.id}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setLines([
                            ...lines.filter((item) => item.originLineId),
                            { ...emptyLine(), originLineId: line.id },
                          ])
                        }
                      >
                        Chọn dòng {line.id}: {line.productName}
                      </Button>
                    ))}
                  </>
                )}
              </>
            )}
            {kind === 'STOCK_ISSUE' && (
              <Input
                label="Trả ngay dự kiến (VNĐ)"
                aria-label="Trả ngay dự kiến (VNĐ)"
                required
                inputMode="numeric"
                value={immediatePayment}
                onChange={(event) => setImmediatePayment(event.target.value)}
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
            <Input
              label="Ghi chú"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </fieldset>
          {!editHeader && (
            <GoodsLineEditor
              kind={kind}
              lines={lines}
              onChange={setLines}
              disabled={mutation.busy}
            />
          )}
          <div className="modal-actions">
            <Button type="submit" isLoading={mutation.busy}>
              Lưu chứng từ
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.busy}
              onClick={closeForm}
            >
              Đóng
            </Button>
          </div>
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
    </div>
  )
}
