import { ArrowLeftRight } from 'lucide-react'
import { Card } from '../../components/shadcn/card'
import { Separator } from '../../components/shadcn/separator'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Table } from '../../components/ui/Table'
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  formatVND,
} from '../../lib/formatters'
import { kindLabel, methodLabel, statusLabel } from '../../lib/labels'
import { DebtPanel } from '../document_history/DebtPanel'
import type {
  DocumentDetail,
  DocumentReference,
} from '../document_history/documentContracts'
import { DocumentLifecycle } from '../document_history/DocumentLifecycle'
import {
  Fact,
  FactGrid,
  InfoTip,
  SectionCard,
} from '../document_history/DocumentParts'
import { t } from '@/lib/i18n/core'

function ReferenceLink({
  label,
  reference,
  onOpen,
}: {
  label: string
  reference: DocumentReference
  onOpen?: (id: string) => void
}) {
  const text = t('{label} {code} ({status})', {
    label,
    code: reference.code,
    status: statusLabel(reference.status),
  })
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
      <ArrowLeftRight
        className="size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      {onOpen ? (
        <button
          type="button"
          className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => onOpen(reference.id)}
        >
          {text}
        </button>
      ) : (
        <span className="font-medium">{text}</span>
      )}
    </p>
  )
}

/**
 * Read-only document view: a header card (code, status, total, key facts and
 * replacement links) followed by the line items of goods documents. All
 * values are the server's exact strings.
 */
export function DocumentSnapshot({
  doc,
  onOpenDocument,
}: {
  doc: DocumentDetail
  /** Opens a linked (replaced/replacing) document. */
  onOpenDocument?: (id: string) => void
}) {
  const payment = doc.kind === 'PAYMENT_RECEIPT'
  const draftIssue = doc.kind === 'STOCK_ISSUE' && doc.status === 'DRAFT'
  const draftPayment = payment && doc.status === 'DRAFT'
  const change = draftIssue
    ? BigInt(doc.totalAmount)
    : draftPayment
      ? -BigInt(doc.totalAmount)
      : null
  return (
    <div className="space-y-4">
      <Card className="gap-4 p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {kindLabel(doc.kind)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg leading-tight font-semibold text-foreground">
                {doc.code}
              </span>
              <StatusBadge status={doc.status} />
            </div>
          </div>
          <div className="text-start sm:text-end">
            <p className="text-xs font-medium text-muted-foreground">
              {payment ? t('Số tiền') : t('Tổng tiền')}
            </p>
            <p className="text-xl font-semibold text-foreground tabular-nums">
              {formatVND(doc.totalAmount)}
            </p>
          </div>
        </div>
        <DocumentLifecycle status={doc.status} />
        {(doc.replaces || doc.replacedBy) && (
          <div className="space-y-1 rounded-lg border border-dashed px-3 py-2">
            {doc.replaces && (
              <ReferenceLink
                label={t('Thay thế cho')}
                reference={doc.replaces}
                onOpen={onOpenDocument}
              />
            )}
            {doc.replacedBy && (
              <ReferenceLink
                label={t('Đã được thay bằng')}
                reference={doc.replacedBy}
                onOpen={onOpenDocument}
              />
            )}
          </div>
        )}
        <Separator />
        <FactGrid>
          <Fact label={t('Ngày chứng từ')}>
            <span className="tabular-nums">{formatDate(doc.businessDate)}</span>
          </Fact>
          {doc.agencyId && (
            <Fact label={t('Đại lý')}>
              <span className="font-medium">
                {doc.agencyName ?? `#${doc.agencyId}`}
              </span>
              {doc.agencyCode && (
                <span className="block text-xs text-muted-foreground">
                  {doc.agencyCode}
                </span>
              )}
            </Fact>
          )}
          {payment && (
            <Fact label={t('Hình thức thu')}>
              {methodLabel(doc.receiptType)}
            </Fact>
          )}
          {doc.kind === 'STOCK_ISSUE' && doc.sellingPriceRate && (
            <Fact label={t('Tỷ lệ giá bán')}>
              <span className="inline-flex items-center gap-1 tabular-nums">
                × {formatQuantity(doc.sellingPriceRate)}
                <InfoTip label={t('Về đơn giá xuất')}>
                  {t(
                    'Đơn giá xuất = giá nhập gần nhất × tỷ lệ này, chốt khi ghi sổ.',
                  )}
                </InfoTip>
              </span>
            </Fact>
          )}
          <Fact label={t('Người lập')}>
            {doc.createdByName ?? '—'}
            <span className="block text-xs text-muted-foreground tabular-nums">
              {formatDateTime(doc.createdAt)}
            </span>
          </Fact>
          {doc.postedAt && (
            <Fact label={t('Ghi sổ')}>
              {doc.postedByName ?? '—'}
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatDateTime(doc.postedAt)}
              </span>
            </Fact>
          )}
          {doc.cancelledAt && (
            <Fact label={t('Hủy')}>
              {doc.cancelledByName ?? '—'}
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatDateTime(doc.cancelledAt)}
              </span>
            </Fact>
          )}
          {doc.cancelReason && (
            <Fact label={t('Lý do hủy/sửa')} full>
              {doc.cancelReason}
            </Fact>
          )}
          {doc.note && (
            <Fact label={t('Ghi chú')} full>
              {doc.note}
            </Fact>
          )}
        </FactGrid>
        {doc.agencyDebt !== null && doc.agencyMaxDebt !== null && (
          <DebtPanel
            debt={doc.agencyDebt}
            maxDebt={doc.agencyMaxDebt}
            change={change}
            afterLabel={draftPayment ? t('Nợ sau khi thu') : t('Nợ sau phiếu')}
          />
        )}
      </Card>
      {!payment && (
        <SectionCard
          title={
            <>
              {t('Dòng hàng')}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {doc.lines.length}
              </span>
            </>
          }
          contentClassName="px-0"
        >
          <div className="overflow-x-auto border-t">
            <Table
              caption={t('Dòng hàng của chứng từ')}
              className="min-w-[560px]"
            >
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>{t('Mặt hàng')}</th>
                  <th className="cell-number">{t('Số lượng')}</th>
                  <th>{t('Đơn vị')}</th>
                  <th className="cell-number">{t('Đơn giá')}</th>
                  <th className="cell-number">{t('Thành tiền')}</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="text-muted-foreground tabular-nums">
                      {index + 1}
                    </td>
                    <td className="font-medium text-foreground">
                      {line.productName}
                      {line.productCode && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {line.productCode}
                        </span>
                      )}
                    </td>
                    <td className="cell-number">
                      {formatQuantity(line.quantity)}
                    </td>
                    <td className="text-muted-foreground">{line.unitName}</td>
                    <td className="cell-number">{formatVND(line.unitPrice)}</td>
                    <td className="cell-number font-medium">
                      {formatVND(line.lineAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
