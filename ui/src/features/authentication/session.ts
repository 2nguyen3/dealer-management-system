import { invalidateCache } from '../../lib/cache'
import type {
  CurrentUser,
  FunctionCode,
  TokenResponse,
  UserResponse,
} from '../../lib/types'

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
let sessionGeneration = 0
let refreshController: AbortController | null = null
const authChangeListeners: Array<(user: UserResponse | null) => void> = []

// Active abort controllers for authenticated reads to abort on logout/identity change
const activeAuthenticatedControllers = new Set<AbortController>()

export function getSessionGeneration(): number {
  return sessionGeneration
}

const functionCodes: readonly FunctionCode[] = [
  'users.manage',
  'groups.manage',
  'permissions.manage',
  'rules.manage',
  'district.manage',
  'agency_type.manage',
  'unit.manage',
  'product.manage',
  'agency.read',
  'agency.manage',
  'inventory.read',
  'stock.receipt.prepare',
  'stock.receipt.post',
  'stock.issue.prepare',
  'stock.issue.post',
  'cash.receipt.prepare',
  'cash.receipt.post',
  'cash.upfront.verify',
  'stock.count',
  'stock.adjustment.prepare',
  'stock.adjustment.post',
  'returns.prepare',
  'returns.post',
  'cash.refund.prepare',
  'cash.refund.post',
  'credit.apply',
  'documents.correct',
  'documents.cancel',
  'sales.read',
  'debt.read',
  'reports.read',
  'audit.read',
  'payments.online',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

function isUser(value: unknown): value is UserResponse {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(value.id)
  )
    return false
  return (
    BigInt(value.id) <= 9223372036854775807n &&
    ['fullName', 'email', 'groupCode', 'groupName'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    typeof value.email === 'string' &&
    /^\S+@\S+$/.test(value.email) &&
    typeof value.groupId === 'number' &&
    Number.isInteger(value.groupId) &&
    value.groupId >= 1 &&
    value.groupId <= 2147483647 &&
    (value.status === 'ACTIVE' || value.status === 'LOCKED') &&
    isInstant(value.createdAt) &&
    isInstant(value.updatedAt)
  )
}

export function isTokenResponse(value: unknown): value is TokenResponse {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    typeof value.refreshToken === 'string' &&
    value.refreshToken.length > 0 &&
    value.tokenType === 'Bearer' &&
    isInstant(value.expiresAt) &&
    isInstant(value.refreshExpiresAt) &&
    isUser(value.user) &&
    value.user.status === 'ACTIVE'
  )
}

function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    isRecord(value) &&
    isUser(value.user) &&
    value.user.status === 'ACTIVE' &&
    Array.isArray(value.allowedFunctions) &&
    value.allowedFunctions.every(
      (code: unknown) =>
        typeof code === 'string' &&
        functionCodes.includes(code as FunctionCode),
    ) &&
    new Set(value.allowedFunctions).size === value.allowedFunctions.length
  )
}

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
  if (token !== memoryAccessToken) {
    clearSession()
  }
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
  if (!isTokenResponse(tokenResponse))
    throw new Error('Invalid session response')
  clearSession()
  applySession(tokenResponse)
}

function applySession(tokenResponse: TokenResponse): void {
  memoryAccessToken = tokenResponse.accessToken
  currentAuthUser = tokenResponse.user
  try {
    const sessionData: StoredSession = {
      refreshToken: tokenResponse.refreshToken,
      refreshExpiresAt: tokenResponse.refreshExpiresAt,
      tabId: getOrCreateTabId(),
      user: tokenResponse.user,
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
  } catch {
    // Storage quota or storage disabled
  }

  notifyAuthChange(tokenResponse.user)
}

export function clearSession(): void {
  sessionGeneration++
  refreshController?.abort()
  refreshController = null
  inFlightRefreshPromise = null
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
    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      typeof parsed.refreshToken !== 'string' ||
      !parsed.refreshToken ||
      !isInstant(parsed.refreshExpiresAt) ||
      Date.parse(parsed.refreshExpiresAt) <= Date.now()
    ) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
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

  const generation = sessionGeneration
  const expectedUserId = currentAuthUser?.id
  const controller = new AbortController()
  refreshController = controller
  inFlightRefreshPromise = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
        cache: 'no-store',
      })

      if (generation !== sessionGeneration || controller.signal.aborted)
        return null

      if (!response.ok) {
        // Refresh token consumed, invalid or expired: clear session
        clearSession()
        return null
      }

      const data: unknown = await response.json()
      if (generation !== sessionGeneration || controller.signal.aborted)
        return null
      if (
        !isTokenResponse(data) ||
        (expectedUserId && expectedUserId !== data.user.id)
      ) {
        clearSession()
        return null
      }
      applySession(data)
      return generation === sessionGeneration ? data : null
    } catch {
      // Network error or uncertain response: clear session to prevent token reuse race
      if (generation === sessionGeneration) clearSession()
      return null
    } finally {
      if (refreshController === controller) {
        refreshController = null
        inFlightRefreshPromise = null
      }
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
  const generation = sessionGeneration
  const controller = new AbortController()
  const unregister = registerAuthenticatedAbortController(controller)
  const effectiveSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal
  try {
    effectiveSignal.throwIfAborted()
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: effectiveSignal,
      cache: 'no-store',
    })

    effectiveSignal.throwIfAborted()
    if (generation !== sessionGeneration)
      throw new DOMException('Session changed', 'AbortError')

    if (!response.ok) {
      throw new Error(`Failed to fetch current user (HTTP ${response.status})`)
    }

    const data: unknown = await response.json()
    effectiveSignal.throwIfAborted()
    if (generation !== sessionGeneration)
      throw new DOMException('Session changed', 'AbortError')
    if (
      !isCurrentUser(data) ||
      (currentAuthUser && currentAuthUser.id !== data.user.id)
    ) {
      throw new Error('Invalid profile response')
    }
    return data
  } finally {
    unregister()
  }
}
