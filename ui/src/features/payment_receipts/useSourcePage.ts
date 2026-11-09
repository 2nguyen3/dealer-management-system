import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { message, page, queryPath, type Page } from './contracts'

export function useSourcePage<T>(
  path: string,
  filters: Record<string, string>,
  decode: (value: unknown) => T,
) {
  const queryFilters: Record<string, string> = {
    ...filters,
    ...('q' in filters ? { q: filters.q.trim() } : {}),
  }
  const filterKey = JSON.stringify(queryFilters)
  const [position, setPosition] = useState<{ key: string; cursors: string[] }>({
    key: '',
    cursors: [''],
  })
  const cursors = position.key === filterKey ? position.cursors : ['']
  const cursor = cursors[cursors.length - 1] ?? ''
  const url = queryPath(path, {
    ...queryFilters,
    limit: queryFilters.limit || '25',
    cursor,
  })
  const [settledUrl, setSettledUrl] = useState(url)
  useEffect(() => {
    const timer = setTimeout(() => setSettledUrl(url), 300)
    return () => clearTimeout(timer)
  }, [url])
  const [state, setState] = useState<{
    url: string
    data?: Page<T>
    error?: string
  }>({ url: '' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    if (url !== settledUrl)
      return () => {
        current = false
        controller.abort()
      }
    apiFetch<unknown>(url, { signal: controller.signal })
      .then((response) => {
        const data = page(response.data, decode)
        if (current) setState({ url, data })
      })
      .catch((error: unknown) => {
        if (current) setState({ url, error: message(error) })
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [url, settledUrl, decode, revision])
  const visible = state.url === url ? state : undefined
  return {
    items: visible?.data?.items ?? [],
    loading: !visible,
    error: visible?.error,
    metadata: visible?.data?.metadata,
    hasMore: visible?.data?.pagination.hasMore ?? false,
    hasPrevious: cursors.length > 1,
    next: () => {
      const next = visible?.data?.pagination.nextCursor
      if (next) setPosition({ key: filterKey, cursors: [...cursors, next] })
    },
    previous: () =>
      setPosition({ key: filterKey, cursors: cursors.slice(0, -1) }),
    reload: () => {
      setState({ url: '' })
      setRevision((value) => value + 1)
    },
  }
}
