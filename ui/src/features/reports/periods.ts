// Half-open `[fromDate, toDate)` report periods and quick slicer presets.
import { vietnamMonth, type ReportKind, type ReportQuery } from './contracts'
import { reports } from './contracts'
import { t } from '@/lib/i18n/core'

/** `YYYY-MM` shifted by `months` (may be negative). */
export function shiftMonth(month: string, months: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1
  const next = index + months
  const year = Math.floor(next / 12)
  return `${String(year).padStart(4, '0')}-${String((next % 12) + 1).padStart(2, '0')}`
}

/** Business date `YYYY-MM-DD` shifted by whole days (UTC calendar arithmetic). */
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(value.getTime())) return date
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export interface Period {
  fromDate: string
  toDate: string
}

export function monthPeriod(month: string): Period {
  return { fromDate: `${month}-01`, toDate: `${shiftMonth(month, 1)}-01` }
}

export type PeriodPreset =
  'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear'

export const periodPresets: { value: PeriodPreset; label: string }[] = [
  { value: 'thisMonth', label: t('Tháng này') },
  { value: 'lastMonth', label: t('Tháng trước') },
  { value: 'thisQuarter', label: t('Quý này') },
  { value: 'thisYear', label: t('Năm nay') },
]

/** Preset period relative to the Vietnam business month `month`. */
export function presetPeriod(preset: PeriodPreset, month: string): Period {
  const year = month.slice(0, 4)
  switch (preset) {
    case 'thisMonth':
      return monthPeriod(month)
    case 'lastMonth':
      return monthPeriod(shiftMonth(month, -1))
    case 'thisQuarter': {
      const start = shiftMonth(month, -((Number(month.slice(5, 7)) - 1) % 3))
      return { fromDate: `${start}-01`, toDate: `${shiftMonth(start, 3)}-01` }
    }
    case 'thisYear':
      return {
        fromDate: `${year}-01-01`,
        toDate: `${String(Number(year) + 1).padStart(4, '0')}-01-01`,
      }
  }
}

/** Preset whose period equals the given dates, or '' when custom. */
export function matchingPreset(
  period: Period,
  month: string,
): PeriodPreset | '' {
  return (
    periodPresets.find(({ value }) => {
      const candidate = presetPeriod(value, month)
      return (
        candidate.fromDate === period.fromDate &&
        candidate.toDate === period.toDate
      )
    })?.value ?? ''
  )
}

/** Unapplied default query of one report: current month, no filters. */
export function defaultQuery(
  kind: ReportKind,
  month: string = vietnamMonth(),
): ReportQuery {
  return {
    kind,
    ...monthPeriod(month),
    filters: {},
    sort: reports[kind].sorts[0]!,
    limit: '25',
  }
}
