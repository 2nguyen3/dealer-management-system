import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { message, record } from '../payment_receipts/contracts'

export interface CatalogOption {
  value: string
  label: string
}

/** One readable option for a small catalogue row (`code — name`). */
export function catalogOption(value: unknown): CatalogOption | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'number' && typeof row.id !== 'string') return null
  const code = typeof row.code === 'string' ? row.code : ''
  const name = typeof row.name === 'string' ? row.name : ''
  const label =
    code && name ? `${code} — ${name}` : name || code || `#${row.id}`
  return { value: String(row.id), label }
}

/**
 * Loads a small catalogue (units, agency types) as select options. Pass `null`
 * to skip loading. Values stay the exact server identifiers.
 */
export function useCatalogOptions(path: string | null): {
  options: CatalogOption[]
  error: string
  loading: boolean
} {
  const [state, setState] = useState<{
    path: string
    options: CatalogOption[]
    error: string
  }>({ path: '', options: [], error: '' })
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    apiFetch<unknown>(`${path}?limit=100`, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return
        const items = record(response.data).items
        const options = (Array.isArray(items) ? items : [])
          .map(catalogOption)
          .filter((option): option is CatalogOption => option !== null)
        setState({ path, options, error: '' })
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setState({ path, options: [], error: message(failure) })
      })
    return () => controller.abort()
  }, [path])
  return state.path === path && path
    ? { options: state.options, error: state.error, loading: false }
    : { options: [], error: '', loading: !!path }
}
