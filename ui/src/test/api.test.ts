import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  saveSession,
  setAccessToken,
} from '../features/authentication/session'
import { ApiError, apiFetch, apiDownload, checkApiHealth } from '../lib/api'

const token = {
  accessToken: 'old',
  refreshToken: 'refresh',
  tokenType: 'Bearer' as const,
  expiresAt: '2099-01-01T00:00:00Z',
  refreshExpiresAt: '2099-02-01T00:00:00Z',
  user: {
    id: '9223372036854775807',
    fullName: 'A',
    email: 'a@test.vn',
    groupId: 1,
    groupCode: 'MANAGEMENT',
    groupName: 'Management',
    status: 'ACTIVE' as const,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}

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

    expect(
      new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get('If-Match'),
    ).toBe('W/"v1-etag-123"')
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

    expect(
      new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer bearer-token-abc')
  })

  it('cancels caller-supplied signals on logout, including fetches ignoring abort', async () => {
    let resolve!: (response: Response) => void
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise((yes) => {
        resolve = yes
      }),
    )
    const caller = new AbortController()
    const promise = apiFetch('/items', { signal: caller.signal })
    const rejected = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    })
    clearSession()
    expect(spy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(caller.signal.aborted).toBe(false)
    resolve(new Response('{}'))
    await rejected
  })

  it('preserves caller TimeoutError and does not turn abort into network failure', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      controller.abort(new DOMException('Timed out', 'TimeoutError'))
      throw new TypeError('aborted')
    })
    await expect(
      apiFetch('/items', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('rejects a late body after logout and never returns another account data', async () => {
    let resolve!: (data: unknown) => void
    const response = new Response('{}')
    vi.spyOn(response, 'json').mockReturnValue(
      new Promise((yes) => {
        resolve = yes
      }),
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
    const promise = apiFetch('/items')
    const rejected = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    })
    await vi.waitFor(() => expect(response.json).toHaveBeenCalled())
    setAccessToken('new-account')
    resolve({ old: 'secret' })
    await rejected
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'never refreshes or automatically replays %s, even with a stable key',
    async (method) => {
      saveSession(token)
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response('{"code":"UNAUTHORIZED"}', { status: 401 }),
        )
      await expect(
        apiFetch('/payments', {
          method,
          idempotencyKey: 'same-intent',
          body: { amount: '9007199254740993.01' },
        }),
      ).rejects.toMatchObject({ status: 401 })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0]?.[1]?.body).toBe(
        '{"amount":"9007199254740993.01"}',
      )
    },
  )

  it.each(['/auth/password', 'auth/password-reset-requests'])(
    'does not refresh auth endpoint %s on 401',
    async (path) => {
      saveSession(token)
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 401 }))
      await expect(apiFetch(path)).rejects.toMatchObject({ status: 401 })
      expect(spy).toHaveBeenCalledTimes(1)
    },
  )

  it('coordinates parallel GET refresh and retries once with the rotated token', async () => {
    saveSession(token)
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url, init) => {
        if (String(url).endsWith('/auth/refresh'))
          return new Response(
            JSON.stringify({
              ...token,
              accessToken: 'new',
              refreshToken: 'rotated',
            }),
          )
        const authorization = new Headers(init?.headers).get('Authorization')
        return authorization === 'Bearer old'
          ? new Response('{}', { status: 401 })
          : new Response(
              '{"id":"9223372036854775807","amount":"9007199254740993.01"}',
            )
      })
    const responses = await Promise.all([apiFetch('/one'), apiFetch('/two')])
    expect(responses[0]?.data).toEqual({
      id: '9223372036854775807',
      amount: '9007199254740993.01',
    })
    expect(
      spy.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')),
    ).toHaveLength(1)
    expect(spy).toHaveBeenCalledTimes(5)
  })

  it('stops after a second GET 401 and never loops on permission denial', async () => {
    saveSession(token)
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...token, accessToken: 'new' })),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(apiFetch('/items')).rejects.toMatchObject({ status: 401 })
    expect(spy).toHaveBeenCalledTimes(3)
    spy.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    await expect(apiFetch('/items')).rejects.toMatchObject({ status: 403 })
    expect(spy).toHaveBeenCalledTimes(4)
  })

  it('validates error envelope types and maps source fieldErrors without blindly casting', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: { secret: 1 },
          message: ['bad'],
          requestId: {},
          fieldErrors: [
            { field: 'amount', code: 'INVALID', message: 'Invalid amount' },
            { field: 'password', message: { secret: 1 } },
            null,
          ],
        }),
        { status: 422, headers: { 'Retry-After': '15' } },
      ),
    )
    await expect(apiFetch('/items')).rejects.toMatchObject({
      code: 'HTTP_422',
      message: 'Yêu cầu thất bại (HTTP 422)',
      retryAfter: '15',
      fieldErrors: { amount: 'Invalid amount' },
    })
  })

  it('does not expose arbitrary server error dumps', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        '{"message":"password=secret traceback","requestId":"safe-id"}',
        { status: 500 },
      ),
    )
    await expect(apiFetch('/items')).rejects.toMatchObject({
      message: 'Máy chủ gặp sự cố xử lý.',
      requestId: 'safe-id',
    })
  })

  it.each(['not json', 'null'])(
    'handles invalid success envelopes safely: %s',
    async (body) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body))
      await expect(
        apiFetch('/items', {
          validate: (value) => typeof value === 'object' && value !== null,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    },
  )

  it.each([
    'application/pdf',
    'text/html',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ])('downloads authenticated %s with explicit Accept', async (accept) => {
    setAccessToken('download-token')
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('server artifact', {
        headers: { 'Content-Type': `${accept}; charset=utf-8`, ETag: '"v2"' },
      }),
    )
    const response = await apiDownload('/exports?month=10&year=2026', {
      headers: { Accept: accept },
    })
    expect(response.data.size).toBe(15)
    expect(response.data.type).toBe(`${accept};charset=utf-8`)
    expect(response.etag).toBe('"v2"')
    expect(
      new Headers(spy.mock.calls[0]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer download-token')
    expect(new Headers(spy.mock.calls[0]?.[1]?.headers).get('Accept')).toBe(
      accept,
    )
  })

  it('rejects a successful JSON response disguised as a binary download', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    )
    await expect(
      apiDownload('/export', { headers: { Accept: 'application/pdf' } }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('validates download Accept before sending and keeps JSON errors for failed binaries', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"code":"FORBIDDEN","message":"Denied"}', {
        status: 403,
      }),
    )
    await expect(apiDownload('/export')).rejects.toMatchObject({
      code: 'INVALID_ACCEPT',
    })
    expect(spy).not.toHaveBeenCalled()
    await expect(
      apiDownload('/export', { headers: { Accept: 'application/pdf' } }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('preserves idempotency/precondition headers and FormData without JSON encoding', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))
    const body = new FormData()
    body.set('name', 'A')
    await apiFetch('/upload', {
      method: 'POST',
      body,
      ifNoneMatch: '*',
      idempotencyKey: 'stable',
    })
    expect(spy.mock.calls[0]?.[1]?.body).toBe(body)
    expect(
      new Headers(spy.mock.calls[0]?.[1]?.headers).get('If-None-Match'),
    ).toBe('*')
    expect(
      new Headers(spy.mock.calls[0]?.[1]?.headers).get('Idempotency-Key'),
    ).toBe('stable')
    expect(
      new Headers(spy.mock.calls[0]?.[1]?.headers).get('Content-Type'),
    ).toBeNull()
  })

  it('validates health response success, failure and malformed body', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"status":"ok"}'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('null'))
    await expect(
      checkApiHealth(new AbortController().signal),
    ).resolves.toBeUndefined()
    await expect(checkApiHealth(new AbortController().signal)).rejects.toThrow(
      'HTTP 503',
    )
    await expect(checkApiHealth(new AbortController().signal)).rejects.toThrow(
      'Unexpected API health response',
    )
    expect(spy).toHaveBeenCalledTimes(3)
  })
})
