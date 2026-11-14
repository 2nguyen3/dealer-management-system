/**
 * Message catalogue core. Vietnamese is the source language: the message ID
 * of every interface string is its Vietnamese text, so `vi` needs no catalogue
 * and an untranslated string always falls back to readable Vietnamese.
 *
 * Only interface text goes through `t()`. Business data (goods, agencies,
 * wards, notes, document codes) is rendered as received and never translated.
 */

/** Plural forms keyed by `Intl.PluralRules` category; `other` is required. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string
}
export type CatalogEntry = string | PluralForms
export type Catalog = Readonly<Record<string, CatalogEntry>>
export type MessageParams = Readonly<
  Record<string, string | number | null | undefined>
>

export const SOURCE_LOCALE = 'vi'
export const FALLBACK_LOCALE = 'en'

let current = SOURCE_LOCALE
const catalogs = new Map<string, Catalog>()
const listeners = new Set<() => void>()
/** Rendered translation → rendered Vietnamese, so label-based helpers keep working. */
const sources = new Map<string, string>()
const SOURCE_CACHE_LIMIT = 4000

/**
 * Marks a constant as a message ID without translating it (used where the
 * text is defined at module load, before a locale is known). Render it with
 * `t(value)`.
 */
export function msg<T extends string>(source: T): T {
  return source
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name]
    return value === undefined || value === null ? whole : String(value)
  })
}

function pick(entry: CatalogEntry, locale: string, count: unknown): string {
  if (typeof entry === 'string') return entry
  if (typeof count === 'number' && Number.isFinite(count)) {
    try {
      const category = new Intl.PluralRules(locale).select(count)
      return entry[category] ?? entry.other
    } catch {
      return entry.other
    }
  }
  return entry.other
}

function lookup(
  source: string,
): { entry: CatalogEntry; locale: string } | null {
  if (current === SOURCE_LOCALE) return null
  for (const locale of [current, FALLBACK_LOCALE]) {
    const entry = catalogs.get(locale)?.[source]
    if (entry !== undefined && entry !== '') return { entry, locale }
  }
  return null
}

/**
 * Translates a Vietnamese source message into the current locale, falling
 * back to English and then to the Vietnamese source. `{name}` placeholders are
 * filled from `params`; a numeric `count` selects plural forms.
 */
export function t(source: string, params?: MessageParams): string {
  const vi = interpolate(source, params)
  const found = lookup(source)
  if (!found) return vi
  const text = interpolate(
    pick(found.entry, found.locale, params?.count),
    params,
  )
  if (text !== vi) {
    if (sources.size >= SOURCE_CACHE_LIMIT) sources.clear()
    sources.set(text, vi)
  }
  return text
}

/**
 * Vietnamese text behind a string produced by `t()` in the current session,
 * or the string itself. Lets icon inference keep matching Vietnamese verbs.
 */
export function sourceOf(text: string): string {
  return sources.get(text) ?? text
}

export function getLocale(): string {
  return current
}

export function hasCatalog(locale: string): boolean {
  return locale === SOURCE_LOCALE || catalogs.has(locale)
}

/** Registers (or replaces) a locale catalogue. */
export function registerCatalog(locale: string, catalog: Catalog): void {
  catalogs.set(locale, catalog)
}

/** Switches the active locale; the catalogue must already be registered. */
export function activateLocale(locale: string): void {
  if (!hasCatalog(locale)) throw new Error(`Missing catalogue: ${locale}`)
  if (locale === current) return
  current = locale
  for (const listener of [...listeners]) listener()
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test helper: back to Vietnamese with no catalogues. */
export function resetI18nForTests(): void {
  current = SOURCE_LOCALE
  catalogs.clear()
  sources.clear()
  for (const listener of [...listeners]) listener()
}
