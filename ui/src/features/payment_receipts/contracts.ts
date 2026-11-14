import { ApiError, apiFetch, type RequestOptions } from '../../lib/api'
import { t } from '@/lib/i18n/core'

export type Row = Record<string, unknown>
export interface Page<T> {
  items: T[]
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean }
  metadata: Row
}

export function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid server response')
  }
  return value as Row
}

export function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid server text')
  return value
}

export function decimal(value: unknown): string {
  const result = text(value)
  if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(result)) {
    throw new Error('Invalid server numeric string')
  }
  return result
}

export function positiveMoney(value: string): string {
  if (!/^[1-9][0-9]{0,17}$/.test(value)) {
    throw new Error(t('Số tiền phải là số nguyên dương, tối đa 18 chữ số.'))
  }
  return value
}

export function id(value: unknown): string {
  const result = text(value)
  if (
    !/^[1-9][0-9]{0,18}$/.test(result) ||
    BigInt(result) > 9223372036854775807n
  ) {
    throw new Error('Invalid identifier')
  }
  return result
}

export function catalog(value: unknown): number {
  const number =
    typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
      ? Number(value)
      : value
  if (
    typeof number !== 'number' ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > 2147483647
  )
    throw new Error('Invalid catalogue ID')
  return number
}

export function money(value: unknown): string {
  const result = text(value)
  if (!/^(0|[1-9][0-9]{0,17})$/.test(result))
    throw new Error('Invalid whole VND amount')
  return result
}

export function quantity(value: unknown): string {
  const result = text(value)
  if (!/^(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$/.test(result))
    throw new Error('Invalid exact quantity')
  return result
}

export function businessDate(value: unknown): string {
  const result = text(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    result.startsWith('0000') ||
    Number.isNaN(Date.parse(`${result}T00:00:00Z`)) ||
    new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result
  ) {
    throw new Error('Invalid business date')
  }
  return result
}

export function vietnamDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function page<T>(
  value: unknown,
  decode: (value: unknown) => T,
): Page<T> {
  const data = record(value)
  const pagination = record(data.pagination)
  if (
    !Array.isArray(data.items) ||
    typeof pagination.hasMore !== 'boolean' ||
    typeof pagination.limit !== 'number' ||
    !(
      pagination.nextCursor === null ||
      typeof pagination.nextCursor === 'string'
    ) ||
    (pagination.hasMore && !pagination.nextCursor)
  ) {
    throw new Error('Invalid server pagination')
  }
  return {
    items: data.items.map(decode),
    pagination: pagination as unknown as Page<T>['pagination'],
    metadata: data,
  }
}

export function queryPath(
  path: string,
  filters: Record<string, string>,
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters))
    if (value !== '') query.set(key, value)
  return `${path}?${query}`
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : t('Yêu cầu thất bại.')
}

// Retain a key until a confirmed response. An uncertain retry must use identical bytes.
export class Intent {
  private pending = new Map<string, { fingerprint: string; key: string }>()
  private busy = false

  async send<T>(
    path: string,
    options: RequestOptions & { retainAccepted?: boolean } = {},
    keyed = true,
  ) {
    const { retainAccepted = false, ...requestOptions } = options
    if (this.busy) throw new Error(t('Một yêu cầu đang được xử lý.'))
    const fingerprint = JSON.stringify([
      requestOptions.method,
      requestOptions.body,
      requestOptions.ifMatch,
    ])
    const previous = this.pending.get(path)
    if (previous && !keyed)
      throw new Error(
        t(
          'Kết quả chưa rõ. Tải lại và kiểm tra trước khi gửi lại thao tác không có idempotency.',
        ),
      )
    if (previous && previous.fingerprint !== fingerprint) {
      throw new Error(
        t(
          'Kết quả trước chưa rõ. Giữ nguyên nội dung để thử lại hoặc tải lại và đối soát trước khi đổi yêu cầu.',
        ),
      )
    }
    const intent = previous ?? { fingerprint, key: crypto.randomUUID() }
    this.pending.set(path, intent)
    this.busy = true
    try {
      const result = await apiFetch<T>(path, {
        ...requestOptions,
        ...(keyed ? { idempotencyKey: intent.key } : {}),
      })
      if (!(retainAccepted && result.status === 202)) this.pending.delete(path)
      return result
    } catch (error) {
      // Unknown command outcomes may have committed, even when transported as 409.
      const status = recordErrorStatus(error)
      if (
        status >= 400 &&
        status < 500 &&
        status !== 408 &&
        !(error instanceof ApiError && error.code === 'COMMAND_OUTCOME_UNKNOWN')
      )
        this.pending.delete(path)
      throw error
    } finally {
      this.busy = false
    }
  }
}

function recordErrorStatus(error: unknown): number {
  return error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
    ? error.status
    : 0
}

/** The calendar day after a `YYYY-MM-DD` business date (exclusive upper bound). */
export function nextDay(value: string): string {
  const date = new Date(`${businessDate(value)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Inclusive date-range filter → API params. The upper bound is sent as the
 * exclusive next day; an inverted range is reported and not sent.
 */
export function dateRangeParams(
  from: string,
  to: string,
  keys: [string, string] = ['fromDate', 'toDate'],
  instant = false,
): { params: Record<string, string>; error: string } {
  if (from && to && from > to)
    return {
      params: {},
      error: t('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'),
    }
  const bound = (date: string) => (instant ? `${date}T00:00:00+07:00` : date)
  return {
    params: {
      [keys[0]]: from ? bound(from) : '',
      [keys[1]]: to ? bound(nextDay(to)) : '',
    },
    error: '',
  }
}

/**
 * A `datetime-local` value (`YYYY-MM-DDTHH:mm[:ss]`, Vietnam wall time) as an
 * ISO instant with the +07:00 offset. Throws for incomplete values.
 */
export function vietnamInstant(local: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!match) throw new Error(t('Vui lòng nhập đầy đủ ngày và giờ.'))
  const [, day, hour, minute, second = '00'] = match
  businessDate(day)
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59)
    throw new Error(t('Vui lòng nhập đầy đủ ngày và giờ.'))
  return `${day}T${hour}:${minute}:${second}+07:00`
}
