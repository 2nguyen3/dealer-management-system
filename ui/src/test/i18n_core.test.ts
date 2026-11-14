import { afterEach, describe, expect, it, vi } from 'vitest'
import { navigationGroups } from '../app/navigation'
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
/**
 * Every code the simplified backend can return: each `ApiError(<status>,
 * "<CODE>")`, conflict-map entry and auth error scanned from `backend/app`.
 */
const BACKEND_CODES =
  `ACCOUNT_LOCKED AGENCY_CONFLICT AGENCY_HAS_DEBT AGENCY_TERMINATED BAD_REQUEST
DEBT_LIMIT_BELOW_CURRENT_BALANCE DEBT_LIMIT_EXCEEDED DUPLICATE DUPLICATE_PRODUCT
EMPTY_DOCUMENT FORBIDDEN FRACTION_NOT_ALLOWED IDEMPOTENCY_KEY_REUSED INACTIVE_MASTER
INSUFFICIENT_STOCK INTERNAL_ERROR INVALID_CREDENTIALS INVALID_CURSOR INVALID_FIELD
INVALID_OR_EXPIRED_TOKEN INVALID_PROVIDER_RESPONSE INVALID_SIGNATURE LIMIT_CONFLICT
MALFORMED_REQUEST MASTER_CONFLICT NOT_ACCEPTABLE NOT_FOUND PAYMENT_CONFLICT
PAYMENT_EXCEEDS_DEBT PERIOD_CLOSED PRECONDITION_FAILED PRECONDITION_REQUIRED
PRODUCT_NOT_PRICED PROVIDER_UNAVAILABLE RATE_LIMIT_EXCEEDED REASON_REQUIRED
RESOURCE_BUSY RESOURCE_IN_USE SELLING_PRICE_UNUSABLE SERVICE_UNAVAILABLE
STATE_CONFLICT UNSUPPORTED_MEDIA_TYPE UNSUPPORTED_PROVIDER USED_UNIT_IMMUTABLE
VALIDATION_FAILED VNPAY_AMOUNT_INVALID WARD_CAPACITY_EXCEEDED`.split(/\s+/)

/** Codes of features removed by the simplification: no longer described. */
const REMOVED_CODES = [
  'UPFRONT_REQUIRED',
  'UPFRONT_CONFIRMATION_REQUIRED',
  'UPFRONT_CONFLICT',
  'VERIFIED_CASH_IMMUTABLE',
  'INSUFFICIENT_CREDIT',
  'CREDIT_RESERVED',
  'REFUND_CONFLICT',
  'PAID_REFUND_IMMUTABLE',
  'RETURN_QUANTITY_CONFLICT',
  'RETURN_SOURCE_CONFLICT',
  'COUNT_LINKED_ADJUSTMENT',
  'EMPTY_COUNT',
  'RECOUNT_PRODUCTS',
  'STALE_STOCK_SNAPSHOT',
  'COLLECTION_EXCEEDS_ALLOCATABLE_DEBT',
  'FIFO_REALLOCATION_INSUFFICIENT_DEBT',
  'RECEIPT_CONFLICT',
  'PRICE_SOURCE_REQUIRED',
  'CORRECTION_CONFLICT',
  'STOCK_CONFLICT',
  'COMMAND_OUTCOME_UNKNOWN',
]

describe('error catalogue', () => {
  it('covers every backend code with a message and a hint', () => {
    expect(BACKEND_CODES).toHaveLength(47)
    for (const code of BACKEND_CODES) {
      const text = describeError(code)
      expect(text, code).not.toBeNull()
      expect(text?.message.trim(), code).not.toBe('')
      expect(text?.hint?.trim(), code).toBeTruthy()
    }
  })

  it('drops the codes of removed features', () => {
    for (const code of REMOVED_CODES)
      expect(describeError(code), code).toBeNull()
  })

  it('keeps every action pointing at a menu route', () => {
    const routes = new Set(
      navigationGroups.flatMap((group) => group.items.map((item) => item.path)),
    )
    for (const [code, entry] of Object.entries(ERROR_TEXTS)) {
      const action = (entry as { action?: { label: string; to: string } })
        .action
      if (!action) continue
      expect(routes.has(action.to), `${code} ${action.to}`).toBe(true)
      expect(action.label.trim(), code).not.toBe('')
    }
    expect(describeError('AGENCY_HAS_DEBT')?.action?.to).toBe(
      '/payment-receipts',
    )
    expect(describeError('PRODUCT_NOT_PRICED')?.action?.to).toBe(
      '/stock-receipts',
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
    const known = new ApiError(409, 'DEBT_LIMIT_EXCEEDED', 'x')
    expect(known.hint).toBeTruthy()
    expect(known.action?.to).toBe('/payment-receipts')
    const removed = new ApiError(409, 'UPFRONT_REQUIRED', 'Server text')
    expect(removed.hint).toBeUndefined()
    expect(removed.action).toBeUndefined()
    const unknown = new ApiError(409, 'SOMETHING_NEW', 'Server text')
    expect(unknown.message).toBe('Server text')
    expect(unknown.hint).toBeUndefined()
    expect(unknown.action).toBeUndefined()
  })
})
