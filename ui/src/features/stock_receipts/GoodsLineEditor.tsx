import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { formatQuantity, formatVND } from '../../lib/formatters'
import type {
  DocumentLine,
  GoodsKind,
  LineInput,
} from '../document_history/documentContracts'
import { quantitySign } from '../document_history/lineMath'
import { canEstimate, emptyLine, estimateLine } from './lineEstimates'
import { t } from '@/lib/i18n/core'

// Static class strings so Tailwind can see every column template.
const GRID: Record<GoodsKind, { base: string; priced?: string }> = {
  STOCK_RECEIPT: {
    base: 'md:grid-cols-[2rem_minmax(0,1fr)_8.5rem_10rem_9.5rem_2.25rem]',
  },
  STOCK_ISSUE: { base: 'md:grid-cols-[2rem_minmax(0,1fr)_10rem_2.25rem]' },
  STOCK_ADJUSTMENT: {
    base: 'md:grid-cols-[2rem_minmax(0,1fr)_10rem_5.5rem_2.25rem]',
  },
  SALES_RETURN: {
    base: 'md:grid-cols-[2rem_minmax(0,1fr)_9rem_2.25rem]',
    priced: 'md:grid-cols-[2rem_minmax(0,1fr)_9rem_9.5rem_2.25rem]',
  },
}

/**
 * Line editor shared by create, pending replacement and corrections, laid out
 * as an editable table on desktop and stacked cards on phones. Product lines
 * use a searchable picker; return lines choose from the original issue's lines
 * when they are loaded (`originLines`), otherwise fall back to a code box. The
 * submitted values stay the exact server id strings.
 */
export function GoodsLineEditor({
  kind,
  lines,
  onChange,
  disabled = false,
  originLines,
}: {
  kind: GoodsKind
  lines: LineInput[]
  onChange: (lines: LineInput[]) => void
  disabled?: boolean
  /** Original issue lines for a sales return; null while none is chosen. */
  originLines?: DocumentLine[] | null
}) {
  const isReturn = kind === 'SALES_RETURN'
  const isAdjustment = kind === 'STOCK_ADJUSTMENT'
  const priced = canEstimate(kind, originLines)
  const quantityLabel = t('Số lượng{value}', {
    value: isAdjustment ? ' (+/-)' : '',
  })
  // Adjustments may write off discontinued goods; new receipts/issues need active goods.
  const productParams = isAdjustment ? undefined : { status: 'ACTIVE' }
  const grid = (priced && GRID[kind].priced) || GRID[kind].base
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
        {isAdjustment && (
          <span className="text-xs text-muted-foreground">
            {t('+ tăng · − giảm')}
          </span>
        )}
      </legend>
      <div className="clear-both space-y-3 p-3 md:space-y-0 md:p-0">
        {isReturn && originLines === null && (
          <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] text-muted-foreground md:m-3">
            {t('Chọn phiếu xuất gốc trước.')}
          </p>
        )}
        <div
          className={cn(
            'hidden gap-3 border-b bg-muted/60 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid',
            grid,
          )}
          aria-hidden="true"
        >
          <span>#</span>
          <span>{isReturn ? t('Dòng bán gốc') : t('Mặt hàng')}</span>
          <span className="text-end">{quantityLabel}</span>
          {kind === 'STOCK_RECEIPT' && (
            <span className="text-end">{t('Đơn giá nhập')}</span>
          )}
          {isAdjustment && <span>{t('Hướng')}</span>}
          {priced && <span className="text-end">{t('Tạm tính')}</span>}
          <span />
        </div>
        {lines.map((line, index) => {
          const amount = priced ? estimateLine(kind, line, originLines) : null
          const sign = isAdjustment ? quantitySign(line.quantity) : null
          return (
            <div
              key={index}
              role="group"
              aria-label={t('Dòng {value}', { value: index + 1 })}
              className={cn(
                'grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3',
                'md:rounded-none md:border-0 md:border-b md:px-3 md:py-2 md:last:border-b-0 md:[&_label]:sr-only',
                grid,
              )}
            >
              <span className="text-xs font-semibold text-muted-foreground tabular-nums md:text-sm md:font-normal">
                <span className="md:hidden">{t('Dòng')} </span>
                {index + 1}
              </span>
              <div className="col-span-2 min-w-0 md:col-span-1">
                {!isReturn ? (
                  <EntityPicker
                    id={`line-${index}-product`}
                    resource="products"
                    label={t('Mặt hàng')}
                    required
                    disabled={disabled}
                    params={productParams}
                    value={line.productId}
                    onChange={(productId) => update(index, { productId })}
                  />
                ) : originLines !== undefined ? (
                  <Select
                    id={`line-${index}-origin`}
                    label={t('Dòng bán gốc')}
                    aria-label={t('Dòng bán gốc {value}', { value: index + 1 })}
                    required
                    disabled={!originLines?.length}
                    value={line.originLineId}
                    onChange={(event) =>
                      update(index, { originLineId: event.target.value })
                    }
                    options={[
                      { value: '', label: t('Chọn dòng hàng đã bán…') },
                      ...(originLines ?? []).map((item) => ({
                        value: item.id,
                        label: t(
                          '{productName} — đã bán {quantity} {unitName}',
                          {
                            productName: item.productName,
                            quantity: formatQuantity(item.quantity),
                            unitName: item.unitName,
                          },
                        ),
                      })),
                    ]}
                  />
                ) : (
                  <Input
                    id={`line-${index}-id`}
                    label={t('Mã dòng bán gốc')}
                    aria-label={t('Mã dòng bán gốc {value}', {
                      value: index + 1,
                    })}
                    required
                    value={line.originLineId}
                    onChange={(event) =>
                      update(index, { originLineId: event.target.value })
                    }
                  />
                )}
              </div>
              <div className="col-span-2 md:col-span-1">
                <Input
                  id={`line-${index}-quantity`}
                  label={quantityLabel}
                  aria-label={t('Số lượng {value}{value2}', {
                    value: index + 1,
                    value2: isAdjustment ? ' (+/-)' : '',
                  })}
                  required
                  inputMode="decimal"
                  className="text-end tabular-nums"
                  value={line.quantity}
                  onChange={(event) =>
                    update(index, { quantity: event.target.value })
                  }
                />
              </div>
              {kind === 'STOCK_RECEIPT' && (
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
              {isAdjustment && (
                <div className="col-span-2 md:col-span-1">
                  {sign === 1 ? (
                    <Badge variant="success">{t('Tăng')}</Badge>
                  ) : sign === -1 ? (
                    <Badge variant="danger">{t('Giảm')}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              )}
              {priced && (
                <p className="col-span-2 flex items-center justify-between gap-2 text-sm md:col-span-1 md:justify-end">
                  <span className="text-xs text-muted-foreground md:sr-only">
                    {t('Tạm tính')}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {amount === null ? '—' : formatVND(amount.toString())}
                  </span>
                </p>
              )}
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
