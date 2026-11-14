import type { ComponentType } from 'react'
import { useLocale } from '../lib/i18n/runtime'

/** Re-mounts the app when the language changes in memory (storage blocked). */
export function LocaleRoot({ App }: { App: ComponentType }) {
  const locale = useLocale()
  return <App key={locale} />
}
