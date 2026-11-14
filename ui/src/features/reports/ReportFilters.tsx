import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { FormEvent } from 'react'
import { DateField } from '../../components/blocks/DateField'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'
import { Button } from '../../components/ui/Button'
import { EntityPicker } from '../../components/ui/EntityPicker'
import { Select } from '../../components/ui/Select'
import { RECEIPT_TYPES, reports, type ReportQuery } from './contracts'
import { enumOptions, methodLabel } from '@/lib/labels'
import { filterLabels, sortLabel } from './display'
import {
  matchingPreset,
  periodPresets,
  presetPeriod,
  shiftDate,
  type PeriodPreset,
} from './periods'
import { t } from '@/lib/i18n/core'

const pickerResource = {
  agencyId: 'agencies',
  typeId: 'agency-types',
  productId: 'products',
  wardId: 'wards',
} as const
const limitOptions = ['10', '25', '50', '100']

export interface ReportFiltersProps {
  draft: ReportQuery
  /** Vietnam business month used by the period presets. */
  month: string
  onChange: (draft: ReportQuery) => void
  onApply: () => void
  onReset: () => void
  canReset: boolean
  applyDisabled: boolean
}

/** Slicer bar of one report: period, entity filters, sort and page size. */
export function ReportFilters({
  draft,
  month,
  onChange,
  onApply,
  onReset,
  canReset,
  applyDisabled,
}: ReportFiltersProps) {
  const kind = draft.kind
  const setFilter = (filter: string, value: string) =>
    onChange({ ...draft, filters: { ...draft.filters, [filter]: value } })
  const preset = matchingPreset(draft, month)
  function submit(event: FormEvent) {
    event.preventDefault()
    onApply()
  }
  return (
    <form
      className="space-y-3 rounded-xl border bg-card/95 p-4 shadow-xs"
      onSubmit={submit}
      aria-label={t('Bộ lọc báo cáo')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          {t('Bộ lọc')}
        </p>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={preset}
          onValueChange={(value) =>
            value &&
            onChange({
              ...draft,
              ...presetPeriod(value as PeriodPreset, month),
            })
          }
          aria-label={t('Kỳ báo cáo nhanh')}
          className="flex-wrap"
        >
          {periodPresets.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} className="px-3">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DateField
          id="report-from"
          label={t('Từ ngày')}
          required
          value={draft.fromDate}
          max={draft.toDate ? shiftDate(draft.toDate, -1) : undefined}
          onChange={(fromDate) => onChange({ ...draft, fromDate })}
        />
        <DateField
          id="report-to"
          label={t('Đến trước ngày')}
          required
          value={draft.toDate}
          min={draft.fromDate ? shiftDate(draft.fromDate, 1) : undefined}
          onChange={(toDate) => onChange({ ...draft, toDate })}
        />
        {reports[kind].filters.map((filter) =>
          filter === 'receiptType' ? (
            <Select
              key={`${kind}-${filter}`}
              id={`report-${filter}`}
              label={filterLabels[filter] ?? filter}
              value={draft.filters[filter] || ''}
              onChange={(e) => setFilter(filter, e.target.value)}
              options={enumOptions(RECEIPT_TYPES, methodLabel, t('Tất cả'))}
            />
          ) : (
            <EntityPicker
              key={`${kind}-${filter}`}
              id={`report-${filter}`}
              resource={pickerResource[filter as keyof typeof pickerResource]}
              label={filterLabels[filter] ?? filter}
              placeholder={
                filter === 'wardId' ? t('Tất cả phường/xã') : t('Tất cả')
              }
              value={draft.filters[filter] || ''}
              onChange={(value) => setFilter(filter, value)}
            />
          ),
        )}
        <Select
          id="report-sort"
          label={t('Sắp xếp')}
          value={draft.sort}
          onChange={(e) => onChange({ ...draft, sort: e.target.value })}
          options={reports[kind].sorts.map((sort) => ({
            value: sort,
            label: sortLabel(sort),
          }))}
        />
        <Select
          id="report-limit"
          label={t('Số dòng mỗi trang')}
          value={draft.limit}
          onChange={(e) => onChange({ ...draft, limit: e.target.value })}
          options={limitOptions.map((value) => ({
            value,
            label: t('{value} dòng', { value }),
          }))}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-dashed pt-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          icon={<RotateCcw className="size-4" />}
          disabled={!canReset}
          onClick={onReset}
        >
          {t('Xóa bộ lọc')}
        </Button>
        <Button type="submit" disabled={applyDisabled}>
          {t('Áp dụng')}
        </Button>
      </div>
    </form>
  )
}
