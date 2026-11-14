import { BookCheck, Info, Save, Undo2 } from 'lucide-react'
import { useId, useState } from 'react'
import { DateField } from '../../components/blocks/DateField'
import { Separator } from '../../components/shadcn/separator'
import { Label } from '../../components/shadcn/label'
import { Textarea } from '../../components/shadcn/textarea'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { ErrorNotice } from '../../components/guide/ErrorNotice'
import { formatVND } from '../../lib/formatters'
import { methodLabel } from '../../lib/labels'
import { DebtPanel } from '../document_history/DebtPanel'
import {
  documentKinds,
  exact,
  MANUAL_RECEIPT_TYPES,
  monthOf,
  vietnamToday,
  type DocumentDetail,
  type DocumentForm,
  type DocumentKind,
  type ManualReceiptType,
} from '../document_history/documentContracts'
import { InfoTip, SectionCard } from '../document_history/DocumentParts'
import {
  useAgencyBalance,
  useProductQuotes,
} from '../document_history/useRecords'
import { GoodsLineEditor } from './GoodsLineEditor'
import { paymentLimit, summarizeLines } from './lineEstimates'
import { t } from '@/lib/i18n/core'

export type FormMode = 'create' | 'edit' | 'correct'

/**
 * Create / edit-draft / correct form of any document kind. Corrections keep
 * the agency, require a reason and post the replacement immediately. Amounts
 * shown are estimates; the server validates every rule (QĐ2–QĐ8).
 */
export function DocumentFormModal({
  kind,
  mode,
  initial,
  doc,
  busy,
  error,
  failure,
  canPostNow,
  onSubmit,
  onClose,
}: {
  kind: DocumentKind
  mode: FormMode
  initial: DocumentForm
  /** The draft being edited or the posted document being corrected. */
  doc?: DocumentDetail | null
  busy: boolean
  error: string | null
  failure?: unknown
  /** Offer "Lưu & ghi sổ" (create/edit only). */
  canPostNow: boolean
  onSubmit: (form: DocumentForm, post: boolean) => void
  onClose: () => void
}) {
  const reasonId = useId()
  const [form, setForm] = useState<DocumentForm>(initial)
  const [localError, setLocalError] = useState<string | null>(null)
  const today = vietnamToday()
  const correct = mode === 'correct'
  const payment = kind === 'PAYMENT_RECEIPT'
  const goods = kind !== 'PAYMENT_RECEIPT'
  const agencyId = form.agencyId
  const agency = useAgencyBalance(kind === 'STOCK_RECEIPT' ? '' : agencyId)
  const quotes = useProductQuotes(
    kind === 'STOCK_ISSUE' ? form.lines.map((line) => line.productId) : [],
  )
  const summary = goods ? summarizeLines(kind, form.lines, quotes) : null
  const title = documentKinds[kind].title.toLowerCase()
  // Effect of the original document that a correction cancels first.
  const reversed =
    correct && doc && doc.status === 'POSTED' ? BigInt(doc.totalAmount) : 0n
  const amountValid = exact.positiveMoney.test(form.amount.trim())
  const change: bigint | null = payment
    ? amountValid
      ? reversed - BigInt(form.amount.trim())
      : null
    : kind === 'STOCK_ISSUE' && summary && summary.pricedLines > 0
      ? summary.subtotal - reversed
      : null
  const limit = payment ? paymentLimit(agency.balance?.debt, reversed) : null
  const set = (patch: Partial<DocumentForm>) => {
    setLocalError(null)
    setForm((current) => ({ ...current, ...patch }))
  }
  function submit(post: boolean) {
    if (busy) return
    if (payment && limit !== null && amountValid) {
      if (limit <= 0n) {
        setLocalError(t('Đại lý không còn nợ để thu.'))
        return
      }
      if (BigInt(form.amount.trim()) > limit) {
        setLocalError(
          t('Số tiền thu không được vượt nợ hiện tại ({debt}).', {
            debt: formatVND(limit.toString()),
          }),
        )
        return
      }
    }
    onSubmit(form, post)
  }
  const heading = correct
    ? t('Sửa có lý do {code}', { code: doc?.code ?? '' })
    : mode === 'edit'
      ? t('Sửa nháp {code}', { code: doc?.code ?? '' })
      : t('Tạo {title}', { title })
  return (
    <Modal
      isOpen
      title={heading}
      onClose={() => {
        if (!busy) onClose()
      }}
      maxWidth={goods ? 'xl' : 'md'}
    >
      <form
        noValidate
        className={
          goods
            ? 'grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]'
            : 'space-y-4'
        }
        onSubmit={(event) => {
          event.preventDefault()
          submit(false)
        }}
      >
        <div className="min-w-0 space-y-4">
          {(localError || error) && (
            <ErrorNotice
              error={localError ? null : failure}
              message={localError ?? error}
            />
          )}
          {correct && doc && (
            <Alert
              type="warning"
              title={t('Hủy phiếu cũ và lập phiếu thay thế')}
            >
              {t(
                '{code} sẽ bị hủy và phiếu mới được ghi sổ ngay. Nếu phiếu mới vi phạm quy định thì không có gì thay đổi.',
                { code: doc.code },
              )}
            </Alert>
          )}
          <SectionCard title={t('Thông tin chung')} icon={<Info />}>
            <fieldset
              disabled={busy}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <legend className="sr-only">{t('Thông tin chung')}</legend>
              <DateField
                label={t('Ngày chứng từ')}
                required
                disabled={busy}
                value={form.businessDate}
                max={today}
                min={correct ? `${monthOf(today)}-01` : undefined}
                onChange={(businessDate) => set({ businessDate })}
              />
              {kind !== 'STOCK_RECEIPT' &&
                (correct ? (
                  <div className="space-y-1.5">
                    <p className="text-[13px] font-medium text-foreground/85">
                      {t('Đại lý')}
                    </p>
                    <p className="text-sm font-medium">
                      {doc?.agencyName ?? `#${agencyId}`}
                    </p>
                  </div>
                ) : (
                  <EntityPicker
                    resource="agencies"
                    label={t('Đại lý')}
                    required
                    disabled={busy}
                    params={{ status: 'ACTIVE' }}
                    value={agencyId}
                    onChange={(id) => set({ agencyId: id })}
                  />
                ))}
              {payment && (
                <>
                  <Select
                    label={t('Hình thức thu')}
                    value={form.receiptType}
                    disabled={busy}
                    onChange={(event) =>
                      set({
                        receiptType: event.target.value as ManualReceiptType,
                      })
                    }
                    options={MANUAL_RECEIPT_TYPES.map((value) => ({
                      value,
                      label: methodLabel(value),
                    }))}
                  />
                  <div className="space-y-1.5">
                    <Input
                      label={t('Số tiền thu (VNĐ)')}
                      required
                      inputMode="numeric"
                      className="text-end tabular-nums"
                      value={form.amount}
                      helperText={
                        amountValid ? formatVND(form.amount) : undefined
                      }
                      onChange={(event) => set({ amount: event.target.value })}
                    />
                    {limit !== null && limit > 0n && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        icon={false}
                        onClick={() => set({ amount: limit.toString() })}
                      >
                        {t('Thu toàn bộ nợ {debt}', {
                          debt: formatVND(limit.toString()),
                        })}
                      </Button>
                    )}
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Input
                  label={t('Ghi chú')}
                  value={form.note}
                  onChange={(event) => set({ note: event.target.value })}
                />
              </div>
              {correct && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={reasonId} className="text-[13px]">
                    {t('Lý do sửa')}{' '}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Textarea
                    id={reasonId}
                    required
                    rows={2}
                    className="bg-card"
                    placeholder={t('Ví dụ: Nhập sai số lượng dòng 2…')}
                    value={form.reason}
                    onChange={(event) => set({ reason: event.target.value })}
                  />
                </div>
              )}
            </fieldset>
            {kind !== 'STOCK_RECEIPT' && agency.error && (
              <p role="alert" className="mt-3 text-xs text-destructive">
                {agency.error}
              </p>
            )}
            {agency.balance && (
              <DebtPanel
                className="mt-4"
                debt={agency.balance.debt}
                maxDebt={agency.balance.maxDebt}
                change={change}
                afterLabel={payment ? t('Nợ sau khi thu') : t('Nợ sau phiếu')}
              />
            )}
          </SectionCard>
          {goods && (
            <GoodsLineEditor
              kind={kind}
              lines={form.lines}
              onChange={(lines) => set({ lines })}
              disabled={busy}
              quotes={quotes}
            />
          )}
          {!goods && (
            <FormButtons
              mode={mode}
              busy={busy}
              canPostNow={canPostNow}
              onPost={() => submit(true)}
              onClose={onClose}
            />
          )}
        </div>
        {goods && summary && (
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
                      'Tạm tính theo giá bán hiện tại; đơn giá chính thức do hệ thống chốt khi ghi sổ.',
                    )
                  : t('Số tiền chính thức do hệ thống tính khi lưu.')}
              </InfoTip>
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('Số dòng hàng')}</dt>
                <dd className="font-medium tabular-nums">
                  {summary.lineCount}
                </dd>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-medium text-foreground">{t('Tạm tính')}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatVND(summary.subtotal.toString())}
                </dd>
              </div>
              {summary.lineCount - summary.pricedLines > 0 && (
                <p className="text-xs text-warning">
                  {t('{missing} dòng chưa đủ số lượng/đơn giá', {
                    missing: summary.lineCount - summary.pricedLines,
                  })}
                </p>
              )}
            </dl>
            <FormButtons
              mode={mode}
              busy={busy}
              canPostNow={canPostNow}
              onPost={() => submit(true)}
              onClose={onClose}
              stacked
            />
          </aside>
        )}
      </form>
    </Modal>
  )
}

function FormButtons({
  mode,
  busy,
  canPostNow,
  onPost,
  onClose,
  stacked = false,
}: {
  mode: FormMode
  busy: boolean
  canPostNow: boolean
  onPost: () => void
  onClose: () => void
  stacked?: boolean
}) {
  return (
    <div
      className={
        stacked
          ? 'grid gap-2'
          : 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
      }
    >
      {mode === 'correct' ? (
        <Button
          type="submit"
          isLoading={busy}
          icon={<Undo2 className="size-4" />}
        >
          {t('Hủy phiếu cũ & ghi sổ phiếu mới')}
        </Button>
      ) : (
        <>
          <Button
            type="submit"
            variant={canPostNow ? 'outline' : 'primary'}
            isLoading={busy}
            icon={<Save className="size-4" />}
          >
            {t('Lưu nháp')}
          </Button>
          {canPostNow && (
            <Button
              type="button"
              disabled={busy}
              icon={<BookCheck className="size-4" />}
              onClick={onPost}
            >
              {t('Lưu & ghi sổ')}
            </Button>
          )}
        </>
      )}
      <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
        {t('Đóng')}
      </Button>
    </div>
  )
}
