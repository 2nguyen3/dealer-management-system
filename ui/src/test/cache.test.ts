import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  setAccessToken,
} from '../features/authentication/session'
import {
  cachedApiFetch,
  getCachedData,
  invalidateCache,
  prefetchMasterData,
  subscribeCacheUpdate,
} from '../lib/cache'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('No-store demand-driven reads', () => {
  beforeEach(() => {
    clearSession()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('never persists or serves a completed protected response, including old stale entries', async () => {
    sessionStorage.setItem(
      'dms_cache_v1:/items',
      JSON.stringify({ data: 'private', timestamp: 0 }),
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response('{"amount":"9007199254740993.01"}', {
          headers: { 'Cache-Control': 'no-store' },
        }),
    )
    expect(getCachedData('/items')).toBeNull()
    const first = await cachedApiFetch('/items')
    const second = await cachedApiFetch('/items', {}, 0)
    expect(first.data).toEqual(second.data)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0]?.[1]?.cache).toBe('no-store')
    expect(getCachedData('/items')).toBeNull()
    invalidateCache()
    expect(sessionStorage.getItem('dms_cache_v1:/items')).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('coalesces equivalent in-flight GET filters but refetches after settlement', async () => {
    const reply = deferred<Response>()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(reply.promise)
      .mockResolvedValue(new Response('{}'))
    const one = cachedApiFetch('/items?limit=20&status=ACTIVE')
    const two = cachedApiFetch('/items?status=ACTIVE&limit=20')
    reply.resolve(new Response('{"id":"9223372036854775807"}'))
    expect(await one).toEqual(await two)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    await cachedApiFetch('/items?limit=20&status=ACTIVE')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('isolates caller cancellation while a second consumer still needs the read', async () => {
    const reply = deferred<Response>()
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(reply.promise)
    const controller = new AbortController()
    const one = cachedApiFetch('/items', { signal: controller.signal })
    const rejected = expect(one).rejects.toMatchObject({ name: 'AbortError' })
    const two = cachedApiFetch('/items')
    controller.abort()
    await rejected
    expect(spy.mock.calls[0]?.[1]?.signal?.aborted).toBe(false)
    reply.resolve(new Response('{}'))
    expect((await two).data).toEqual({})
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('aborts the network when its last consumer leaves and starts a new read', async () => {
    const old = deferred<Response>()
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(new Response('{"new":true}'))
    const controller = new AbortController()
    const one = cachedApiFetch('/items', { signal: controller.signal })
    const rejected = expect(one).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(spy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect((await cachedApiFetch('/items')).data).toEqual({ new: true })
    old.resolve(new Response('{}'))
  })

  it('invalidates only matching pending reads and removes legacy storage by pattern', async () => {
    const products = deferred<Response>()
    const agencies = deferred<Response>()
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(products.promise)
      .mockReturnValueOnce(agencies.promise)
    sessionStorage.setItem('dms_cache_v1:/products', 'old')
    sessionStorage.setItem('dms_cache_v1:/agencies', 'old')
    const one = cachedApiFetch('/products')
    const rejected = expect(one).rejects.toMatchObject({ name: 'AbortError' })
    const two = cachedApiFetch('/agencies')
    invalidateCache(/products/g)
    products.resolve(new Response('{}'))
    agencies.resolve(new Response('{}'))
    await rejected
    expect((await two).status).toBe(200)
    expect(sessionStorage.getItem('dms_cache_v1:/products')).toBeNull()
    expect(sessionStorage.getItem('dms_cache_v1:/agencies')).toBe('old')
  })

  it('does not deduplicate different representations, preconditions or mutations', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}'))
    await Promise.all([
      cachedApiFetch('/items', { headers: { Accept: 'application/json' } }),
      cachedApiFetch('/items', { headers: { Accept: 'text/plain' } }),
      cachedApiFetch('/items', { ifNoneMatch: '"v1"' }),
      cachedApiFetch('/items', { method: 'POST' }),
      cachedApiFetch('/items', { method: 'POST' }),
    ])
    expect(spy).toHaveBeenCalledTimes(5)
  })

  it('does not let logout/account switch leak an older pending result or coalesce it with the new identity', async () => {
    setAccessToken('old')
    const old = deferred<Response>()
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(new Response('{"new":true}'))
    const one = cachedApiFetch('/items')
    const rejected = expect(one).rejects.toMatchObject({ name: 'AbortError' })
    clearSession()
    setAccessToken('new')
    expect((await cachedApiFetch('/items')).data).toEqual({ new: true })
    old.resolve(new Response('{"private":true}'))
    await rejected
    expect(getCachedData('/items')).toBeNull()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('cleans failed reads so a later demand can recover', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError())
      .mockResolvedValueOnce(new Response('{}'))
    await expect(cachedApiFetch('/items')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    await cachedApiFetch('/items')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('does not request anything for blanket prefetch or notify stale subscribers', () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const listener = vi.fn()
    const unsubscribe = subscribeCacheUpdate('/products', listener)
    prefetchMasterData()
    unsubscribe()
    expect(listener).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not fetch for a pre-aborted caller', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    await expect(
      cachedApiFetch('/items', { signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(spy).not.toHaveBeenCalled()
  })
})
