import { createContext, useContext } from 'react'
import type { FunctionCode, UserResponse } from '../../lib/types'

export interface AuthContextValue {
  user: UserResponse | null
  allowedFunctions: FunctionCode[]
  isAuthenticated: boolean
  isLoading: boolean
  hasPermission: (permission: FunctionCode | FunctionCode[]) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
