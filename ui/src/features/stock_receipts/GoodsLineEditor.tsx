import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../../components/ui/Button'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { formatQuantity, formatVND } from '../../lib/formatters'
import {
  emptyLine,
  type GoodsKind,
  type LineInput,
} from '../document_history/documentContracts'
import type { ProductQuote } from '../document_history/useRecords'
import { estimateLine, estimatePrice, issueLineWarning } from './lineEstimates'
import { t } from '@/lib/i18n/core'

// Static class strings so Tailwind can see every column template.
const GRID: Record<GoodsKind, string> = {
  STOCK_RECEIPT:
    'md:grid-cols-[2rem_minmax(0,1fr)_8.5rem_10rem_9.5rem_2.25rem]',
  STOCK_ISSUE: 'md:grid-cols-[2rem_minmax(0,1fr)_8.5rem_9rem_9.5rem_2.25rem]',
}

/**
 * Line editor of receipts and issues, laid out as an editable table on
 * desktop and stacked cards on phones. Receipts enter the purchase price;
 * issue prices are quoted by the server (shown as an estimate from the
 * product's current selling price). Values stay exact server strings.
 */
export function GoodsLineEditor({
  kind,
  lines,
  onChange,
  disabled = false,
  quotes = {},
}: {
  kind: GoodsKind
  lines: LineInput[]
  onChange: (lines: LineInput[]) => void
  disabled?: boolean
  quotes?: Record<string, ProductQuote>
}) {
  const issue = kind === 'STOCK_ISSUE'
  function update(index: number, patch: Partial<LineInput>) {
    onChange(
      lines.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    )
  }
  return (
    <fieldset
      className="min-w-0 rounded-xl border bg-card shadow-xs"
      disabled={disabled}
    >
      <legend className="float-left flex w-full items-center justify-between gap-3 border-b px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {t('Danh sách dòng hàng')}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {lines.length}
          </span>
        </span>
        {issue && (
          <span className="text-xs text-muted-foreground">
            {t('Đơn giá do hệ thống tính khi ghi sổ')}
          </span>
        )}
      </legend>
      <div className="clear-both space-y-3 p-3 md:space-y-0 md:p-0">
        <div
          className={cn(
            'hidden gap-3 border-b bg-muted/60 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid',
            GRID[kind],
          )}
          aria-hidden="true"
        >
          <span>#</span>
          <span>{t('Mặt hàng')}</span>
          <span className="text-end">{t('Số lượng')}</span>
          <span className="text-end">
            {issue ? t('Giá bán dự kiến') : t('Đơn giá nhập')}
          </span>
          <span className="text-end">{t('Tạm tính')}</span>
          <span />
        </div>
        {lines.map((line, index) => {
          const quote = quotes[line.productId]
          const amount = estimateLine(kind, line, quotes)
          const price = issue ? estimatePrice(kind, line, quotes) : null
          const warning = issue ? issueLineWarning(line, quote) : null
          return (
            <div
              key={index}
              role="group"
              aria-label={t('Dòng {value}', { value: index + 1 })}
              className={cn(
                'grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3',
                'md:rounded-none md:border-0 md:border-b md:px-3 md:py-2 md:last:border-b-0 md:[&_label]:sr-only',
                GRID[kind],
              )}
            >
              <span className="text-xs font-semibold text-muted-foreground tabular-nums md:text-sm md:font-normal">
                <span className="md:hidden">{t('Dòng')} </span>
                {index + 1}
              </span>
              <div className="col-span-2 min-w-0 md:col-span-1">
                <EntityPicker
                  id={`line-${index}-product`}
                  resource="products"
                  label={t('Mặt hàng')}
                  required
                  disabled={disabled}
                  params={{ status: 'ACTIVE' }}
                  value={line.productId}
                  onChange={(productId) => update(index, { productId })}
                />
                {quote && (
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {t('Tồn {stock} {unitName}', {
                      stock: formatQuantity(quote.stock),
                      unitName: quote.unitName,
                    })}
                  </p>
                )}
                {warning && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {warning}
                  </p>
                )}
              </div>
              <div className="col-span-2 md:col-span-1">
                <Input
                  id={`line-${index}-quantity`}
                  label={t('Số lượng')}
                  aria-label={t('Số lượng {value}', { value: index + 1 })}
                  required
                  inputMode="decimal"
                  className="text-end tabular-nums"
                  value={line.quantity}
                  onChange={(event) =>
                    update(index, { quantity: event.target.value })
                  }
                />
              </div>
              {issue ? (
                <p className="col-span-2 flex items-center justify-between gap-2 text-sm md:col-span-1 md:justify-end">
                  <span className="text-xs text-muted-foreground md:sr-only">
                    {t('Giá bán dự kiến')}
                  </span>
                  <span className="text-foreground tabular-nums">
                    {price === null ? '—' : formatVND(price)}
                  </span>
                </p>
              ) : (
                <div className="col-span-2 md:col-span-1">
                  <Input
                    id={`line-${index}-price`}
                    label={t('Đơn giá nhập (VNĐ)')}
                    aria-label={t('Đơn giá nhập {value} (VNĐ)', {
                      value: index + 1,
                    })}
                    required
                    inputMode="numeric"
                    className="text-end tabular-nums"
                    value={line.unitPrice}
                    onChange={(event) =>
                      update(index, { unitPrice: event.target.value })
                    }
                  />
                </div>
              )}
              <p className="col-span-2 flex items-center justify-between gap-2 text-sm md:col-span-1 md:justify-end">
                <span className="text-xs text-muted-foreground md:sr-only">
                  {t('Tạm tính')}
                </span>
                <span className="font-medium text-foreground tabular-nums">
                  {amount === null ? '—' : formatVND(amount.toString())}
                </span>
              </p>
              <div className="order-first col-start-2 row-start-1 flex justify-end md:order-none md:col-auto md:row-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={t('Xóa dòng {value}', { value: index + 1 })}
                  title={t('Xóa dòng {value}', { value: index + 1 })}
                  disabled={lines.length === 1}
                  onClick={() =>
                    onChange(lines.filter((_, position) => position !== index))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-dashed sm:w-auto"
          icon={<Plus className="size-4" />}
          onClick={() => onChange([...lines, emptyLine()])}
        >
          {t('Thêm dòng')}
        </Button>
      </div>
    </fieldset>
  )
}
