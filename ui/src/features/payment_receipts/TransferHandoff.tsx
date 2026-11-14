import { Clock3, ExternalLink } from 'lucide-react'
import { SafeLink } from '../../components/guide/SafeLink'
import { Button as ShadcnButton } from '../../components/shadcn/button'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { formatDateTime, formatVND } from '../../lib/formatters'
import { t } from '../../lib/i18n/core'
import { usePathAllowed } from '../guide/usePathAllowed'
import { CheckoutActions, CheckoutQr } from '../online_payments/CheckoutParts'
import { checkoutUrl } from '../online_payments/paymentFlow'
import type { Row } from './contracts'
import { PdfButton } from './PdfButton'

/**
 * Result of "Chuyển khoản (VNPAY)" on the payment receipt form: the pending
 * online payment with its QR, link and the downloadable payment request PDF.
 * No receipt exists yet — VNPAY's confirmation posts it automatically.
 */
export function TransferHandoff({
  payment,
  onClose,
}: {
  payment: Row
  onClose: () => void
}) {
  const allowed = usePathAllowed()
  const id = String(payment.id)
  const url =
    payment.status === 'PENDING' ? checkoutUrl(payment.checkoutUrl) : null
  const agency = [payment.agencyCode, payment.agencyName]
    .filter((part) => typeof part === 'string' && part)
    .join(' · ')
  const detailLink = `/online-payments?paymentId=${encodeURIComponent(id)}`
  return (
    <Modal
      isOpen
      title={t('Thanh toán chuyển khoản')}
      onClose={onClose}
      maxWidth="md"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {allowed('/online-payments') && (
            <ShadcnButton asChild variant="ghost" className="me-auto">
              <SafeLink to={detailLink}>
                <ExternalLink className="size-4" aria-hidden="true" />
                {t('Xem trong Thanh toán trực tuyến')}
              </SafeLink>
            </ShadcnButton>
          )}
          <PdfButton
            path={`/online-payments/${id}/print`}
            filename={`phieu-bao-thanh-toan-${id}.pdf`}
          >
            {t('Tải PDF phiếu báo thanh toán')}
          </PdfButton>
          <Button variant="outline" onClick={onClose}>
            {t('Đóng')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4" data-testid="transfer-handoff">
        <Alert type="info" title={t('Đã tạo giao dịch chờ thanh toán')}>
          {t(
            'Gửi mã QR hoặc phiếu báo PDF cho đại lý. Khi VNPAY xác nhận tiền về, hệ thống tự lập phiếu thu, ghi sổ và trừ công nợ; khi đó có thể xuất PDF phiếu thu.',
          )}
        </Alert>
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          {url ? (
            <CheckoutQr url={url} size={152} />
          ) : (
            <div className="flex size-40 items-center justify-center rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
              {t('Chưa có liên kết')}
            </div>
          )}
          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {t('Số tiền cần trả')}
              </p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatVND(String(payment.amount))}
              </p>
              {agency && <p className="truncate text-sm">{agency}</p>}
              <p className="truncate font-mono text-xs text-muted-foreground">
                {String(payment.merchantReference)}
              </p>
            </div>
            {typeof payment.expiresAt === 'string' && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {t('Hạn thanh toán: {time}', {
                  time: formatDateTime(payment.expiresAt),
                })}
              </p>
            )}
            {url && <CheckoutActions url={url} />}
          </div>
        </div>
      </div>
    </Modal>
  )
}
