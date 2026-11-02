import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { API_BASE_URL } from '../../lib/api'
import { invalidateCache, prefetchMasterData } from '../../lib/cache'
import type { FunctionCode, TokenResponse, UserResponse } from '../../lib/types'
import {
  clearSession,
  fetchCurrentUser,
  getAccessToken,
  getStoredRefreshToken,
  refreshSession,
  saveSession,
  subscribeAuthChange,
} from './session'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [allowedFunctions, setAllowedFunctions] = useState<FunctionCode[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const loadProfile = useCallback(async (token: string) => {
    try {
      const current = await fetchCurrentUser(API_BASE_URL, token)
      setUser(current.user)
      setAllowedFunctions(current.allowedFunctions)
      // Warm up cache for core business operations in background
      prefetchMasterData()
    } catch {
      // Failed to get profile: invalidate session
      clearSession()
      setUser(null)
      setAllowedFunctions([])
    }
  }, [])

  // Restore session on mount (same-tab restoration)
  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      const storedToken = getStoredRefreshToken()
      if (!storedToken) {
        if (isMounted) setIsLoading(false)
        return
      }

      try {
        const refreshed = await refreshSession(API_BASE_URL)
        if (refreshed?.accessToken && isMounted) {
          await loadProfile(refreshed.accessToken)
        }
      } catch {
        if (isMounted) {
          clearSession()
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void initAuth()

    const unsubscribe = subscribeAuthChange((changedUser) => {
      if (!changedUser) {
        setUser(null)
        setAllowedFunctions([])
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [loadProfile])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        let errJson: { code?: string; message?: string } | null = null
        try {
          errJson = (await response.json()) as {
            code?: string
            message?: string
          }
        } catch {
          // not json
        }
        const err = new Error(errJson?.message || 'Đăng nhập thất bại')
        ;(err as unknown as { code?: string; status?: number }).code =
          errJson?.code
        ;(err as unknown as { code?: string; status?: number }).status =
          response.status
        throw err
      }

      const tokenData = (await response.json()) as TokenResponse
      saveSession(tokenData)
      await loadProfile(tokenData.accessToken)
    },
    [loadProfile],
  )

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken()
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        })
      } catch {
        // Ignore transport errors on logout
      }
    }
    clearSession()
    invalidateCache()
    setUser(null)
    setAllowedFunctions([])
  }, [])

  const refreshProfile = useCallback(async () => {
    const token = getAccessToken()
    if (token) {
      await loadProfile(token)
    }
  }, [loadProfile])

  const hasPermission = useCallback(
    (permission: FunctionCode | FunctionCode[]): boolean => {
      if (Array.isArray(permission)) {
        return permission.some((p) => allowedFunctions.includes(p))
      }
      return allowedFunctions.includes(permission)
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
