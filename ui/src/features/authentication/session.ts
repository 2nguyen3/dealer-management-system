import { invalidateCache } from '../../lib/cache'
import type { CurrentUser, TokenResponse, UserResponse } from '../../lib/types'

const SESSION_STORAGE_KEY = 'agentra_auth_session'
const TAB_ID_KEY = 'agentra_tab_id'

interface StoredSession {
  refreshToken: string
  refreshExpiresAt: string
  tabId: string
  user: UserResponse
}

// In-memory access token (never persisted to storage)
let memoryAccessToken: string | null = null
let currentAuthUser: UserResponse | null = null
let inFlightRefreshPromise: Promise<TokenResponse | null> | null = null
const authChangeListeners: Array<(user: UserResponse | null) => void> = []

// Active abort controllers for authenticated reads to abort on logout/identity change
const activeAuthenticatedControllers = new Set<AbortController>()

/**
 * Initializes and validates tab ownership to prevent duplicated tabs
 * from racing on single-use refresh tokens.
 */
function getOrCreateTabId(): string {
  if (typeof window === 'undefined') return 'server'
  if (!window.name) {
    // New tab or duplicated tab: window.name is reset in duplicated tabs
    const newTabId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `tab_${Math.random().toString(36).substring(2)}_${Date.now()}`
    window.name = newTabId

    // If sessionStorage already had session data from a duplicated tab, clear it
    const existingStoredTabId = sessionStorage.getItem(TAB_ID_KEY)
    if (existingStoredTabId && existingStoredTabId !== newTabId) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
    sessionStorage.setItem(TAB_ID_KEY, newTabId)
    return newTabId
  }

  // Same tab continuing
  const currentTabId = window.name
  sessionStorage.setItem(TAB_ID_KEY, currentTabId)
  return currentTabId
}

export function registerAuthenticatedAbortController(
  controller: AbortController,
): () => void {
  activeAuthenticatedControllers.add(controller)
  return () => {
    activeAuthenticatedControllers.delete(controller)
  }
}

export function abortAllAuthenticatedRequests(): void {
  for (const controller of activeAuthenticatedControllers) {
    controller.abort()
  }
  activeAuthenticatedControllers.clear()
}

export function getAccessToken(): string | null {
  return memoryAccessToken
}

export function setAccessToken(token: string | null): void {
  memoryAccessToken = token
}

export function getCurrentUser(): UserResponse | null {
  return currentAuthUser
}

export function subscribeAuthChange(
  callback: (user: UserResponse | null) => void,
): () => void {
  authChangeListeners.push(callback)
  return () => {
    const idx = authChangeListeners.indexOf(callback)
    if (idx !== -1) authChangeListeners.splice(idx, 1)
  }
}

function notifyAuthChange(user: UserResponse | null): void {
  currentAuthUser = user
  for (const listener of authChangeListeners) {
    try {
      listener(user)
    } catch {
      // Ignore listener error
    }
  }
}

export function saveSession(tokenResponse: TokenResponse): void {
  const tabId = getOrCreateTabId()
  memoryAccessToken = tokenResponse.accessToken
  currentAuthUser = tokenResponse.user

  const sessionData: StoredSession = {
    refreshToken: tokenResponse.refreshToken,
    refreshExpiresAt: tokenResponse.refreshExpiresAt,
    tabId,
    user: tokenResponse.user,
  }

  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
  } catch {
    // Storage quota or storage disabled
  }

  notifyAuthChange(tokenResponse.user)
}

export function clearSession(): void {
  abortAllAuthenticatedRequests()
  invalidateCache()
  memoryAccessToken = null
  currentAuthUser = null

  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Storage quota or storage disabled
  }

  notifyAuthChange(null)
}

export function getStoredRefreshToken(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    const tabId = getOrCreateTabId()

    // If tabId does not match, this is a duplicated tab inheriting session
    if (parsed.tabId !== tabId) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    return parsed.refreshToken
  } catch {
    return null
  }
}

/**
 * Coordinated single-in-flight token refresh.
 */
export async function refreshSession(
  apiBaseUrl: string,
): Promise<TokenResponse | null> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise
  }

  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) {
    clearSession()
    return null
  }

  inFlightRefreshPromise = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        // Refresh token consumed, invalid or expired: clear session
        clearSession()
        return null
      }

      const data = (await response.json()) as TokenResponse
      saveSession(data)
      return data
    } catch {
      // Network error or uncertain response: clear session to prevent token reuse race
      clearSession()
      return null
    } finally {
      inFlightRefreshPromise = null
    }
  })()

  return inFlightRefreshPromise
}

/**
 * Fetches current user profile and allowed functions with Bearer token.
 */
export async function fetchCurrentUser(
  apiBaseUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<CurrentUser> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch current user (HTTP ${response.status})`)
  }

  return (await response.json()) as CurrentUser
}
