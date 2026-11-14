import { describe, expect, it } from 'vitest'
import {
  businessDate,
  catalog,
  dateRangeParams,
  decimal,
  id,
  message,
  money,
  nextDay,
  page,
  positiveMoney,
  quantity,
  queryPath,
  record,
  text,
  vietnamInstant,
} from '../features/payment_receipts/contracts'

describe('finance date helpers', () => {
  it('nextDay crosses month, year and leap-day boundaries', () => {
    expect(nextDay('2026-10-05')).toBe('2026-10-06')
    expect(nextDay('2026-10-31')).toBe('2026-11-01')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
    expect(nextDay('2028-02-28')).toBe('2028-02-29')
    expect(() => nextDay('2026-02-30')).toThrow()
  })

  it('dateRangeParams sends an exclusive upper bound and rejects inverted ranges', () => {
    expect(dateRangeParams('', '')).toEqual({
      params: { fromDate: '', toDate: '' },
      error: '',
    })
    expect(dateRangeParams('2026-10-01', '2026-10-01')).toEqual({
      params: { fromDate: '2026-10-01', toDate: '2026-10-02' },
      error: '',
    })
    expect(
      dateRangeParams(
        '2026-10-01',
        '2026-10-31',
        ['createdFrom', 'createdTo'],
        true,
      ),
    ).toEqual({
      params: {
        createdFrom: '2026-10-01T00:00:00+07:00',
        createdTo: '2026-11-01T00:00:00+07:00',
      },
      error: '',
    })
    const inverted = dateRangeParams('2026-10-05', '2026-10-04')
    expect(inverted.params).toEqual({})
    expect(inverted.error).toMatch(/Ngày bắt đầu/)
  })

  it('vietnamInstant adds the +07:00 offset and validates the wall time', () => {
    expect(vietnamInstant('2026-10-09T10:30')).toBe('2026-10-09T10:30:00+07:00')
    expect(vietnamInstant('2026-10-09T23:59:59')).toBe(
      '2026-10-09T23:59:59+07:00',
    )
    for (const bad of [
      '',
      '2026-10-09',
      '2026-10-09T24:00',
      '2026-13-01T10:00',
    ])
      expect(() => vietnamInstant(bad)).toThrow()
  })
})

describe('finance value validators', () => {
  it('record and text accept only objects and strings', () => {
    expect(record({ a: 1 })).toEqual({ a: 1 })
    expect(text('')).toBe('')
    for (const bad of [null, undefined, [], 'x', 1])
      expect(() => record(bad)).toThrow()
    expect(() => text(1)).toThrow()
  })

  it('decimal keeps signed exact strings', () => {
    expect(decimal('-12.50')).toBe('-12.50')
    expect(decimal('0')).toBe('0')
    for (const bad of ['01', '1.', '+1', '', 1])
      expect(() => decimal(bad)).toThrow()
  })

  it('positiveMoney admits 1..18-digit whole VND only', () => {
    expect(positiveMoney('1')).toBe('1')
    expect(positiveMoney('9'.repeat(18))).toBe('9'.repeat(18))
    for (const bad of ['0', '-1', '1.5', '01', '1'.repeat(19), ''])
      expect(() => positiveMoney(bad)).toThrow(
        /Số tiền phải là số nguyên dương/,
      )
  })

  it('money admits zero and rejects negatives/decimals', () => {
    expect(money('0')).toBe('0')
    expect(money('9'.repeat(18))).toBe('9'.repeat(18))
    for (const bad of ['-1', '1.0', '1'.repeat(19), 5])
      expect(() => money(bad)).toThrow()
  })

  it('id is a positive bigint up to int64 max', () => {
    expect(id('1')).toBe('1')
    expect(id('9223372036854775807')).toBe('9223372036854775807')
    for (const bad of ['0', '9223372036854775808', '01', 1, ''])
      expect(() => id(bad)).toThrow()
  })

  it('catalog accepts int32 ids as numbers or digit strings', () => {
    expect(catalog(1)).toBe(1)
    expect(catalog('2147483647')).toBe(2147483647)
    for (const bad of [0, 2147483648, 1.5, '0', 'x', null])
      expect(() => catalog(bad)).toThrow()
  })

  it('quantity keeps up to three decimals', () => {
    expect(quantity('0')).toBe('0')
    expect(quantity('12.125')).toBe('12.125')
    for (const bad of ['1.1234', '-1', '01', ''])
      expect(() => quantity(bad)).toThrow()
  })

  it('businessDate rejects impossible calendar dates', () => {
    expect(businessDate('2028-02-29')).toBe('2028-02-29')
    for (const bad of ['2026-02-29', '0000-01-01', '2026-1-01', 20260101])
      expect(() => businessDate(bad)).toThrow()
  })

  it('page validates pagination and decodes items', () => {
    const result = page(
      {
        items: ['1', '2'],
        pagination: { limit: 2, hasMore: true, nextCursor: 'c' },
      },
      id,
    )
    expect(result.items).toEqual(['1', '2'])
    expect(result.pagination.nextCursor).toBe('c')
    const empty = {
      items: [],
      pagination: { limit: 1, hasMore: false, nextCursor: null },
    }
    expect(page(empty, id).items).toEqual([])
    expect(() =>
      page(
        {
          items: [],
          pagination: { limit: 1, hasMore: true, nextCursor: null },
        },
        id,
      ),
    ).toThrow()
    expect(() => page({ items: {}, pagination: {} }, id)).toThrow()
    expect(() => page({ ...empty, items: ['x'] }, id)).toThrow()
  })

  it('queryPath drops empty filters and encodes values', () => {
    expect(queryPath('/x', { a: '1', b: '', c: 'á b' })).toBe(
      '/x?a=1&c=%C3%A1+b',
    )
    expect(queryPath('/x', {})).toBe('/x?')
  })

  it('message prefers the error text and falls back otherwise', () => {
    expect(message(new Error('boom'))).toBe('boom')
    expect(message('nope')).toBe('Yêu cầu thất bại.')
  })
})
