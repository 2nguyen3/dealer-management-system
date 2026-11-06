import { useEffect, useRef, useState } from 'react'
import { ApiError, apiFetch, type RequestOptions } from '../../lib/api'
import { cachedApiFetch } from '../../lib/cache'
import { useAuth } from '../authentication/useAuth'
import { parsePage, type Page } from './documentContracts'

export function errorMessage(error: unknown) {
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500))
    return `${error.message} Kết quả chưa rõ. Thử lại cùng nội dung để giữ nguyên khóa yêu cầu; không lập phiếu khác.`
  return error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.'
}
export function useDocumentMutation() {
  const { user } = useAuth()
  const current = useRef<{ fingerprint: string; key: string } | null>(null)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  async function run(path: string, options: RequestOptions = {}) {
    if (lock.current) throw new Error('Yêu cầu đang được xử lý.')
    const fingerprint = JSON.stringify([
      user?.id,
      path,
      options.method ?? 'POST',
      options.ifMatch,
      options.body,
    ])
    if (current.current?.fingerprint !== fingerprint)
      current.current = { fingerprint, key: crypto.randomUUID() }
    lock.current = true
    setBusy(true)
    try {
      const result = await apiFetch<unknown>(path, {
        ...options,
        method: options.method ?? 'POST',
        idempotencyKey: current.current.key,
      })
      current.current = null
      return result
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { run, busy }
}

export function useDocumentPage<T>(
  path: string | null,
  parseItem: (value: unknown) => T,
  refresh = 0,
) {
  const { user, allowedFunctions } = useAuth()
  const scope = `${user?.id}:${allowedFunctions.join(',')}`
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<{
    key: string
    page: Page<T> | null
    error: string | null
  }>({ key: '', page: null, error: null })
  const key = `${scope}:${path}:${version}:${refresh}`
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    cachedApiFetch<unknown>(path, { signal: controller.signal })
      .then((result) => {
        const page = parsePage(result.data, parseItem)
        if (!controller.signal.aborted) setState({ key, page, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({ key, page: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [key, path, parseItem])
  return {
    page: state.key === key ? state.page : null,
    error: state.key === key ? state.error : null,
    loading: !!path && state.key !== key,
    reload: () => setVersion((value) => value + 1),
  }
}
