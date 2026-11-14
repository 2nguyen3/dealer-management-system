import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addFavorite,
  DEFAULT_LIMIT,
  defaultFavorites,
  favoritableItems,
  favoritesKey,
  isFavoritable,
  moveFavorite,
  parseFavorites,
  readFavorites,
  removeFavorite,
  reorderVisible,
  resolveDeck,
  writeFavorites,
} from '../features/portal/favorites'
import {
  isPortalTab,
  PORTAL_TAB_KEY_PREFIX,
  readPortalTab,
  writePortalTab,
} from '../features/portal/portalTab'
import type { FunctionCode } from '../lib/types'

const holding =
  (...codes: string[]) =>
  (code: FunctionCode) =>
    codes.includes(code)

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('favouritable functions', () => {
  it('lists menu functions except the Portal and unavailable entries', () => {
    const paths = favoritableItems().map((item) => item.path)
    expect(paths).toContain('/stock-issues')
    expect(paths).toContain('/dashboard')
    expect(paths).not.toContain('/')
    expect(paths).not.toContain('/chatbot')
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('rejects the Portal, the AI assistant, profile and unknown paths', () => {
    expect(isFavoritable('/receivables')).toBe(true)
    for (const path of ['/', '/chatbot', '/profile', '/nope', ''])
      expect(isFavoritable(path)).toBe(false)
  })
})

describe('role defaults', () => {
  it('derives an accounting deck from accounting permissions', () => {
    expect(
      defaultFavorites(
        holding(
          'cash.receipt.prepare',
          'cash.upfront.verify',
          'debt.read',
          'reports.read',
          'sales.read',
        ),
      ),
    ).toEqual([
      '/payment-receipts',
      '/upfront-payments',
      '/receivables',
      '/reports',
    ])
  })

  it('derives a warehouse deck and never adds a function the user may not open', () => {
    const deck = defaultFavorites(
      holding(
        'stock.receipt.prepare',
        'stock.issue.prepare',
        'inventory.read',
        'stock.count',
        'reports.read',
      ),
    )
    expect(deck.slice(0, 4)).toEqual([
      '/stock-receipts',
      '/stock-issues',
      '/stock-counts',
      '/inventory',
    ])
    expect(deck).toContain('/reports')
    // reports.read alone does not open /reports (it needs a read scope too).
    expect(defaultFavorites(holding('reports.read'))).not.toContain('/reports')
  })

  it('caps the deck and falls back to the first permitted functions', () => {
    const everything = () => true
    expect(defaultFavorites(everything)).toHaveLength(DEFAULT_LIMIT)
    // Only open-to-all pages remain: the fallback picks those.
    expect(defaultFavorites(() => false)).toEqual(['/document-history'])
  })
})

describe('stored deck', () => {
  it('parses a list of known paths, keeping order and dropping duplicates', () => {
    expect(
      parseFavorites('["/units","/chatbot","/units","/x",3,"/agencies"]'),
    ).toEqual(['/units', '/agencies'])
    expect(parseFavorites('[]')).toEqual([])
  })

  it('treats missing, malformed or non-array values as never saved', () => {
    expect(parseFavorites(null)).toBeNull()
    expect(parseFavorites('{oops')).toBeNull()
    expect(parseFavorites('{"a":1}')).toBeNull()
  })

  it('reads and writes per user', () => {
    expect(writeFavorites('u1', ['/units'])).toBe(true)
    expect(localStorage.getItem(favoritesKey('u1'))).toBe('["/units"]')
    expect(readFavorites('u1')).toEqual(['/units'])
    expect(readFavorites('u2')).toBeNull()
  })

  it('survives storage failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(readFavorites('u1')).toBeNull()
    expect(writeFavorites('u1', ['/units'])).toBe(false)
  })
})

describe('list operations', () => {
  it('adds once and only favouritable paths', () => {
    expect(addFavorite(['/units'], '/agencies')).toEqual([
      '/units',
      '/agencies',
    ])
    expect(addFavorite(['/units'], '/units')).toEqual(['/units'])
    expect(addFavorite(['/units'], '/chatbot')).toEqual(['/units'])
  })

  it('removes a path and ignores unknown ones', () => {
    expect(removeFavorite(['/a', '/b'], '/a')).toEqual(['/b'])
    expect(removeFavorite(['/a'], '/z')).toEqual(['/a'])
  })

  it('moves within bounds', () => {
    const list = ['/a', '/b', '/c']
    expect(moveFavorite(list, '/b', -1)).toEqual(['/b', '/a', '/c'])
    expect(moveFavorite(list, '/b', 1)).toEqual(['/a', '/c', '/b'])
    expect(moveFavorite(list, '/a', -5)).toEqual(list)
    expect(moveFavorite(list, '/c', 9)).toEqual(list)
    expect(moveFavorite(list, '/z', 1)).toEqual(list)
    expect(moveFavorite(list, '/a', Number.NaN)).toEqual(list)
  })

  it('reorders the visible entries and keeps hidden ones saved', () => {
    expect(reorderVisible(['/a', '/h', '/b'], ['/b', '/a'])).toEqual([
      '/b',
      '/a',
      '/h',
    ])
    expect(reorderVisible(['/a'], ['/zz', '/a'])).toEqual(['/a'])
  })

  it('hides entries the user lost permission to', () => {
    expect(
      resolveDeck(
        ['/units', '/users', '/document-history'],
        holding('unit.manage'),
      ),
    ).toEqual({ visible: ['/units', '/document-history'], hidden: 1 })
    expect(resolveDeck([], () => true)).toEqual({ visible: [], hidden: 0 })
  })
})

describe('remembered Portal tab', () => {
  it('stores the tab per user', () => {
    expect(writePortalTab('u1', 'functions')).toBe(true)
    expect(localStorage.getItem(PORTAL_TAB_KEY_PREFIX + 'u1')).toBe('functions')
    expect(readPortalTab('u1')).toBe('functions')
    expect(readPortalTab('u2')).toBeNull()
  })

  it('ignores unknown values, a missing user and storage errors', () => {
    localStorage.setItem(PORTAL_TAB_KEY_PREFIX + 'u1', 'settings')
    expect(readPortalTab('u1')).toBeNull()
    expect(readPortalTab('')).toBeNull()
    expect(writePortalTab('', 'favorites')).toBe(false)
    expect(isPortalTab('favorites')).toBe(true)
    expect(isPortalTab(1)).toBe(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readPortalTab('u1')).toBeNull()
    expect(writePortalTab('u1', 'favorites')).toBe(false)
  })
})
