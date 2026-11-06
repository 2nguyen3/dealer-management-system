import { StrictMode, useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../features/authentication/AuthContext'
import {
  useAuth,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import {
  clearSession,
  getAccessToken,
  saveSession,
  setAccessToken,
} from '../features/authentication/session'
import type { TokenResponse } from '../lib/types'

const token: TokenResponse = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer',
  expiresAt: '2099-01-01T00:00:00Z',
  refreshExpiresAt: '2099-02-01T00:00:00Z',
  user: {
    id: '9223372036854775807',
    fullName: 'A',
    email: 'a@test.vn',
    groupId: 1,
    groupCode: 'MANAGEMENT',
    groupName: 'Management',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}
let auth: AuthContextValue

function Consumer() {
  const currentAuth = useAuth()
  useEffect(() => {
    auth = currentAuth
  }, [currentAuth])
  return (
    <div>
      <output data-testid="identity">
        {currentAuth.user?.id || 'anonymous'}
      </output>
      <output data-testid="loading">{String(currentAuth.isLoading)}</output>
      <output data-testid="grants">
        {currentAuth.allowedFunctions.join(',')}
      </output>
    </div>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const profile = (data = token, grants = ['agency.read']) =>
  new Response(JSON.stringify({ user: data.user, allowedFunctions: grants }))

describe('AuthProvider lifecycle', () => {
  beforeEach(() => {
    clearSession()
    sessionStorage.clear()
    window.name = ''
    vi.restoreAllMocks()
  })

  it('settles anonymous without requests or unauthorized blanket prefetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(auth.isLoading).toBe(false))
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.hasPermission('agency.read')).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    await act(() => auth.refreshProfile())
    expect(spy).not.toHaveBeenCalled()
  })

  it('logs in with exact password bytes, validates profile/grants and issues only two demand requests', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(token)))
      .mockResolvedValueOnce(profile())
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await act(() => auth.login('a@test.vn', '  untouched  '))
    expect(auth.user?.id).toBe('9223372036854775807')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.hasPermission('agency.read')).toBe(true)
    expect(auth.hasPermission(['reports.read', 'agency.read'])).toBe(true)
    expect(auth.hasPermission(['reports.read'])).toBe(false)
    expect(auth.hasPermission('users.manage')).toBe(false)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls[0]?.[1]?.body).toBe(
      '{"email":"a@test.vn","password":"  untouched  "}',
    )
    expect(String(spy.mock.calls[1]?.[0])).toContain('/auth/me')
  })

  it('rejects malformed login data before storing credentials or loading grants', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"accessToken":"untrusted"}'))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await act(async () => {
      await expect(auth.login('a@test.vn', 'pw')).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      })
    })
    expect(getAccessToken()).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('returns a validated safe login error and does not retry wrong password 401', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"code":{"bad":true},"message":{},"requestId":[]}', {
        status: 401,
      }),
    )
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await act(async () => {
      await expect(auth.login('a@test.vn', 'pw')).rejects.toMatchObject({
        status: 401,
        code: 'HTTP_401',
      })
    })
    expect(auth.isAuthenticated).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('rejects profile failure rather than reporting a successful login', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(token)))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await act(async () => {
      await expect(auth.login('a@test.vn', 'pw')).rejects.toThrow(
        'Failed to fetch current user',
      )
    })
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.allowedFunctions).toEqual([])
    expect(getAccessToken()).toBeNull()
  })

  it('clears local identity immediately before a slow remote logout and ignores its late failure', async () => {
    saveSession(token)
    const reply = deferred<Response>()
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(profile())
      .mockReturnValueOnce(reply.promise)
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(auth.isAuthenticated).toBe(true))
    let logout!: Promise<void>
    act(() => {
      logout = auth.logout()
    })
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.allowedFunctions).toEqual([])
    expect(getAccessToken()).toBeNull()
    reply.reject(new TypeError('offline'))
    await act(() => logout)
    expect(auth.isAuthenticated).toBe(false)
  })

  it('does not resurrect a late login when logout wins first', async () => {
    const reply = deferred<Response>()
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(reply.promise)
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    let login!: Promise<void>
    act(() => {
      login = auth.login('a@test.vn', 'pw')
    })
    const rejected = expect(login).rejects.toMatchObject({ name: 'AbortError' })
    await act(() => auth.logout())
    reply.resolve(new Response(JSON.stringify(token)))
    await act(() => rejected)
    expect(auth.isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not let account A profile replace B or let A failure clear B', async () => {
    const old = deferred<Response>()
    const other: TokenResponse = {
      ...token,
      accessToken: 'B',
      user: { ...token.user, id: '2' },
    }
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(token)))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(new Response(JSON.stringify(other)))
      .mockResolvedValueOnce(profile(other, ['sales.read']))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    let first!: Promise<void>
    act(() => {
      first = auth.login('a@test.vn', 'pw')
    })
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    await act(() => auth.login('b@test.vn', 'pw'))
    old.resolve(new Response('{}', { status: 503 }))
    await act(() => rejected)
    expect(auth.user?.id).toBe('2')
    expect(auth.allowedFunctions).toEqual(['sales.read'])
    expect(getAccessToken()).toBe('B')
  })

  it('rejects logout during login profile loading even if the old profile eventually succeeds', async () => {
    const old = deferred<Response>()
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(token)))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    let login!: Promise<void>
    act(() => {
      login = auth.login('a@test.vn', 'pw')
    })
    const rejected = expect(login).rejects.toMatchObject({ name: 'AbortError' })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    await act(() => auth.logout())
    old.resolve(profile())
    await act(() => rejected)
    expect(auth.user).toBeNull()
    expect(auth.allowedFunctions).toEqual([])
  })

  it('reloads grants authoritatively and never keeps removed permissions', async () => {
    saveSession(token)
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile(token, []))
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(auth.hasPermission('agency.read')).toBe(true))
    await act(() => auth.refreshProfile())
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.allowedFunctions).toEqual([])
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('restores once per tab in StrictMode without racing refresh lineage', async () => {
    saveSession(token)
    // A page reload loses only its in-memory access token, not tab storage.
    const stored = sessionStorage.getItem('agentra_auth_session')!
    const tabId = sessionStorage.getItem('agentra_tab_id')!
    setAccessToken(null)
    sessionStorage.setItem('agentra_auth_session', stored)
    sessionStorage.setItem('agentra_tab_id', tabId)
    const reply = deferred<Response>()
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(reply.promise)
      .mockResolvedValueOnce(profile())
    render(
      <StrictMode>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </StrictMode>,
    )
    reply.resolve(new Response(JSON.stringify(token)))
    await waitFor(() => expect(auth.isAuthenticated).toBe(true))
    expect(auth.isLoading).toBe(false)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('aborts the provider profile on unmount without logging out another mounted consumer', async () => {
    saveSession(token)
    const reply = deferred<Response>()
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(reply.promise)
    const view = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )
    view.unmount()
    expect(spy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    reply.resolve(profile())
    await Promise.resolve()
    expect(getAccessToken()).toBe('access')
    expect(screen.queryByTestId('identity')).toBeNull()
  })
})
