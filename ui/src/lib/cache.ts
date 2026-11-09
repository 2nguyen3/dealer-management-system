import { apiFetch, type ApiResponse, type RequestOptions } from './api'

interface PendingRead {
  path: string
  controller: AbortController
  promise: Promise<ApiResponse<unknown>>
  consumers: number
}

const pendingReads = new Map<string, PendingRead>()

// Protected resources are no-store. Keep the existing call surface without retaining
// business responses in RAM/storage or returning stale authorization-sensitive data.
export function getCachedData<T>(_path: string): T | null {
  void _path
  return null
}

export function subscribeCacheUpdate<T>(
  _path: string,
  _listener: (data: T) => void,
): () => void {
  void _path
  void _listener
  return () => {}
}

export async function cachedApiFetch<T>(
  path: string,
  options: RequestOptions = {},
  _ttlMs?: number,
): Promise<ApiResponse<T>> {
  void _ttlMs
  if (
    (options.method || 'GET') !== 'GET' ||
    options.validate ||
    options.responseType === 'blob'
  ) {
    return apiFetch<T>(path, options)
  }
  options.signal?.throwIfAborted()
  const [pathname, search] = path.split('?')
  const params = new URLSearchParams(search)
  params.sort()
  const headers = Array.from(new Headers(options.headers).entries()).sort(
    ([a], [b]) => a.localeCompare(b),
  )
  const key = JSON.stringify([
    pathname,
    params.toString(),
    headers,
    options.requiresAuth ?? true,
    options.ifMatch,
    options.ifNoneMatch,
  ])
  let pending = pendingReads.get(key)
  if (!pending) {
    const controller = new AbortController()
    const read: PendingRead = {
      path,
      controller,
      consumers: 0,
      promise: apiFetch(path, { ...options, signal: controller.signal }),
    }
    pending = read
    pendingReads.set(key, read)
    void read.promise
      .finally(() => {
        if (pendingReads.get(key) === read) pendingReads.delete(key)
      })
      .catch(() => {})
  }
  const read = pending
  read.consumers++
  return new Promise<ApiResponse<T>>((resolve, reject) => {
    let finished = false
    const finish = () => {
      if (finished) return false
      finished = true
      options.signal?.removeEventListener('abort', abort)
      read.consumers--
      return true
    }
    const abort = () => {
      if (!finish()) return
      reject(options.signal?.reason)
      if (read.consumers === 0) {
        read.controller.abort()
        if (pendingReads.get(key) === read) pendingReads.delete(key)
      }
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
    read.promise.then(
      (response) => {
        if (finish()) {
          if (read.controller.signal.aborted)
            reject(read.controller.signal.reason)
          else resolve(response as ApiResponse<T>)
        }
      },
      (error: unknown) => {
        if (finish()) reject(error)
      },
    )
  })
}

export function invalidateCache(pattern?: string | RegExp): void {
  const matches = (path: string) => {
    if (pattern === undefined) return true
    if (typeof pattern === 'string') return path.includes(pattern)
    pattern.lastIndex = 0
    return pattern.test(path)
  }
  for (const [key, read] of pendingReads) {
    if (matches(read.path)) {
      read.controller.abort()
      pendingReads.delete(key)
    }
  }
  // Remove responses persisted by earlier versions, never read or write new ones.
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (
        key.startsWith('dms_cache_v1:') &&
        matches(key.slice('dms_cache_v1:'.length))
      ) {
        sessionStorage.removeItem(key)
      }
    }
  } catch {
    // Storage-denied browsers still use no-store reads.
  }
}

// Demand-driven features own their exact permission checks and fetch timing.
export function prefetchMasterData(): void {}
