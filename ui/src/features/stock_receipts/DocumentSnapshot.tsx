import { Card } from '../../components/shadcn/card'
import { Separator } from '../../components/shadcn/separator'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Table } from '../../components/ui/Table'
import { formatDate, formatQuantity, formatVND } from '../../lib/formatters'
import { kindLabel, statusLabel } from '../../lib/labels'
import type { DocumentDetail } from '../document_history/documentContracts'
import { DocumentLifecycle } from '../document_history/DocumentLifecycle'
import {
  Fact,
  FactGrid,
  InfoTip,
  SectionCard,
} from '../document_history/DocumentParts'
import { t } from '@/lib/i18n/core'

const money = (value: string | null | undefined) =>
  value === null || value === undefined ? '—' : formatVND(value)

/**
 * Read-only document view: a header card (code, status, total and key facts)
 * followed by the line items. All values are the server's exact strings.
 */
export function DocumentSnapshot({ doc }: { doc: DocumentDetail }) {
  const revision = doc.currentRevision
  const agency = revision.agencySnapshot
  const isReturn = doc.kind === 'SALES_RETURN'
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
              {t('Tổng tiền')}
            </p>
            <p className="text-xl font-semibold text-foreground tabular-nums">
              {formatVND(revision.totalAmount)}
            </p>
          </div>
        </div>
        <DocumentLifecycle kind={doc.kind} status={doc.status} />
        <Separator />
        <FactGrid>
          <Fact label={t('Phiên bản')}>
            v{revision.revisionNo} · {statusLabel(revision.state)}
          </Fact>
          <Fact label={t('Ngày chứng từ')}>
            <span className="tabular-nums">
              {formatDate(revision.businessDate)}
            </span>
          </Fact>
          {doc.kind === 'STOCK_ISSUE' && (
            <>
              <Fact label={t('Trả ngay')}>
                <span className="tabular-nums">
                  {formatVND(revision.immediatePayment)}
                </span>
              </Fact>
              <Fact label={t('Còn nợ lúc xuất')}>
                <span className="tabular-nums">
                  {money(doc.remainingAtIssue)}
                </span>
              </Fact>
              <Fact label={t('Còn nợ hiện tại')}>
                <span className="tabular-nums">
                  {money(doc.invoiceBalance?.outstandingAmount)}
                </span>
              </Fact>
              <Fact label={t('Thanh toán trước')}>
                {doc.upfrontConfirmationId ? t('Đã xác nhận') : t('Không có')}
              </Fact>
              <Fact label={t('Phiếu thu kèm')}>
                {doc.autoReceiptId ? t('Đã lập') : t('Không có')}
              </Fact>
            </>
          )}
          {isReturn && (
            <>
              <Fact label={t('Phiếu xuất gốc')}>
                {doc.originDocumentId ? `#${doc.originDocumentId}` : '—'}
              </Fact>
              <Fact label={t('Giảm công nợ')}>
                <span className="tabular-nums">
                  {money(doc.debtReducedAmount)}
                </span>
              </Fact>
              <Fact label={t('Ghi có cho đại lý')}>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  {money(doc.creditCreatedAmount)}
                  <InfoTip label={t('Về khoản ghi có')}>
                    {t(
                      'Phần tiền vượt công nợ được ghi có cho đại lý, không tự động hoàn tiền.',
                    )}
                  </InfoTip>
                </span>
              </Fact>
            </>
          )}
          {doc.kind === 'STOCK_ADJUSTMENT' && (
            <Fact label={t('Nguồn')}>
              {doc.stockCountId
                ? t('Từ biên bản kiểm kê #{stockCountId}', {
                    stockCountId: doc.stockCountId,
                  })
                : t('Điều chỉnh độc lập')}
            </Fact>
          )}
          {agency && (
            <Fact label={t('Đại lý')} full>
              <span className="font-medium">{agency.name}</span>
              {(agency.address || agency.phone) && (
                <span className="block text-xs text-muted-foreground">
                  {[agency.address, agency.phone].filter(Boolean).join(' · ')}
                </span>
              )}
            </Fact>
          )}
          {revision.reason && (
            <Fact label={t('Lý do')} full>
              {revision.reason}
            </Fact>
          )}
          {revision.note && (
            <Fact label={t('Ghi chú')} full>
              {revision.note}
            </Fact>
          )}
        </FactGrid>
      </Card>
      <SectionCard
        title={
          <>
            {t('Dòng hàng')}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {revision.lines.length}
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
                {isReturn && <th>{t('Dòng gốc')}</th>}
              </tr>
            </thead>
            <tbody>
              {revision.lines.map((line, index) => (
                <tr key={line.id}>
                  <td className="text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                  <td className="font-medium text-foreground">
                    {line.productName}
                  </td>
                  <td className="cell-number">
                    {formatQuantity(line.quantity)}
                  </td>
                  <td className="text-muted-foreground">{line.unitName}</td>
                  <td className="cell-number">{formatVND(line.unitPrice)}</td>
                  <td className="cell-number font-medium">
                    {formatVND(line.lineAmount)}
                  </td>
                  {isReturn && (
                    <td className="text-muted-foreground">
                      {line.originLineId ? `#${line.originLineId}` : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </SectionCard>
    </div>
  )
}
