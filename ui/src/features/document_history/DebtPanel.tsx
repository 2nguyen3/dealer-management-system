import { cn } from '@/lib/utils'
import { formatVND } from '../../lib/formatters'
import { t } from '@/lib/i18n/core'

/**
 * Current debt, the agency-type limit and the debt after this document
 * (QĐ3/QĐ4). `change` is the signed effect of the document being prepared
 * (+ issue total, − payment amount); omit it for a posted document. All
 * values are exact whole-VND strings or bigints; the server is the authority.
 */
export function DebtPanel({
  debt,
  maxDebt,
  change = null,
  afterLabel = t('Nợ sau phiếu'),
  className,
}: {
  debt: string
  maxDebt: string
  change?: bigint | null
  afterLabel?: string
  className?: string
}) {
  const current = BigInt(debt)
  const limit = BigInt(maxDebt)
  const after = change === null ? null : current + change
  const over = after !== null && change !== null && change > 0n && after > limit
  // Only a payment (negative change) may not exceed the debt; an issue may
  // leave a prepaid (negative) balance.
  const negative =
    after !== null && change !== null && change < 0n && after < 0n
  return (
    <dl
      aria-label={t('Công nợ đại lý')}
      className={cn(
        'grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3',
        className,
      )}
    >
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{t('Nợ hiện tại')}</dt>
        <dd className="font-semibold tabular-nums">{formatVND(debt)}</dd>
        {current < 0n && (
          <dd className="text-xs text-info">{t('Đại lý đang trả trước')}</dd>
        )}
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{t('Nợ tối đa')}</dt>
        <dd className="font-semibold tabular-nums">{formatVND(maxDebt)}</dd>
      </div>
      {after !== null && (
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-xs text-muted-foreground">{afterLabel}</dt>
          <dd
            className={cn(
              'font-semibold tabular-nums',
              (over || negative) && 'text-destructive',
            )}
          >
            {formatVND(after.toString())}
          </dd>
          {over && (
            <dd role="alert" className="text-xs text-destructive">
              {t('Vượt nợ tối đa; hệ thống sẽ từ chối khi ghi sổ.')}
            </dd>
          )}
          {negative && (
            <dd role="alert" className="text-xs text-destructive">
              {t('Số tiền thu vượt nợ hiện tại.')}
            </dd>
          )}
        </div>
      )}
    </dl>
  )
}
