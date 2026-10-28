import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  setAccessToken,
} from '../features/authentication/session'
import { ApiError, apiFetch } from '../lib/api'

describe('apiFetch Transport', () => {
  beforeEach(() => {
    clearSession()
    vi.restoreAllMocks()
  })

  it('handles 204 No Content response without attempting to parse JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    const res = await apiFetch('/test-endpoint', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(res.data).toBeUndefined()
  })

  it('extracts and preserves ETag from response headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1, name: 'Item' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: 'W/"v1-etag-123"',
        },
      }),
    )

    const res = await apiFetch<{ id: number; name: string }>('/items/1')
    expect(res.data.id).toBe(1)
    expect(res.etag).toBe('W/"v1-etag-123"')
  })

  it('passes If-Match and If-None-Match headers as provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await apiFetch('/items/1', {
      method: 'PUT',
      ifMatch: 'W/"v1-etag-123"',
      body: { name: 'Updated' },
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/1'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'If-Match': 'W/"v1-etag-123"',
        }),
      }),
    )
  })

  it('maps HTTP errors into structured ApiError with status, code, and message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'PRECONDITION_FAILED',
            message: 'Dữ liệu đã bị thay đổi bởi người khác',
            requestId: 'req-412',
          }),
          {
            status: 412,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(apiFetch('/items/1', { method: 'PUT' })).rejects.toThrow(
      ApiError,
    )

    try {
      await apiFetch('/items/1', { method: 'PUT' })
    } catch (err: unknown) {
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(412)
      expect(apiErr.code).toBe('PRECONDITION_FAILED')
      expect(apiErr.message).toBe('Dữ liệu đã bị thay đổi bởi người khác')
      expect(apiErr.requestId).toBe('req-412')
    }
  })

  it('maps network errors cleanly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    )

    try {
      await apiFetch('/items')
    } catch (err: unknown) {
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(0)
      expect(apiErr.code).toBe('NETWORK_ERROR')
      expect(apiErr.message).toContain('Không thể kết nối đến máy chủ')
    }
  })

  it('includes Bearer token in Authorization header when authenticated', async () => {
    setAccessToken('bearer-token-abc')

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    await apiFetch('/profile')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/profile'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer bearer-token-abc',
        }),
      }),
    )
  })
})
