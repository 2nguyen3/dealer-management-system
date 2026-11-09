import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { API_BASE_URL, apiFetch } from '../../lib/api'
import type { FunctionCode, TokenResponse, UserResponse } from '../../lib/types'
import {
  clearSession,
  fetchCurrentUser,
  getAccessToken,
  getSessionGeneration,
  getStoredRefreshToken,
  isTokenResponse,
  refreshSession,
  saveSession,
  subscribeAuthChange,
} from './session'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [allowedFunctions, setAllowedFunctions] = useState<FunctionCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const mounted = useRef(false)
  const profileController = useRef<AbortController | null>(null)
  const profilePromise = useRef<Promise<void>>(Promise.resolve())
  const loginAttempt = useRef(0)

  const loadProfile = useCallback(async (token: string) => {
    profileController.current?.abort()
    const controller = new AbortController()
    profileController.current = controller
    const generation = getSessionGeneration()
    setAllowedFunctions([])
    try {
      const current = await fetchCurrentUser(
        API_BASE_URL,
        token,
        controller.signal,
      )
      if (
        !mounted.current ||
        controller.signal.aborted ||
        generation !== getSessionGeneration()
      )
        return
      setUser(current.user)
      setAllowedFunctions(current.allowedFunctions)
    } catch (error) {
      if (
        !mounted.current ||
        controller.signal.aborted ||
        generation !== getSessionGeneration()
      )
        return
      clearSession()
      throw error
    } finally {
      if (mounted.current && profileController.current === controller)
        setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    mounted.current = true
    const unsubscribe = subscribeAuthChange((changedUser) => {
      profileController.current?.abort()
      setUser(null)
      setAllowedFunctions([])
      if (changedUser && getAccessToken()) {
        setIsLoading(true)
        const promise = loadProfile(getAccessToken()!)
        profilePromise.current = promise
        void promise.catch(() => {})
      } else {
        setIsLoading(false)
      }
    })
    const initAuth = async () => {
      if (getAccessToken()) {
        profilePromise.current = loadProfile(getAccessToken()!)
        await profilePromise.current
      } else if (getStoredRefreshToken()) {
        await refreshSession(API_BASE_URL)
        await profilePromise.current
      } else {
        clearSession()
      }
      if (active && mounted.current) setIsLoading(false)
    }
    void initAuth().catch(() => {})
    const attemptRef = loginAttempt
    return () => {
      mounted.current = false
      active = false
      attemptRef.current++
      profileController.current?.abort()
      unsubscribe()
    }
  }, [loadProfile])

  const login = useCallback(async (email: string, password: string) => {
    const attempt = ++loginAttempt.current
    clearSession()
    const generation = getSessionGeneration()
    const response = await apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      requiresAuth: false,
      validate: isTokenResponse,
    })
    if (
      !mounted.current ||
      attempt !== loginAttempt.current ||
      generation !== getSessionGeneration()
    ) {
      throw new DOMException('Session changed', 'AbortError')
    }
    saveSession(response.data)
    const savedGeneration = getSessionGeneration()
    await profilePromise.current
    if (
      !mounted.current ||
      attempt !== loginAttempt.current ||
      savedGeneration !== getSessionGeneration()
    ) {
      throw new DOMException('Session changed', 'AbortError')
    }
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken()
    loginAttempt.current++
    // Local revocation is immediate, regardless of a slow/failed server logout.
    clearSession()
    if (refreshToken) {
      try {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
          requiresAuth: false,
        })
      } catch {
        // A failed remote revocation never restores local credentials.
      }
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const token = getAccessToken()
    if (token) await loadProfile(token)
  }, [loadProfile])

  const hasPermission = useCallback(
    (permission: FunctionCode | FunctionCode[]): boolean => {
      return Array.isArray(permission)
        ? permission.some((code) => allowedFunctions.includes(code))
        : allowedFunctions.includes(permission)
    },
    [allowedFunctions],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        allowedFunctions,
        isAuthenticated: !!user && !!getAccessToken(),
        isLoading,
        hasPermission,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
