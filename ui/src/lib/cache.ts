import { apiFetch, type ApiResponse, type RequestOptions } from './api'

interface CacheEntry<T> {
  data: T
  etag: string | null
  status: number
  timestamp: number
}

const STORAGE_PREFIX = 'dms_cache_v1:'
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes default fresh TTL
const MAX_STALE_MS = 60 * 60 * 1000 // Allow serving stale up to 1 hour while revalidating

// Level 1: In-memory cache (0ms RAM access)
const memoryCache = new Map<string, CacheEntry<unknown>>()
// De-duplicate concurrent in-flight requests for the same endpoint
const pendingRequests = new Map<string, Promise<ApiResponse<unknown>>>()
// Listeners for background cache updates
type CacheListener<T> = (data: T) => void
const updateListeners = new Map<string, Set<CacheListener<unknown>>>()

function normalizeKey(path: string): string {
  try {
    const [pathname, search] = path.split('?')
    if (!search) return pathname || path
    const params = new URLSearchParams(search)
    params.sort()
    const sortedSearch = params.toString()
    return sortedSearch ? `${pathname}?${sortedSearch}` : pathname || path
  } catch {
    return path
  }
}

function getFromStorage<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (
      entry &&
      entry.data !== undefined &&
      typeof entry.timestamp === 'number'
    ) {
      return entry
    }
  } catch {
    // Quota or JSON parsing failure
  }
  return null
}

function saveToStorage<T>(key: string, entry: CacheEntry<T>): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Ignore quota errors
  }
}

function removeFromStorage(pattern?: string | RegExp): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    const keys = Object.keys(window.sessionStorage)
    for (const k of keys) {
      if (!k.startsWith(STORAGE_PREFIX)) continue
      const keyPath = k.slice(STORAGE_PREFIX.length)
      const shouldDelete =
        !pattern ||
        (typeof pattern === 'string'
          ? keyPath.includes(pattern)
          : pattern.test(keyPath))
      if (shouldDelete) {
        window.sessionStorage.removeItem(k)
      }
    }
  } catch {
    // Ignore
  }
}

/**
 * Synchronously retrieves cached data for a path if available (from RAM or sessionStorage).
 * Allows components to initialize their state with 0ms delay.
 */
export function getCachedData<T>(path: string): T | null {
  const cacheKey = normalizeKey(path)
  const mem = memoryCache.get(cacheKey) as CacheEntry<T> | undefined
  if (mem && mem.data !== undefined) {
    return mem.data
  }

  const stored = getFromStorage<T>(cacheKey)
  if (stored && stored.data !== undefined) {
    memoryCache.set(cacheKey, stored)
    return stored.data
  }

  return null
}

/**
 * Subscribes to background revalidation updates for a specific cache key.
 */
export function subscribeCacheUpdate<T>(
  path: string,
  listener: CacheListener<T>,
): () => void {
  const cacheKey = normalizeKey(path)
  let set = updateListeners.get(cacheKey)
  if (!set) {
    set = new Set()
    updateListeners.set(cacheKey, set)
  }
  set.add(listener as CacheListener<unknown>)

  return () => {
    set?.delete(listener as CacheListener<unknown>)
    if (set && set.size === 0) {
      updateListeners.delete(cacheKey)
    }
  }
}

function notifyUpdate<T>(cacheKey: string, data: T): void {
  const set = updateListeners.get(cacheKey)
  if (set) {
    for (const listener of Array.from(set)) {
      try {
        listener(data)
      } catch {
        // Safe listener execution
      }
    }
  }
}

/**
 * Triggers a non-blocking background revalidation of a cached endpoint.
 */
async function revalidateInBackground<T>(
  cacheKey: string,
  path: string,
  options: RequestOptions,
): Promise<void> {
  if (pendingRequests.has(cacheKey)) return

  try {
    const cached = memoryCache.get(cacheKey) as CacheEntry<T> | undefined
    const fetchOptions: RequestOptions = {
      ...options,
      ifNoneMatch: cached?.etag || undefined,
    }

    const res = await apiFetch<T>(path, fetchOptions)
    if (res.status === 200 && res.data !== undefined) {
      const entry: CacheEntry<T> = {
        data: res.data,
        etag: res.etag,
        status: res.status,
        timestamp: Date.now(),
      }
      memoryCache.set(cacheKey, entry)
      saveToStorage(cacheKey, entry)
      notifyUpdate(cacheKey, res.data)
    }
  } catch {
    // Background revalidation silently preserves existing cache on network failure
  }
}

/**
 * Fetches data from API or returns cached response if valid.
 * Supports Stale-While-Revalidate (SWR): returns cached data instantly while
 * refreshing in the background if older than TTL.
 */
export async function cachedApiFetch<T>(
  path: string,
  options: RequestOptions = {},
  ttlMs = DEFAULT_TTL_MS,
): Promise<ApiResponse<T>> {
  const method = options.method || 'GET'

  // Only GET requests are cached
  if (method !== 'GET') {
    return apiFetch<T>(path, options)
  }

  const cacheKey = normalizeKey(path)
  const now = Date.now()

  // 1. Check Level 1 (RAM)
  let cached = memoryCache.get(cacheKey) as CacheEntry<T> | undefined

  // 2. Check Level 2 (sessionStorage)
  if (!cached) {
    const fromStorage = getFromStorage<T>(cacheKey)
    if (fromStorage) {
      cached = fromStorage
      memoryCache.set(cacheKey, fromStorage)
    }
  }

  // 3. Stale-While-Revalidate: If data exists, return it immediately
  if (cached) {
    const age = now - cached.timestamp
    // If stale, trigger background revalidation
    if (age > ttlMs && age < MAX_STALE_MS) {
      void revalidateInBackground<T>(cacheKey, path, options)
    }

    return {
      data: cached.data,
      status: cached.status,
      etag: cached.etag,
    }
  }

  // 4. Coalesce duplicate in-flight requests
  const pending = pendingRequests.get(cacheKey) as
    Promise<ApiResponse<T>> | undefined
  if (pending) {
    return pending
  }

  const fetchPromise = apiFetch<T>(path, options)
    .then((res) => {
      const entry: CacheEntry<T> = {
        data: res.data,
        etag: res.etag,
        status: res.status,
        timestamp: Date.now(),
      }
      memoryCache.set(cacheKey, entry)
      saveToStorage(cacheKey, entry)
      notifyUpdate(cacheKey, res.data)
      return res
    })
    .finally(() => {
      pendingRequests.delete(cacheKey)
    })

  pendingRequests.set(cacheKey, fetchPromise as Promise<ApiResponse<unknown>>)
  return fetchPromise
}

/**
 * Invalidates cache by pattern or clears entire cache if pattern is omitted.
 */
export function invalidateCache(pattern?: string | RegExp): void {
  if (!pattern) {
    memoryCache.clear()
    pendingRequests.clear()
    updateListeners.clear()
    removeFromStorage()
    return
  }

  for (const key of Array.from(memoryCache.keys())) {
    const shouldDelete =
      typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)
    if (shouldDelete) {
      memoryCache.delete(key)
    }
  }

  removeFromStorage(pattern)
}

/**
 * Pre-fetches common master data in parallel in the background.
 * Call this immediately after user login or session restore.
 */
export function prefetchMasterData(): void {
  const masterEndpoints = [
    '/agencies',
    '/products',
    '/districts',
    '/agency-types',
    '/units',
    '/business-rules',
    '/receivables',
  ]

  for (const ep of masterEndpoints) {
    // Only prefetch if not already cached
    const key = normalizeKey(ep)
    if (!memoryCache.has(key) && !getFromStorage(key)) {
      void cachedApiFetch(ep).catch(() => {
        // Ignore background prefetch errors
      })
    }
  }
}
