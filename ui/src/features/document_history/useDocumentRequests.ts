import { useEffect, useRef, useState } from 'react'
import { ApiError, apiFetch, type RequestOptions } from '../../lib/api'
import { cachedApiFetch } from '../../lib/cache'
import { useAuth } from '../authentication/useAuth'
import { parsePage, type Page } from './documentContracts'
import { t } from '@/lib/i18n/core'

export function errorMessage(error: unknown) {
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500))
    return t(
      '{message} Kết quả chưa rõ. Tải lại chứng từ để kiểm tra trước khi thử lại.',
      { message: error.message },
    )
  return error instanceof Error ? error.message : t('Không thể xử lý yêu cầu.')
}

/**
 * One document mutation at a time. Document routes have no idempotency key
 * (handoff A4): drafts and state changes are guarded by If-Match instead, so
 * a stale or repeated request is refused with 412/409, never applied twice.
 */
export function useDocumentMutation() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  async function run(path: string, options: RequestOptions = {}) {
    if (lock.current) throw new Error(t('Yêu cầu đang được xử lý.'))
    lock.current = true
    setBusy(true)
    try {
      return await apiFetch<unknown>(path, {
        ...options,
        method: options.method ?? 'POST',
      })
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
