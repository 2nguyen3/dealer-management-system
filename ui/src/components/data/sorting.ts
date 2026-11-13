import { useCallback, useState } from 'react'

/**
 * Server sort value in the API contract form: `field` (ascending) or `-field`
 * (descending). An empty string means "server default".
 */
export type SortValue = string

export type SortDirection = 'asc' | 'desc' | false

export function sortDirection(sort: SortValue, field: string): SortDirection {
  if (sort === field) return 'asc'
  if (sort === `-${field}`) return 'desc'
  return false
}

/** Next value when a header is clicked: asc → desc → default. */
export function nextSort(
  sort: SortValue,
  field: string,
  firstDirection: 'asc' | 'desc' = 'asc',
): SortValue {
  const current = sortDirection(sort, field)
  const first = firstDirection === 'asc' ? field : `-${field}`
  const second = firstDirection === 'asc' ? `-${field}` : field
  if (!current) return first
  if (sort === first) return second
  return ''
}

/** Sort state for a server-sorted list. Pass `sort` to the list query when set. */
export function useSort(initial: SortValue = '') {
  const [sort, setSort] = useState<SortValue>(initial)
  const toggle = useCallback(
    (field: string, firstDirection: 'asc' | 'desc' = 'asc') =>
      setSort((current) => nextSort(current, field, firstDirection)),
    [],
  )
  return {
    sort,
    setSort,
    toggle,
    direction: (field: string) => sortDirection(sort, field),
    /** `{ sort }` when a non-default sort is active, else `{}`. */
    params: (sort ? { sort } : {}) as Record<string, string>,
  }
}

/**
 * Client-side ordering for small, fully loaded collections (e.g. a report
 * table or a single-page catalogue). Never use it to imply server order.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: SortValue,
  accessors: Record<string, (row: T) => string | number | null | undefined>,
): T[] {
  const field = sort.replace(/^-/, '')
  const accessor = accessors[field]
  if (!sort || !accessor) return [...rows]
  const factor = sort.startsWith('-') ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = accessor(a)
    const y = accessor(b)
    if (x === y) return 0
    if (x === null || x === undefined) return 1
    if (y === null || y === undefined) return -1
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * factor
    return String(x).localeCompare(String(y), 'vi', { numeric: true }) * factor
  })
}
