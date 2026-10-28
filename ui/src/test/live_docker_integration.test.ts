import { describe, expect, it } from 'vitest'

const LIVE_API_BASE = 'http://localhost:8080/api/v1'

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
        email: 'quanly@agentra.demo',
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
        email: 'locked@agentra.demo',
        password: 'AgentraDemo!2026#LOCK',
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
        email: 'quanly@agentra.demo',
        password: 'AgentraDemo!2026#QL',
      }),
    })
    expect(loginRes.status).toBe(200)
    const tokens = (await loginRes.json()) as {
      accessToken: string
      refreshToken: string
      user: { fullName: string; email: string; groupCode: string }
    }
    expect(tokens.accessToken).toBeTruthy()
    expect(tokens.user.email).toBe('quanly@agentra.demo')
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
    const [
      agenciesRes,
      productsRes,
      districtsRes,
      rulesRes,
      usersRes,
      receiptsRes,
      issuesRes,
      paymentReceiptsRes,
      receivablesRes,
      adjustmentsRes,
      countsRes,
      returnsRes,
      creditLotsRes,
      upfrontRes,
    ] = await Promise.all([
      fetch(`${LIVE_API_BASE}/agencies?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/products?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/districts`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/business-rules`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/users?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/stock-receipts?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/stock-issues?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/payment-receipts?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/receivables?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/stock-adjustments?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/stock-counts?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/sales-returns?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/agencies/70/credit-lots`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
      fetch(`${LIVE_API_BASE}/upfront-confirmations?limit=5`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
    ])

    expect(agenciesRes.status).toBe(200)
    expect(productsRes.status).toBe(200)
    expect(districtsRes.status).toBe(200)
    expect(rulesRes.status).toBe(200)
    expect(usersRes.status).toBe(200)
    expect(receiptsRes.status).toBe(200)
    expect(issuesRes.status).toBe(200)
    expect(paymentReceiptsRes.status).toBe(200)
    expect(receivablesRes.status).toBe(200)
    expect(adjustmentsRes.status).toBe(200)
    expect(countsRes.status).toBe(200)
    expect(returnsRes.status).toBe(200)
    expect(creditLotsRes.status).toBe(200)
    expect(upfrontRes.status).toBe(200)

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
