import { useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { ApiError } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { useAuth } from '../authentication/useAuth'
import {
  canChange,
  documentKinds,
  replacementBody,
  type DocumentDetail,
  type GoodsKind,
  type LineInput,
} from '../document_history/documentContracts'
import {
  errorMessage,
  useDocumentMutation,
} from '../document_history/useDocumentRequests'
import {
  DocumentSnapshot,
  GoodsLineEditor,
} from '../stock_receipts/GoodsDocumentsPage'

export function CorrectionDialog({
  doc,
  etag,
  mode,
  onClose,
  onSaved,
}: {
  doc: DocumentDetail
  etag: string | null
  mode: 'correct' | 'cancel'
  onClose: () => void
  onSaved: () => void
}) {
  const { hasPermission } = useAuth()
  const revision = doc.currentRevision
  const [date, setDate] = useState(revision.businessDate)
  const [note, setNote] = useState(revision.note ?? '')
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState(revision.totalAmount)
  const [paymentMethod, setPaymentMethod] = useState(
    revision.paymentMethod ?? 'CASH',
  )
  const [lines, setLines] = useState<LineInput[]>(
    revision.lines.map((line) => ({
      productId: line.productId,
      originLineId: line.originLineId ?? '',
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      basePurchasePrice: line.basePurchasePrice ?? undefined,
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const mutation = useDocumentMutation()
  const allowed = canChange(doc, mode, hasPermission)
  async function submit() {
    if (!allowed || mutation.busy || stale) return
    setError(null)
    try {
      if (!etag) throw new Error('Cần tải lại phiên bản và ETag hiện hành.')
      if (!reason.trim()) throw new Error('Cần lý do bắt buộc.')
      const body =
        mode === 'cancel'
          ? { reason: reason.trim() }
          : replacementBody(doc, {
              businessDate: date,
              note,
              reason,
              amount,
              paymentMethod,
              lines,
            })
      await mutation.run(
        `${documentKinds[doc.kind].path}/${doc.id}/${mode === 'cancel' ? 'cancel' : 'corrections'}`,
        { body, ifMatch: etag },
      )
      invalidateCache(documentKinds[doc.kind].path)
      invalidateCache('/documents')
      onSaved()
    } catch (failure) {
      setError(errorMessage(failure))
      if (failure instanceof ApiError && [412, 428].includes(failure.status))
        setStale(true)
    }
  }
  return (
    <Modal
      isOpen
      title={
        mode === 'cancel'
          ? `Hủy chứng từ ${doc.code}`
          : `Thay thế toàn bộ ${doc.code}`
      }
      maxWidth="lg"
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
    >
      {!allowed && (
        <Alert type="error">
          Không đủ quyền hoặc chứng từ được bảo vệ. Hủy phiếu xuất có bằng chứng
          trả ngay cần thêm cash.receipt.post. Máy chủ vẫn kiểm tra trạng thái
          tiền hiện hành.
        </Alert>
      )}
      <details>
        <summary>Bản gốc chỉ đọc, không bị ghi đè</summary>
        <DocumentSnapshot doc={doc} />
      </details>
      <p>
        Không phải bản xem trước tác động. Máy chủ quyết định số tiền, tồn kho,
        công nợ và các ràng buộc lịch sử; không xóa bằng chứng tiền thực nhận.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        {stale && (
          <Alert type="error">
            Phiên bản đã đổi. Đóng biểu mẫu, tải lại và xem xét dữ liệu trước
            khi gửi lại; không tự động ghi đè.
          </Alert>
        )}
        <fieldset disabled={mutation.busy || !allowed || stale}>
          {mode === 'correct' && (
            <>
              <Input
                label="Ngày nghiệp vụ mới"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <Input
                label="Ghi chú thay thế"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              {(doc.kind === 'PAYMENT_RECEIPT' ||
                doc.kind === 'CREDIT_APPLICATION') && (
                <Input
                  label="Số tiền thay thế (VNĐ)"
                  value={amount}
                  inputMode="numeric"
                  onChange={(event) => setAmount(event.target.value)}
                />
              )}
              {doc.kind === 'PAYMENT_RECEIPT' && (
                <Select
                  label="Phương thức thu"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  options={[
                    { value: 'CASH', label: 'Tiền mặt' },
                    { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
                  ]}
                />
              )}
            </>
          )}
          <Input
            label="Lý do bắt buộc"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </fieldset>
        {mode === 'correct' &&
          [
            'STOCK_RECEIPT',
            'STOCK_ISSUE',
            'STOCK_ADJUSTMENT',
            'SALES_RETURN',
          ].includes(doc.kind) && (
            <GoodsLineEditor
              kind={doc.kind as GoodsKind}
              lines={lines}
              onChange={setLines}
              disabled={mutation.busy || !allowed || stale}
            />
          )}
        <div className="modal-actions">
          <Button
            type="submit"
            variant={mode === 'cancel' ? 'danger' : 'primary'}
            disabled={!allowed || !etag || stale}
            isLoading={mutation.busy}
          >
            Xác nhận {mode === 'cancel' ? 'hủy' : 'thay thế'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.busy}
            onClick={onClose}
          >
            Đóng
          </Button>
        </div>
      </form>
    </Modal>
  )
}
