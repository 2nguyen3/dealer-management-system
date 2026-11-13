import { createElement } from 'react'
import { filterOptionIcon } from './statusIcons'

/** Decorative status pictogram for a filter option (nothing for non-status values). */
export function FilterIcon({ value }: { value: string }) {
  const icon = filterOptionIcon(value)
  return icon ? createElement(icon, { 'aria-hidden': true }) : null
}
