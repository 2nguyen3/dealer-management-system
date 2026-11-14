import { describe, expect, it } from 'vitest'

// Excluded from `npm test`; run explicitly against a disposable stack:
// VITE_LIVE_API_BASE=http://127.0.0.1:8081/api/v1 npx vitest run src/test/live_docker_integration.test.ts
const LIVE_API_BASE =
  (import.meta.env.VITE_LIVE_API_BASE as string | undefined) ??
  'http://localhost:8080/api/v1'

describe('Live Docker Integration Tests (proxied through Nginx on 8080)', () => {
  it('connects to health endpoints through running Docker Nginx proxy', async () => {
    const res = await fetch(`${LIVE_API_BASE}/health`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('rejects invalid credentials with 401 INVALID_CREDENTIALS', async () => {
    const res = await fetch(`${LIVE_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'thaonguyen@agentra.vn',
        password: 'WrongPassword123!',
      }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects locked account with 403 ACCOUNT_LOCKED', async () => {
    const res = await fetch(`${LIVE_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'vanluc@agentra.vn',
        password: 'Agentra@2026#KinhDoanh4',
      }),
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('ACCOUNT_LOCKED')
  })

  it('authenticates demo manager, queries profile and allowedFunctions, refreshes token, queries business data, and logs out', async () => {
    // 1. Login
    const loginRes = await fetch(`${LIVE_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'thaonguyen@agentra.vn',
        password: 'Agentra@2026#QuanLy1',
      }),
    })
    expect(loginRes.status).toBe(200)
    const tokens = (await loginRes.json()) as {
      accessToken: string
      refreshToken: string
      user: { fullName: string; email: string; groupCode: string }
    }
    expect(tokens.accessToken).toBeTruthy()
    expect(tokens.user.email).toBe('thaonguyen@agentra.vn')
    expect(tokens.user.groupCode).toBe('MANAGEMENT')

    // 2. Query /auth/me with Bearer token
    const meRes = await fetch(`${LIVE_API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'application/json',
      },
    })
    expect(meRes.status).toBe(200)
    const meBody = (await meRes.json()) as {
      user: { fullName: string }
      allowedFunctions: string[]
    }
    expect(meBody.user.fullName).toBe(tokens.user.fullName)
    expect(meBody.allowedFunctions).toContain('agency.read')
    expect(meBody.allowedFunctions).toContain('users.manage')

    // 3. Query business APIs with Bearer token through proxy
    const paths = [
      '/agencies?limit=5',
      '/products?limit=5',
      '/wards?limit=5',
      '/business-rules',
      '/users?limit=5',
      '/stock-receipts?limit=5',
      '/stock-issues?limit=5',
      '/payment-receipts?limit=5',
      '/online-payments?limit=5',
      '/documents?limit=5',
      '/reports/debt',
      '/dashboard',
    ]
    const responses = await Promise.all(
      paths.map((path) =>
        fetch(`${LIVE_API_BASE}${path}`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
      ),
    )
    expect(responses.map((res) => res.status)).toEqual(paths.map(() => 200))

    // 4. Test Single-use Refresh
    const refreshRes = await fetch(`${LIVE_API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
    expect(refreshRes.status).toBe(200)
    const newTokens = (await refreshRes.json()) as {
      accessToken: string
      refreshToken: string
    }
    expect(newTokens.accessToken).toBeTruthy()
    expect(newTokens.refreshToken).toBeTruthy()

    // 5. Test Logout (returns 204 No Content)
    const logoutRes = await fetch(`${LIVE_API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: newTokens.refreshToken }),
    })
    expect(logoutRes.status).toBe(204)
  }, 30_000)
})
