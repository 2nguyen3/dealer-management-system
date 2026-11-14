import { describe, expect, it } from 'vitest'
import { ERROR_TEXTS } from '../lib/errors'
import type { Catalog } from '../lib/i18n/core'
import { extractMessages, placeholders } from '../lib/i18n/extract'
import { LOCALES } from '../lib/i18n/locales'

/** Application sources (tests excluded), read as text through Vite. */
const SOURCES = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>(
      ['/src/**/*.{ts,tsx}', '!/src/test/**', '!/src/**/*.test.{ts,tsx}'],
      { query: '?raw', import: 'default', eager: true },
    ),
  ),
)
const CATALOGS = Object.fromEntries(
  Object.entries(
    import.meta.glob<Catalog>('/src/lib/i18n/locales/*.json', {
      import: 'default',
      eager: true,
    }),
  ).map(([file, catalog]) => [file.replace(/^.*\/(.+)\.json$/, '$1'), catalog]),
)
const MESSAGES = extractMessages(SOURCES)

describe('message extraction', () => {
  it('finds the interface messages, including guide and error texts', () => {
    expect(MESSAGES.size).toBeGreaterThan(1500)
    expect(MESSAGES.has('Hướng dẫn')).toBe(true)
    for (const entry of Object.values(ERROR_TEXTS))
      expect(MESSAGES.has(entry.message), entry.message).toBe(true)
  })

  it('reads only literal t()/msg() arguments of files importing them', () => {
    const found = extractMessages({
      '/a.tsx': `import { t as tr, msg } from '@/lib/i18n/core'
        const A = msg('Một')
        export const B = () => <p>{tr('Hai {n}', { n: 1 })}{tr(A)}{other('Ba')}</p>`,
      '/b.ts': `const t = (s: string) => s; t('Không tính')`,
    })
    expect([...found.keys()].sort()).toEqual(['Hai {n}', 'Một'])
    expect(found.get('Một')).toEqual(['/a.tsx:2'])
  })

  it('lists placeholders once, sorted', () => {
    expect(placeholders('{b} và {a} rồi {b}')).toEqual(['a', 'b'])
    expect(placeholders('Không có')).toEqual([])
  })
})

describe('locale catalogues', () => {
  const expected = LOCALES.filter((locale) => locale.code !== 'vi').map(
    (locale) => locale.code,
  )

  it('ship one catalogue for each of the 23 non-source languages', () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([...expected].sort())
  })

  it.each(expected)(
    '%s translates every message, keeps placeholders and has no extra keys',
    (code) => {
      const catalog = CATALOGS[code] ?? {}
      const missing = [...MESSAGES.keys()].filter((id) => {
        const value = catalog[id]
        return typeof value !== 'string' || !value.trim()
      })
      expect(missing, `${code} missing`).toEqual([])
      const extra = Object.keys(catalog).filter((id) => !MESSAGES.has(id))
      expect(extra, `${code} extra`).toEqual([])
      const broken = Object.entries(catalog).filter(
        ([id, value]) =>
          typeof value !== 'string' ||
          placeholders(value).join() !== placeholders(id).join(),
      )
      expect(broken, `${code} placeholders`).toEqual([])
    },
  )
})
