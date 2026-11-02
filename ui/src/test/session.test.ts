import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  abortAllAuthenticatedRequests,
  clearSession,
  getAccessToken,
  getCurrentUser,
  getStoredRefreshToken,
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
    refreshExpiresAt: '2026-10-30T12:00:00Z',
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
})
