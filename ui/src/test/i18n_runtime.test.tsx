import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguagePicker } from '../components/i18n/LanguagePicker'
import { inferAction } from '../components/ui/actionIcons'
import {
  currentIntl,
  formatDate,
  formatDateTime,
  formatQuantity,
  formatVND,
} from '../lib/formatters'
import { formatCompactVND, formatPercent, formatPlain } from '../lib/chart'
import * as core from '../lib/i18n/core'
import {
  activateLocale,
  getLocale,
  registerCatalog,
  resetI18nForTests,
  t,
} from '../lib/i18n/core'
import {
  activate,
  applyDocumentLocale,
  availableLocales,
  bootI18n,
  changeLocale,
  loadCatalog,
  LOCALE_KEY,
  storedLocale,
  useLocale,
} from '../lib/i18n/runtime'

const NBSP = String.fromCharCode(160)

beforeEach(() => {
  localStorage.clear()
  resetI18nForTests()
  applyDocumentLocale('vi')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  resetI18nForTests()
  applyDocumentLocale('vi')
})

describe('stored locale', () => {
  it('defaults to Vietnamese and never guesses from the browser', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-DE' })
    expect(storedLocale()).toBe('vi')
  })

  it('reads a supported saved locale and ignores unknown values', () => {
    localStorage.setItem(LOCALE_KEY, 'ja')
    expect(storedLocale()).toBe('ja')
    localStorage.setItem(LOCALE_KEY, 'klingon')
    expect(storedLocale()).toBe('vi')
  })

  it('falls back to Vietnamese when storage is unreadable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(storedLocale()).toBe('vi')
  })
})

describe('document language and direction', () => {
  it('sets lang and dir for left-to-right and right-to-left languages', () => {
    applyDocumentLocale('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    applyDocumentLocale('ja')
    expect(document.documentElement.dir).toBe('ltr')
  })
})

describe('activation', () => {
  it('offers Vietnamese plus every bundled catalogue', () => {
    const locales = availableLocales()
    expect(locales[0]).toBe('vi')
    expect(new Set(locales).size).toBe(locales.length)
  })

  it('loads English with the fallback and translates', async () => {
    expect(await activate('en')).toBe('en')
    expect(getLocale()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(t('Đóng')).not.toBe('Đóng')
  })

  it('stays Vietnamese for unknown codes or a failing catalogue', async () => {
    expect(await activate('xx')).toBe('vi')
    await expect(loadCatalog('xx')).rejects.toThrow('No catalogue for xx')
    vi.spyOn(core, 'activateLocale').mockImplementationOnce(() => {
      throw new Error('broken')
    })
    expect(await activate('en')).toBe('vi')
    expect(getLocale()).toBe('vi')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('boots with the saved language', async () => {
    localStorage.setItem(LOCALE_KEY, 'en')
    expect(await bootI18n()).toBe('en')
  })
})

describe('changeLocale', () => {
  it('saves the choice and reloads so start-up texts are rebuilt', async () => {
    const reload = vi.fn()
    expect(await changeLocale('ar', reload)).toBe('reload')
    expect(localStorage.getItem(LOCALE_KEY)).toBe('ar')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing for the current or an unsupported language', async () => {
    const reload = vi.fn()
    expect(await changeLocale('vi', reload)).toBe('unchanged')
    expect(await changeLocale('xx', reload)).toBe('unchanged')
    expect(reload).not.toHaveBeenCalled()
  })

  it('switches in memory when the choice cannot be saved', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const reload = vi.fn()
    const { result } = renderHook(() => useLocale())
    expect(result.current).toBe('vi')
    let outcome = ''
    await act(async () => {
      outcome = await changeLocale('en', reload)
    })
    expect(outcome).toBe('memory')
    expect(reload).not.toHaveBeenCalled()
    expect(result.current).toBe('en')
  })
})

describe('locale-aware formatting', () => {
  it('keeps the historical Vietnamese output exactly', () => {
    expect(formatVND('900719925474099301')).toBe('900.719.925.474.099.301 ₫')
    expect(formatVND('-1250000.50')).toBe('-1.250.000,50 ₫')
    expect(formatVND(null)).toBe('0 ₫')
    expect(formatQuantity('1.001')).toBe('1,001')
    expect(formatQuantity('')).toBe('0')
    expect(formatDate('2026-11-14')).toBe('14/11/2026')
    expect(formatDate('not a date')).toBe('not a date')
    expect(formatDate(null)).toBe('—')
    expect(formatCompactVND(1_200_000)).toMatch(/ ₫$/)
    expect(currentIntl()).toBe('vi-VN')
  })

  it('uses the interface language separators but always VND', () => {
    registerCatalog('en', {})
    registerCatalog('de', {})
    activateLocale('en')
    expect(formatVND('900719925474099301')).toBe('₫900,719,925,474,099,301')
    expect(formatQuantity('1234.500')).toBe('1,234.5')
    expect(formatDate('2026-11-14')).toBe('11/14/2026')
    expect(formatDateTime('bad')).toBe('bad')
    expect(formatDateTime('2026-11-14T03:05:00Z')).toMatch(/2026/)
    expect(formatPlain(1234)).toBe('1,234')
    expect(formatPercent(0.5)).toBe('50%')
    activateLocale('de')
    expect(formatVND('1250000')).toBe(`1.250.000${NBSP}₫`)
    expect(formatDate('2026-01-02')).toBe('02.01.2026')
    expect(formatCompactVND(1_200_000)).toMatch(new RegExp(`${NBSP}₫$`))
  })

  it('writes native digits where the language uses them', () => {
    registerCatalog('ar', {})
    activateLocale('ar')
    const digits = new Intl.NumberFormat('ar', { useGrouping: false })
      .format(1234567890)
      .split('')
    if (digits.join('') !== '1234567890') {
      expect(formatQuantity('12')).toBe(`${digits[0]}${digits[1]}`)
      expect(formatVND('0')).not.toContain('0')
    }
  })
})

describe('translated labels keep their icons', () => {
  it('maps a translated button label back to the Vietnamese verb', () => {
    registerCatalog('en', { 'Lưu nháp': 'Save draft', 'Ghi sổ': 'Post' })
    activateLocale('en')
    expect(inferAction(t('Lưu nháp'))).toBe('save')
    expect(inferAction(t('Ghi sổ'))).toBe('post')
    expect(inferAction('Unknown label')).toBeNull()
  })
})

describe('module-level texts', () => {
  it('menus built at import time use the language active when the app loads', async () => {
    vi.resetModules()
    const freshCore = await import('../lib/i18n/core')
    freshCore.registerCatalog('en', {
      'Hồ sơ đại lý': 'Agency profiles',
      'Giao dịch kho': 'Stock transactions',
    })
    freshCore.activateLocale('en')
    const navigation = await import('../app/navigation')
    const stock = navigation.navigationGroups.find(
      (group) => group.key === 'stock',
    )
    expect(stock?.title).toBe('Stock transactions')
    expect(navigation.routeLabel('/agencies')).toBe('Agency profiles')
    // Untranslated labels fall back to Vietnamese.
    expect(navigation.routeLabel('/units')).toBe('Đơn vị tính')
  })
})

describe('LanguagePicker', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    Element.prototype.scrollIntoView ??= () => {}
  })

  it('lists native and English names, marks the current one and applies a choice', () => {
    const onChange = vi.fn()
    render(<LanguagePicker onChange={onChange} />)
    const trigger = screen.getByTestId('language-picker')
    expect(trigger.getAttribute('aria-label')).toBe(
      'Ngôn ngữ giao diện: Tiếng Việt',
    )
    fireEvent.click(trigger)
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(availableLocales().length)
    expect(options[0]?.textContent).toContain('Tiếng Việt')
    // Choosing the current language does nothing.
    fireEvent.click(options[0]!)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(trigger)
    const english = screen
      .getAllByRole('option')
      .find((option) => option.textContent?.includes('English'))
    if (english) {
      fireEvent.click(english)
      expect(onChange).toHaveBeenCalledWith('en')
    }
  })

  it('filters by search text and says when nothing matches', () => {
    render(<LanguagePicker onChange={vi.fn()} compact />)
    fireEvent.click(screen.getByTestId('language-picker'))
    fireEvent.change(screen.getByPlaceholderText('Tìm ngôn ngữ…'), {
      target: { value: 'zzzz-no-language' },
    })
    expect(screen.getByText('Không tìm thấy ngôn ngữ.')).toBeDefined()
  })

  it('shows right-to-left options in their own direction', () => {
    render(<LanguagePicker onChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('language-picker'))
    const arabic = screen
      .getAllByRole('option')
      .find((option) => option.getAttribute('lang') === 'ar')
    if (arabic) expect(arabic.getAttribute('dir')).toBe('rtl')
  })
})
