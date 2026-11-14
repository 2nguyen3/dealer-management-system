import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { errorMessage } from './useDocumentRequests'
import { exact, object, validId } from './documentContracts'
import { t } from '@/lib/i18n/core'

/** Current balance of one agency (`GET /agencies/{id}`), read for display. */
export interface AgencyBalance {
  id: string
  code: string
  name: string
  status: string
  /** Current debt; negative after a late online payment (prepaid). */
  debt: string
  maxDebt: string
}

export function parseAgencyBalance(value: unknown): AgencyBalance {
  const row = object(value)
  if (
    !validId(row.id) ||
    typeof row.code !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.status !== 'string' ||
    typeof row.debt !== 'string' ||
    !exact.signedMoney.test(row.debt) ||
    typeof row.maxDebt !== 'string' ||
    !exact.money.test(row.maxDebt)
  )
    throw new Error(t('Thông tin công nợ đại lý không hợp lệ.'))
  return row as unknown as AgencyBalance
}

/** Pricing and stock of one product (`GET /products/{id}`) for estimates. */
export interface ProductQuote {
  id: string
  code: string
  name: string
  unitName: string
  stock: string
  lastPurchasePrice: string | null
  /** Server-derived selling price; null when never received (not priced). */
  sellingPrice: string | null
}

export function parseProductQuote(value: unknown): ProductQuote {
  const row = object(value)
  const price = (v: unknown) =>
    v === null || (typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v))
  if (
    !validId(row.id) ||
    typeof row.name !== 'string' ||
    typeof row.stock !== 'string' ||
    !exact.quantity.test(row.stock) ||
    !price(row.lastPurchasePrice ?? null) ||
    !price(row.sellingPrice ?? null)
  )
    throw new Error(t('Thông tin mặt hàng không hợp lệ.'))
  return {
    id: row.id,
    code: typeof row.code === 'string' ? row.code : '',
    name: row.name,
    unitName: typeof row.unitName === 'string' ? row.unitName : '',
    stock: row.stock,
    lastPurchasePrice: (row.lastPurchasePrice as string | null) ?? null,
    sellingPrice: (row.sellingPrice as string | null) ?? null,
  }
}

/**
 * Current balance of the chosen agency. Re-reads when `agencyId` or
 * `version` changes; an obsolete read is aborted. Empty id → nothing.
 */
export function useAgencyBalance(agencyId: string, version = 0) {
  const key = `${agencyId}:${version}`
  const [state, setState] = useState<{
    key: string
    balance: AgencyBalance | null
    error: string | null
  }>({ key: '', balance: null, error: null })
  const valid = validId(agencyId)
  useEffect(() => {
    if (!valid) return
    const controller = new AbortController()
    apiFetch<unknown>(`/agencies/${agencyId}`, { signal: controller.signal })
      .then((result) => {
        const balance = parseAgencyBalance(result.data)
        if (!controller.signal.aborted) setState({ key, balance, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({ key, balance: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [agencyId, key, valid])
  const current = valid && state.key === key
  return {
    balance: current ? state.balance : null,
    error: current ? state.error : null,
    loading: valid && state.key !== key,
  }
}

/**
 * Product quotes for the chosen line products, fetched once per product id
 * while the form is open. Failed reads are simply absent (estimates only).
 */
export function useProductQuotes(productIds: readonly string[]) {
  const [quotes, setQuotes] = useState<Record<string, ProductQuote>>({})
  const wanted = [...new Set(productIds.filter(validId))].sort().join(',')
  useEffect(() => {
    if (!wanted) return
    const controller = new AbortController()
    for (const id of wanted.split(',')) {
      apiFetch<unknown>(`/products/${id}`, { signal: controller.signal })
        .then((result) => {
          const quote = parseProductQuote(result.data)
          if (!controller.signal.aborted)
            setQuotes((current) => ({ ...current, [id]: quote }))
        })
        .catch(() => {
          // Display-only estimate; the server quotes the price on save/post.
        })
    }
    return () => controller.abort()
  }, [wanted])
  return quotes
}
