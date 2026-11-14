import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import { describeError, ERROR_TEXTS } from '../lib/errors'
import {
  activateLocale,
  getLocale,
  hasCatalog,
  msg,
  registerCatalog,
  resetI18nForTests,
  sourceOf,
  subscribeLocale,
  t,
} from '../lib/i18n/core'
import {
  intlTag,
  isSupportedLocale,
  localeDirection,
  localeInfo,
  LOCALES,
} from '../lib/i18n/locales'

afterEach(() => resetI18nForTests())

describe('i18n core', () => {
  it('returns the Vietnamese source with placeholders filled by default', () => {
    expect(getLocale()).toBe('vi')
    expect(msg('Đã lưu')).toBe('Đã lưu')
    expect(t('Đã nộp {code}.', { code: 'PX-1' })).toBe('Đã nộp PX-1.')
    // Missing/null params keep the placeholder visible instead of "undefined".
    expect(t('Chờ {role}', { role: null })).toBe('Chờ {role}')
    expect(t('Không tham số')).toBe('Không tham số')
  })

  it('translates through the active catalogue and falls back to English then Vietnamese', () => {
    registerCatalog('en', {
      'Đã lưu': 'Saved',
      'Chỉ tiếng Anh': 'English only',
    })
    registerCatalog('de', { 'Đã lưu': 'Gespeichert', Trống: '' })
    activateLocale('de')
    expect(t('Đã lưu')).toBe('Gespeichert')
    expect(t('Chỉ tiếng Anh')).toBe('English only')
    // An empty translation counts as missing.
    expect(t('Trống')).toBe('Trống')
    expect(t('Chưa dịch')).toBe('Chưa dịch')
  })

  it('selects plural forms with Intl.PluralRules and falls back to other', () => {
    registerCatalog('en', {
      '{count} dòng': { one: '{count} line', other: '{count} lines' },
    })
    activateLocale('en')
    expect(t('{count} dòng', { count: 1 })).toBe('1 line')
    expect(t('{count} dòng', { count: 3 })).toBe('3 lines')
    expect(t('{count} dòng', { count: Number.NaN })).toBe('NaN lines')
    expect(t('{count} dòng')).toBe('{count} lines')
  })

  it('maps rendered translations back to the Vietnamese source', () => {
    registerCatalog('en', { 'Lưu {code}': 'Save {code}' })
    activateLocale('en')
    const text = t('Lưu {code}', { code: 'PN-1' })
    expect(text).toBe('Save PN-1')
    expect(sourceOf(text)).toBe('Lưu PN-1')
    expect(sourceOf('unknown')).toBe('unknown')
  })

  it('refuses a locale without a catalogue and notifies subscribers only on change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeLocale(listener)
    expect(() => activateLocale('fr')).toThrow('Missing catalogue: fr')
    expect(hasCatalog('vi')).toBe(true)
    expect(hasCatalog('fr')).toBe(false)
    registerCatalog('fr', {})
    activateLocale('fr')
    activateLocale('fr')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    activateLocale('vi')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('locale registry', () => {
  it('lists 24 unique locales with Vietnamese first and English second', () => {
    expect(LOCALES).toHaveLength(24)
    expect(new Set(LOCALES.map((locale) => locale.code)).size).toBe(24)
    expect(LOCALES[0]?.code).toBe('vi')
    expect(LOCALES[1]?.code).toBe('en')
    for (const locale of LOCALES) {
      expect(locale.nativeName.trim()).not.toBe('')
      expect(() => new Intl.NumberFormat(locale.intl)).not.toThrow()
    }
  })

  it('marks exactly Arabic and Urdu as right-to-left', () => {
    expect(
      LOCALES.filter((locale) => locale.dir === 'rtl')
        .map((locale) => locale.code)
        .sort(),
    ).toEqual(['ar', 'ur'])
    expect(localeDirection('ar')).toBe('rtl')
    expect(localeDirection('en')).toBe('ltr')
    expect(localeDirection('xx')).toBe('ltr')
  })

  it('validates codes and resolves Intl tags with a Vietnamese default', () => {
    expect(isSupportedLocale('pt-BR')).toBe(true)
    expect(isSupportedLocale('pt')).toBe(false)
    expect(isSupportedLocale(42)).toBe(false)
    expect(localeInfo('ja')?.englishName).toBe('Japanese')
    expect(localeInfo('xx')).toBeNull()
    expect(intlTag('de')).toBe('de-DE')
    expect(intlTag('xx')).toBe('vi-VN')
  })
})

/** The 61 codes scanned from backend/app on 2026-11-14 (handoff §3.3). */
const HANDOFF_CODES =
  `ACCOUNT_LOCKED AGENCY_CONFLICT BALANCE_OVERFLOW COMMAND_OUTCOME_UNKNOWN
COUNT_LINKED_ADJUSTMENT CREDIT_RESERVED DEBT_LIMIT_BELOW_CURRENT_BALANCE DUPLICATE_PRODUCT
EMPTY_COUNT EMPTY_DOCUMENT FORBIDDEN IDEMPOTENCY_KEY_REUSED INACTIVE_MASTER INSUFFICIENT_CREDIT
INSUFFICIENT_STOCK INTERNAL_ERROR INVALID_CREDENTIALS INVALID_CURSOR INVALID_JSON
INVALID_PROVIDER_RESPONSE INVALID_QUANTITY INVALID_SIGNATURE INVALID_TOTAL LIMIT_CONFLICT
LINE_CONFLICT MASTER_CONFLICT NOT_ACCEPTABLE NOT_FOUND PAYMENT_CONFLICT PAYMENT_EXCEEDS_DEBT
PAYMENT_SOURCE_CONFLICT PRECONDITION_FAILED PRECONDITION_REQUIRED PRICE_SOURCE_REQUIRED
PROVIDER_REFERENCE_NOT_FOUND PROVIDER_UNAVAILABLE RATE_LIMIT_EXCEEDED REASON_REQUIRED
RECEIPT_CONFLICT RECOUNT_PRODUCTS REFUND_CONFLICT REFUND_SOURCE_CONFLICT RESOURCE_BUSY
RESOURCE_IN_USE RETURN_QUANTITY_CONFLICT RETURN_SOURCE_CONFLICT REVERSAL_CONFLICT
SELLING_PRICE_UNUSABLE STALE_STOCK_SNAPSHOT STATE_CONFLICT STOCK_CONFLICT STOCK_OVERFLOW
TOTAL_OVERFLOW UNSUPPORTED_MEDIA_TYPE UNSUPPORTED_PROVIDER UPFRONT_CONFLICT UPFRONT_REQUIRED
USED_UNIT_IMMUTABLE VALIDATION_FAILED VNPAY_AMOUNT_INVALID WARD_CAPACITY_EXCEEDED`.split(
    /\s+/,
  )

/** Codes found by the re-scan that were missing from the handoff list. */
const RESCAN_CODES = [
  'BAD_REQUEST',
  'CORRECTION_CONFLICT',
  'INVALID_FIELD',
  'INVALID_OR_EXPIRED_TOKEN',
  'MALFORMED_REQUEST',
  'REFERENCE_NOT_FOUND',
  'SERVICE_UNAVAILABLE',
  'DUPLICATE',
]

describe('error catalogue', () => {
  it('covers every backend code with a message and a hint', () => {
    expect(HANDOFF_CODES).toHaveLength(61)
    for (const code of [...HANDOFF_CODES, ...RESCAN_CODES]) {
      const text = describeError(code)
      expect(text, code).not.toBeNull()
      expect(text?.message.trim(), code).not.toBe('')
      expect(text?.hint?.trim(), code).toBeTruthy()
    }
  })

  it('keeps every action pointing at an application route', () => {
    for (const [code, entry] of Object.entries(ERROR_TEXTS)) {
      const action = (entry as { action?: { label: string; to: string } })
        .action
      if (!action) continue
      expect(action.to.startsWith('/'), code).toBe(true)
      expect(action.label.trim(), code).not.toBe('')
    }
    expect(describeError('UPFRONT_REQUIRED')?.action?.to).toBe(
      '/upfront-payments',
    )
  })

  it('returns null for unknown codes and translates known ones', () => {
    expect(describeError('NO_SUCH_CODE')).toBeNull()
    expect(describeError('')).toBeNull()
    const vi = describeError('FORBIDDEN')!
    registerCatalog('en', {
      [vi.message]: 'You do not have permission for this action.',
    })
    activateLocale('en')
    expect(describeError('FORBIDDEN')?.message).toBe(
      'You do not have permission for this action.',
    )
    // Untranslated hint falls back to the Vietnamese source.
    expect(describeError('FORBIDDEN')?.hint).toBe(vi.hint)
  })

  it('attaches hint and action to ApiError only for known codes', () => {
    const known = new ApiError(409, 'UPFRONT_REQUIRED', 'x')
    expect(known.hint).toBeTruthy()
    expect(known.action?.to).toBe('/upfront-payments')
    const unknown = new ApiError(409, 'SOMETHING_NEW', 'Server text')
    expect(unknown.message).toBe('Server text')
    expect(unknown.hint).toBeUndefined()
    expect(unknown.action).toBeUndefined()
  })
})
