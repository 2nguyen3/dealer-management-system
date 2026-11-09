import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  abortAllAuthenticatedRequests,
  clearSession,
  getAccessToken,
  getCurrentUser,
  getStoredRefreshToken,
  fetchCurrentUser,
  isTokenResponse,
  refreshSession,
  registerAuthenticatedAbortController,
  saveSession,
  setAccessToken,
} from '../features/authentication/session'
import type { TokenResponse } from '../lib/types'

describe('Session & Tab Coordination', () => {
  const mockTokenResponse: TokenResponse = {
    accessToken: 'test-access-token-123',
    tokenType: 'Bearer',
    expiresAt: '2026-10-23T12:00:00Z',
    refreshToken: 'test-refresh-token-456',
    refreshExpiresAt: '2099-10-30T12:00:00Z',
    user: {
      id: '1',
      fullName: 'Nguyễn Văn A',
      email: 'a@agentra.vn',
      groupId: 1,
      groupCode: 'MANAGEMENT',
      groupName: 'Quản lý',
      status: 'ACTIVE',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    },
  }

  beforeEach(() => {
    clearSession()
    window.name = ''
    sessionStorage.clear()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores access token in memory and refresh token in sessionStorage, never in localStorage', () => {
    saveSession(mockTokenResponse)

    expect(getAccessToken()).toBe('test-access-token-123')
    expect(getCurrentUser()?.email).toBe('a@agentra.vn')

    // sessionStorage has refresh token
    const stored = sessionStorage.getItem('agentra_auth_session')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored!).refreshToken).toBe('test-refresh-token-456')

    // localStorage must NEVER contain token or credentials
    expect(localStorage.length).toBe(0)
  })

  it('detects duplicated tab and prevents racing single-use refresh token', () => {
    // Session created in initial tab
    saveSession(mockTokenResponse)
    expect(getStoredRefreshToken()).toBe('test-refresh-token-456')

    // In a duplicated tab, window.name is reset to empty by the browser
    window.name = ''

    // When the duplicated tab loads, it should detect that sessionStorage belonged to another tab
    // and clear it to prevent racing the parent tab's single-use refresh token
    const tokenInDuplicatedTab = getStoredRefreshToken()
    expect(tokenInDuplicatedTab).toBeNull()
  })

  it('coalesces concurrent refresh calls into a single in-flight network request', async () => {
    saveSession(mockTokenResponse)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ...mockTokenResponse,
          accessToken: 'new-access-token-789',
          refreshToken: 'new-refresh-token-999',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    // Trigger two refresh requests concurrently
    const [p1, p2] = await Promise.all([
      refreshSession('/api/v1'),
      refreshSession('/api/v1'),
    ])

    expect(p1?.accessToken).toBe('new-access-token-789')
    expect(p2?.accessToken).toBe('new-access-token-789')
    // Must only have made 1 network call
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('aborts all active authenticated requests on logout or clearSession', () => {
    const controller = new AbortController()
    const abortSpy = vi.spyOn(controller, 'abort')

    registerAuthenticatedAbortController(controller)
    expect(controller.signal.aborted).toBe(false)

    abortAllAuthenticatedRequests()
    expect(abortSpy).toHaveBeenCalled()
    expect(controller.signal.aborted).toBe(true)
  })

  it('clears all session state on failed refresh', async () => {
    saveSession(mockTokenResponse)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }),
    )

    const res = await refreshSession('/api/v1')
    expect(res).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(getCurrentUser()).toBeNull()
    expect(getStoredRefreshToken()).toBeNull()
  })

  it('allows manual setAccessToken in memory', () => {
    setAccessToken('custom-token')
    expect(getAccessToken()).toBe('custom-token')
    setAccessToken(null)
    expect(getAccessToken()).toBeNull()
  })

  it.each(['logout', 'switch'] as const)(
    'never publishes a late refresh success after %s',
    async (action) => {
      saveSession(mockTokenResponse)
      let resolve!: (response: Response) => void
      const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(
        new Promise((yes) => {
          resolve = yes
        }),
      )
      const pending = refreshSession('/api/v1')
      if (action === 'logout') clearSession()
      else
        saveSession({
          ...mockTokenResponse,
          accessToken: 'other',
          user: { ...mockTokenResponse.user, id: '2' },
        })
      expect(spy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
      resolve(new Response(JSON.stringify(mockTokenResponse)))
      expect(await pending).toBeNull()
      expect(getAccessToken()).toBe(action === 'logout' ? null : 'other')
    },
  )

  it('an old failed refresh does not clear the new account or its in-flight refresh', async () => {
    saveSession(mockTokenResponse)
    let reject!: (reason: unknown) => void
    let resolve!: (response: Response) => void
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(
        new Promise((_yes, no) => {
          reject = no
        }),
      )
      .mockReturnValueOnce(
        new Promise((yes) => {
          resolve = yes
        }),
      )
    const old = refreshSession('/api/v1')
    saveSession({
      ...mockTokenResponse,
      accessToken: 'other',
      refreshToken: 'other-refresh',
      user: { ...mockTokenResponse.user, id: '2' },
    })
    const current = refreshSession('/api/v1')
    reject(new TypeError('old request'))
    expect(await old).toBeNull()
    const coalesced = refreshSession('/api/v1')
    expect(spy).toHaveBeenCalledTimes(2)
    resolve(
      new Response(
        JSON.stringify({
          ...mockTokenResponse,
          accessToken: 'newer',
          user: { ...mockTokenResponse.user, id: '2' },
        }),
      ),
    )
    expect((await current)?.accessToken).toBe('newer')
    expect((await coalesced)?.accessToken).toBe('newer')
  })

  it('clears an uncertain refresh response instead of reusing its single-use token', async () => {
    saveSession(mockTokenResponse)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('lost reply'))
    expect(await refreshSession('/api/v1')).toBeNull()
    expect(getStoredRefreshToken()).toBeNull()
  })

  it.each([
    null,
    {},
    {
      ...mockTokenResponse,
      user: { ...mockTokenResponse.user, id: 9007199254740990 },
    },
    { ...mockTokenResponse, accessToken: {} },
    { ...mockTokenResponse, tokenType: 'Basic' },
  ])('rejects malformed token envelopes without persisting them', (value) => {
    expect(isTokenResponse(value)).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('rejects invalid refresh JSON and identity mismatch', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('not json'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...mockTokenResponse,
            user: { ...mockTokenResponse.user, id: '2' },
          }),
        ),
      )
    saveSession(mockTokenResponse)
    expect(await refreshSession('/api/v1')).toBeNull()
    saveSession(mockTokenResponse)
    expect(await refreshSession('/api/v1')).toBeNull()
    expect(getCurrentUser()).toBeNull()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('handles malformed/expired stored refresh tokens and disabled storage safely', () => {
    sessionStorage.setItem('agentra_auth_session', '{broken')
    expect(getStoredRefreshToken()).toBeNull()
    sessionStorage.setItem(
      'agentra_auth_session',
      JSON.stringify({
        refreshToken: {},
        refreshExpiresAt: '2099-01-01T00:00:00Z',
      }),
    )
    expect(getStoredRefreshToken()).toBeNull()
    sessionStorage.setItem(
      'agentra_auth_session',
      JSON.stringify({
        refreshToken: 'expired',
        refreshExpiresAt: '2000-01-01T00:00:00Z',
      }),
    )
    expect(getStoredRefreshToken()).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    saveSession(mockTokenResponse)
    expect(getAccessToken()).toBe(mockTokenResponse.accessToken)
    expect(getStoredRefreshToken()).toBeNull()
    clearSession()
    expect(getAccessToken()).toBeNull()
  })

  it('validates profile grants and exact ID without inferring management privileges', async () => {
    saveSession(mockTokenResponse)
    const valid = {
      user: { ...mockTokenResponse.user, id: '1' },
      allowedFunctions: ['agency.read'],
    }
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(valid)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...valid, allowedFunctions: ['unknown.admin'] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...valid,
            allowedFunctions: ['agency.read', 'agency.read'],
          }),
        ),
      )
    expect(
      await fetchCurrentUser('/api/v1', mockTokenResponse.accessToken),
    ).toEqual(valid)
    await expect(
      fetchCurrentUser('/api/v1', mockTokenResponse.accessToken),
    ).rejects.toThrow('Invalid profile')
    await expect(
      fetchCurrentUser('/api/v1', mockTokenResponse.accessToken),
    ).rejects.toThrow('Invalid profile')
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('cancels profiles with a caller signal on logout and rejects late body reads', async () => {
    saveSession(mockTokenResponse)
    let resolve!: (value: unknown) => void
    const response = new Response('{}')
    vi.spyOn(response, 'json').mockReturnValue(
      new Promise((yes) => {
        resolve = yes
      }),
    )
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
    const caller = new AbortController()
    const pending = fetchCurrentUser(
      '/api/v1',
      mockTokenResponse.accessToken,
      caller.signal,
    )
    const rejected = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    })
    await vi.waitFor(() => expect(response.json).toHaveBeenCalled())
    clearSession()
    resolve({ user: mockTokenResponse.user, allowedFunctions: ['agency.read'] })
    await rejected
    expect(spy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(caller.signal.aborted).toBe(false)
  })
})
