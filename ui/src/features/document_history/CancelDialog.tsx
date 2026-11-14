import { XCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { Label } from '../../components/shadcn/label'
import { Textarea } from '../../components/shadcn/textarea'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/guide/ErrorNotice'
import { formatVND } from '../../lib/formatters'
import type { DocumentDetail } from './documentContracts'
import { cancelEffect } from './workflow'
import { t } from '@/lib/i18n/core'

/**
 * "Hủy" of a posted document: a mandatory reason, the reversed effect and,
 * for payment receipts, the QĐ7 warning that debt may exceed its limit.
 */
export function CancelDialog({
  doc,
  busy,
  error,
  failure,
  onConfirm,
  onClose,
}: {
  doc: DocumentDetail
  busy: boolean
  error: string | null
  failure?: unknown
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const missing = !reason.trim()
  const payment = doc.kind === 'PAYMENT_RECEIPT'
  const overLimit =
    payment &&
    doc.agencyDebt !== null &&
    doc.agencyMaxDebt !== null &&
    BigInt(doc.agencyDebt) + BigInt(doc.totalAmount) > BigInt(doc.agencyMaxDebt)
  return (
    <Modal
      isOpen
      title={t('Hủy {code}', { code: doc.code })}
      maxWidth="md"
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t('Quay lại')}
          </Button>
          <Button
            variant="danger"
            icon={<XCircle className="size-4" />}
            isLoading={busy}
            onClick={() => {
              setTouched(true)
              if (!missing) onConfirm(reason.trim())
            }}
          >
            {t('Xác nhận hủy')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNotice error={failure} message={error} />}
        <p className="text-sm leading-relaxed text-foreground">
          {cancelEffect(doc.kind)}
        </p>
        {payment && (
          <Alert type="warning" title={t('Công nợ có thể vượt nợ tối đa')}>
            {overLimit
              ? t(
                  'Sau khi hủy, nợ của đại lý sẽ là {after}, vượt nợ tối đa {max}. Vẫn được phép vì đây là sửa sai.',
                  {
                    after: formatVND(
                      (
                        BigInt(doc.agencyDebt!) + BigInt(doc.totalAmount)
                      ).toString(),
                    ),
                    max: formatVND(doc.agencyMaxDebt!),
                  },
                )
              : t(
                  'Hủy phiếu thu làm nợ đại lý tăng lại {amount}; nợ có thể vượt nợ tối đa và vẫn được phép vì đây là sửa sai.',
                  { amount: formatVND(doc.totalAmount) },
                )}
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={reasonId} className="text-[13px]">
            {t('Lý do hủy')}{' '}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Textarea
            id={reasonId}
            required
            rows={3}
            className="bg-card"
            disabled={busy}
            aria-invalid={touched && missing ? true : undefined}
            placeholder={t('Ví dụ: Lập nhầm phiếu, đại lý hủy đơn…')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {touched && missing && (
            <p role="alert" className="text-xs text-destructive">
              {t('Vui lòng nhập lý do hủy.')}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
