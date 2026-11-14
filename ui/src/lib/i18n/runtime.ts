import { useSyncExternalStore } from 'react'
import {
  activateLocale,
  type Catalog,
  FALLBACK_LOCALE,
  getLocale,
  hasCatalog,
  registerCatalog,
  SOURCE_LOCALE,
  subscribeLocale,
} from './core'
import { isSupportedLocale, localeDirection } from './locales'

/** localStorage key of the interface language (same as the pre-paint script). */
export const LOCALE_KEY = 'agentra-locale'

type Loader = () => Promise<Catalog>
/** One lazily loaded JSON chunk per locale; Vietnamese needs none. */
const LOADERS: Record<string, Loader> = Object.fromEntries(
  Object.entries(
    import.meta.glob<Catalog>('./locales/*.json', { import: 'default' }),
  ).map(([file, load]) => [file.replace(/^.*\/(.+)\.json$/, '$1'), load]),
)

/** Locales that have a catalogue (Vietnamese is the built-in source). */
export function availableLocales(): string[] {
  return [SOURCE_LOCALE, ...Object.keys(LOADERS)]
}

/** Saved interface language, Vietnamese when unset, unknown or unreadable. */
export function storedLocale(): string {
  try {
    const value = localStorage.getItem(LOCALE_KEY)
    return isSupportedLocale(value) ? value : SOURCE_LOCALE
  } catch {
    return SOURCE_LOCALE
  }
}

/** Sets `<html lang dir>` for the locale. */
export function applyDocumentLocale(code: string): void {
  const root = document.documentElement
  root.lang = code
  root.dir = localeDirection(code)
}

/** Loads (once) and registers the catalogue of a locale. */
export async function loadCatalog(code: string): Promise<void> {
  if (hasCatalog(code)) return
  const load = LOADERS[code]
  if (!load) throw new Error(`No catalogue for ${code}`)
  registerCatalog(code, await load())
}

/**
 * Activates a locale: loads its catalogue plus the English fallback, then
 * switches. On any failure the interface stays in Vietnamese.
 */
export async function activate(code: string): Promise<string> {
  if (!isSupportedLocale(code) || code === SOURCE_LOCALE) {
    activateLocale(SOURCE_LOCALE)
    applyDocumentLocale(SOURCE_LOCALE)
    return SOURCE_LOCALE
  }
  try {
    if (code !== FALLBACK_LOCALE) await loadCatalog(FALLBACK_LOCALE)
    await loadCatalog(code)
    activateLocale(code)
    applyDocumentLocale(code)
    return code
  } catch {
    activateLocale(SOURCE_LOCALE)
    applyDocumentLocale(SOURCE_LOCALE)
    return SOURCE_LOCALE
  }
}

/** Startup: activate the saved language before the application modules load. */
export function bootI18n(): Promise<string> {
  return activate(storedLocale())
}

/**
 * Switches the interface language. Texts built when modules load (menus,
 * labels) are re-created by reloading the page; if the choice cannot be saved
 * the language is switched for this tab only and the app re-renders.
 */
export async function changeLocale(
  code: string,
  reload: () => void = () => window.location.reload(),
): Promise<'reload' | 'memory' | 'unchanged'> {
  if (!isSupportedLocale(code)) return 'unchanged'
  let saved = false
  try {
    localStorage.setItem(LOCALE_KEY, code)
    saved = true
  } catch {
    // Storage blocked: switch in memory only.
  }
  if (code === getLocale()) return 'unchanged'
  if (saved) {
    reload()
    return 'reload'
  }
  await activate(code)
  return 'memory'
}

/** Current interface language; re-renders when it changes in memory. */
export function useLocale(): string {
  return useSyncExternalStore(subscribeLocale, getLocale, () => SOURCE_LOCALE)
}
