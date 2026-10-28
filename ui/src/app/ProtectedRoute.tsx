import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../features/authentication/useAuth'
import type { FunctionCode } from '../lib/types'
import { AccessDeniedPage } from './AccessDeniedPage'

export interface ProtectedRouteProps {
  children: ReactNode
  requiredPermission?: FunctionCode | FunctionCode[]
}

export function ProtectedRoute({
  children,
  requiredPermission,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <Spinner size="lg" label="Đang kiểm tra thông tin phiên làm việc..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDeniedPage />
  }

  return <>{children}</>
}
