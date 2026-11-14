import { Ban, ChevronDown, FilePen, Undo2, XCircle } from 'lucide-react'
import { notifyNextStep } from '../../components/guide/notifyNextStep'
import { WorkflowSteps } from '../../components/guide/WorkflowSteps'
import { t } from '../../lib/i18n/core'
import { correctionSteps } from '../guide/workflows'
import { useId, useState } from 'react'
import { DateField } from '../../components/blocks/DateField'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../components/shadcn/collapsible'
import { Label } from '../../components/shadcn/label'
import { Textarea } from '../../components/shadcn/textarea'
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
import { SectionCard } from '../document_history/DocumentParts'
import {
  errorMessage,
  useDocumentMutation,
} from '../document_history/useDocumentRequests'
import { DocumentSnapshot } from '../stock_receipts/DocumentSnapshot'
import { GoodsLineEditor } from '../stock_receipts/GoodsLineEditor'

const goodsKinds = [
  'STOCK_RECEIPT',
  'STOCK_ISSUE',
  'STOCK_ADJUSTMENT',
  'SALES_RETURN',
]

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
  const formId = useId()
  const reasonId = useId()
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
  const cancel = mode === 'cancel'
  const locked = mutation.busy || !allowed || stale
  async function submit() {
    if (!allowed || mutation.busy || stale) return
    setError(null)
    try {
      if (!etag) throw new Error(t('Cần tải lại phiên bản và ETag hiện hành.'))
      if (!reason.trim()) throw new Error(t('Cần lý do bắt buộc.'))
      const body = cancel
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
        `${documentKinds[doc.kind].path}/${doc.id}/${cancel ? 'cancel' : 'corrections'}`,
        { body, ifMatch: etag },
      )
      invalidateCache(documentKinds[doc.kind].path)
      invalidateCache('/documents')
      notifyNextStep({
        done: cancel
          ? t('Đã hủy {code}.', { code: doc.code })
          : t('Đã tạo phiên bản thay thế cho {code}.', { code: doc.code }),
        next: t(
          'Tồn kho, công nợ và dư có liên quan đã được tính lại theo thứ tự ngày nghiệp vụ. Xem Lịch sử chứng từ để đối chiếu.',
        ),
        to: '/document-history',
      })
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
        cancel
          ? t('Hủy chứng từ {code}', { code: doc.code })
          : t('Thay thế toàn bộ {code}', { code: doc.code })
      }
      maxWidth="xl"
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.busy}
            onClick={onClose}
          >
            {t('Đóng')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={cancel ? 'danger' : 'primary'}
            icon={
              cancel ? (
                <XCircle className="size-4" />
              ) : (
                <Undo2 className="size-4" />
              )
            }
            disabled={!allowed || !etag || stale}
            isLoading={mutation.busy}
          >
            {t('Xác nhận')} {cancel ? t('hủy') : t('thay thế')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!allowed && (
          <Alert type="error">
            {t(
              'Không có quyền hoặc chứng từ không được sửa/hủy. Hủy phiếu xuất đã thu tiền ngay cần thêm quyền ghi sổ phiếu thu.',
            )}
          </Alert>
        )}
        <WorkflowSteps
          label={t('Quy trình sửa sai và hủy')}
          steps={correctionSteps(cancel)}
        />
        <Alert
          type={cancel ? 'warning' : 'info'}
          title={
            cancel
              ? t('Hủy là thao tác không hoàn tác')
              : t('Sửa sai bằng phiên bản mới')
          }
        >
          {cancel
            ? t(
                'Tồn kho và công nợ được kiểm tra lại; tiền đã thu không bị xóa.',
              )
            : t(
                'Lưu thành phiên bản mới sau khi kiểm tra tồn kho, công nợ.',
              )}{' '}
          {t(
            'Hệ thống tính lại dây chuyền các chứng từ phía sau; nếu một chứng từ phía sau không còn hợp lệ (tồn âm, thu vượt nợ…) thao tác sẽ bị từ chối.',
          )}
        </Alert>
        <Collapsible className="group rounded-xl border bg-muted/30">
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-start text-[13px] font-medium text-foreground">
            {t('Chứng từ hiện tại')}
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t p-4">
            <DocumentSnapshot doc={doc} />
          </CollapsibleContent>
        </Collapsible>
        <form
          id={formId}
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {error && <Alert type="error">{error}</Alert>}
          {stale && (
            <Alert type="error">
              {t(
                'Chứng từ vừa được người khác thay đổi. Đóng biểu mẫu, tải lại và kiểm tra trước khi thực hiện lại.',
              )}
            </Alert>
          )}
          <SectionCard
            title={cancel ? t('Lý do hủy') : t('Thông tin thay thế')}
            icon={cancel ? <Ban /> : <FilePen />}
            description={
              cancel
                ? t('Lưu cùng lịch sử.')
                : t('Thay toàn bộ phiên bản hiện hành.')
            }
          >
            <fieldset
              disabled={locked}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <legend className="sr-only">
                {cancel ? t('Lý do hủy') : t('Thông tin thay thế')}
              </legend>
              {!cancel && (
                <>
                  <DateField
                    label={t('Ngày nghiệp vụ mới')}
                    disabled={locked}
                    clearable={false}
                    value={date}
                    onChange={setDate}
                  />
                  <Input
                    label={t('Ghi chú thay thế')}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  {(doc.kind === 'PAYMENT_RECEIPT' ||
                    doc.kind === 'CREDIT_APPLICATION') && (
                    <Input
                      label={t('Số tiền thay thế (VNĐ)')}
                      value={amount}
                      inputMode="numeric"
                      className="tabular-nums"
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  )}
                  {doc.kind === 'PAYMENT_RECEIPT' && (
                    <Select
                      label={t('Phương thức thu')}
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      options={[
                        { value: 'CASH', label: t('Tiền mặt') },
                        { value: 'BANK_TRANSFER', label: t('Chuyển khoản') },
                      ]}
                    />
                  )}
                </>
              )}
              <div className="form-field grid gap-1.5 sm:col-span-2">
                <Label
                  htmlFor={reasonId}
                  className="text-[13px] text-foreground/85"
                >
                  {t('Lý do bắt buộc')}{' '}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Textarea
                  id={reasonId}
                  required
                  rows={2}
                  className="bg-card"
                  placeholder={
                    cancel
                      ? t('Ví dụ: Lập nhầm phiếu, đại lý hủy đơn…')
                      : t('Ví dụ: Nhập sai số lượng dòng 2…')
                  }
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            </fieldset>
          </SectionCard>
          {!cancel && goodsKinds.includes(doc.kind) && (
            <GoodsLineEditor
              kind={doc.kind as GoodsKind}
              lines={lines}
              onChange={setLines}
              disabled={locked}
            />
          )}
        </form>
      </div>
    </Modal>
  )
}
