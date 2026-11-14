import { getLocale } from './i18n/core'
import { intlTag } from './i18n/locales'

/**
 * Exact display formatting of backend decimal strings. Money is always VND;
 * only the separators, digits and symbol position follow the interface
 * language. Values are never coerced through `Number`, so amounts beyond
 * 2^53 keep every digit. Vietnamese output is the historical fixed format.
 */

interface NumberStyle {
  group: string
  decimal: string
  /** Native digits 0–9, or `null` for Latin digits. */
  digits: readonly string[] | null
  /** Places "₫" before the number (e.g. en-US "₫1,250,000"). */
  currencyBefore: boolean
}

/** No-break space between an amount and ₫ outside Vietnamese. */
export const NBSP = String.fromCharCode(160)

const VI_STYLE: NumberStyle = {
  group: '.',
  decimal: ',',
  digits: null,
  currencyBefore: false,
}
const styles = new Map<string, NumberStyle>([['vi', VI_STYLE]])

/** Separators/digits of the current interface language (cached per locale). */
export function numberStyle(locale: string = getLocale()): NumberStyle {
  const cached = styles.get(locale)
  if (cached) return cached
  const tag = intlTag(locale)
  let style = VI_STYLE
  try {
    const parts = new Intl.NumberFormat(tag, {
      minimumFractionDigits: 1,
    }).formatToParts(1234567.5)
    const digitFormat = new Intl.NumberFormat(tag, { useGrouping: false })
    const digits = Array.from({ length: 10 }, (_, d) => digitFormat.format(d))
    const currency = new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: 'VND',
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1)
    const symbolAt = currency.findIndex((part) => part.type === 'currency')
    const numberAt = currency.findIndex((part) => part.type === 'integer')
    style = {
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
      digits: digits.join('') === '0123456789' ? null : digits,
      currencyBefore: symbolAt >= 0 && numberAt >= 0 && symbolAt < numberAt,
    }
  } catch {
    // Unknown to this runtime: keep the Vietnamese style.
  }
  styles.set(locale, style)
  return style
}

function localDigits(text: string, style: NumberStyle): string {
  const digits = style.digits
  return digits ? text.replace(/[0-9]/g, (d) => digits[Number(d)] ?? d) : text
}

/** Groups an unsigned integer string by thousands. */
function groupInteger(integer: string, separator: string): string {
  let out = ''
  let count = 0
  for (let i = integer.length - 1; i >= 0; i--) {
    out = integer[i] + out
    count++
    if (count % 3 === 0 && i > 0) out = separator + out
  }
  return out
}

function splitDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const str = String(value).trim()
  if (!str) return null
  const negative = str.startsWith('-')
  const clean = negative ? str.slice(1) : str
  const [integer = '0', fraction] = clean.split('.')
  return { negative, integer: integer || '0', fraction }
}

/**
 * Formats a raw decimal money string as Vietnamese Dong (vi: "1.500.000 ₫")
 * without coercing it through JavaScript Number.
 */
export function formatVND(value: string | number | null | undefined): string {
  const style = numberStyle()
  const parts = splitDecimal(value) ?? {
    negative: false,
    integer: '0',
    fraction: undefined,
  }
  let amount =
    (parts.negative ? '-' : '') + groupInteger(parts.integer, style.group)
  if (parts.fraction && parts.fraction !== '0' && parts.fraction !== '00')
    amount += style.decimal + parts.fraction
  amount = localDigits(amount, style)
  if (style === VI_STYLE) return `${amount} ₫`
  return style.currencyBefore ? `₫${amount}` : `${amount}${NBSP}₫`
}

/** Formats a quantity value into a readable string without losing precision. */
export function formatQuantity(
  value: string | number | null | undefined,
): string {
  const style = numberStyle()
  const parts = splitDecimal(value)
  if (!parts) return localDigits('0', style)
  let result =
    (parts.negative ? '-' : '') + groupInteger(parts.integer, style.group)
  const fraction = parts.fraction?.replace(/0+$/, '')
  if (fraction) result += style.decimal + fraction
  return localDigits(result, style)
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()
function dateFormat(withTime: boolean): Intl.DateTimeFormat {
  const key = `${getLocale()}:${withTime}`
  let format = dateFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(intlTag(getLocale()), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(withTime
        ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const }
        : { timeZone: 'UTC' }),
    })
    dateFormats.set(key, format)
  }
  return format
}

/**
 * Formats a business date (YYYY-MM-DD) for display: DD/MM/YYYY in Vietnamese,
 * the interface language's numeric date order otherwise. The business date
 * itself is never shifted by time zones.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return dateStr
  const [, year, month, day] = match
  if (getLocale() === 'vi') return `${day}/${month}/${year}`
  try {
    return dateFormat(false).format(
      new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
    )
  } catch {
    return `${day}/${month}/${year}`
  }
}

/** Formats an ISO datetime in local time (vi: DD/MM/YYYY HH:mm). */
export function formatDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  const date = new Date(isoStr)
  if (Number.isNaN(date.getTime())) return isoStr
  if (getLocale() !== 'vi') {
    try {
      return dateFormat(true).format(date)
    } catch {
      // Fall through to the fixed format.
    }
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

/** `Intl` tag of the current interface language (e.g. "vi-VN"). */
export function currentIntl(): string {
  return intlTag(getLocale())
}
