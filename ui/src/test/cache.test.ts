import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedApiFetch, invalidateCache } from '../lib/cache'

describe('Client-side in-memory Cache', () => {
  beforeEach(() => {
    invalidateCache()
    vi.restoreAllMocks()
  })

  it('serves cached data on subsequent GET requests without duplicate network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: 'Item 1' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    // Call 1: makes network request
    const res1 = await cachedApiFetch('/items')
    expect(res1.data).toEqual([{ id: 1, name: 'Item 1' }])
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Call 2: served from memory cache immediately (0ms, 0 extra fetch calls)
    const res2 = await cachedApiFetch('/items')
    expect(res2.data).toEqual([{ id: 1, name: 'Item 1' }])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('coalesces concurrent requests to the same endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    // Fire 3 requests in parallel
    const [r1, r2, r3] = await Promise.all([
      cachedApiFetch('/status'),
      cachedApiFetch('/status'),
      cachedApiFetch('/status'),
    ])

    expect(r1.data).toEqual({ status: 'ok' })
    expect(r2.data).toEqual({ status: 'ok' })
    expect(r3.data).toEqual({ status: 'ok' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('invalidates cache matching specific patterns', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ counter: Math.random() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await cachedApiFetch('/products')
    await cachedApiFetch('/agencies')
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    // Invalidate only products
    invalidateCache('/products')

    // /agencies should still be cached
    await cachedApiFetch('/agencies')
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    // /products must make a new network request
    await cachedApiFetch('/products')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })
})
