import { LogIn, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { AuthLayout } from './AuthLayout'
import { PasswordToggle } from './PasswordToggle'
import { useAuth } from './useAuth'
import { t } from '@/lib/i18n/core'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<{
    field: 'email' | 'password'
    message: string
  } | null>(null)
  const requestedReturn = searchParams.get('returnTo') || '/'
  const returnTo =
    requestedReturn.startsWith('/') &&
    !requestedReturn.startsWith('//') &&
    !requestedReturn.includes('\\') &&
    !Array.from(requestedReturn).some((c) => c.charCodeAt(0) < 32)
      ? requestedReturn
      : '/'

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    setErrorMessage(null)
    setFieldError(null)

    if (!email) {
      setFieldError({
        field: 'email',
        message: t('Vui lòng nhập địa chỉ email.'),
      })
      return
    }

    if (!password) {
      setFieldError({
        field: 'password',
        message: t('Vui lòng nhập mật khẩu.'),
      })
      return
    }

    setIsLoading(true)

    try {
      // Preserve exact password bytes - no trimming
      await login(email.trim(), password)
      navigate(returnTo, { replace: true })
    } catch (err: unknown) {
      const errorObj = err as {
        code?: string
        status?: number
        message?: string
      }
      if (errorObj.code === 'INVALID_CREDENTIALS') {
        setErrorMessage(t('Email hoặc mật khẩu không chính xác.'))
      } else if (errorObj.code === 'ACCOUNT_LOCKED') {
        setErrorMessage(
          t('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.'),
        )
      } else if (errorObj.status === 429 || errorObj.code === 'RATE_LIMITED') {
        setErrorMessage(
          t('Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.'),
        )
      } else if (errorObj.status === 0 || errorObj.code === 'NETWORK_ERROR') {
        setErrorMessage(
          t('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.'),
        )
      } else {
        setErrorMessage(
          errorObj.message ||
            t('Đăng nhập không thành công. Vui lòng thử lại.'),
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('Đăng nhập')}
      description={t('Dùng tài khoản được cấp để tiếp tục.')}
      icon={<ShieldCheck />}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errorMessage && <Alert type="error">{errorMessage}</Alert>}
        <Input
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (fieldError?.field === 'email') setFieldError(null)
          }}
          placeholder="ban@congty.vn"
          autoComplete="email"
          error={fieldError?.field === 'email' ? fieldError.message : undefined}
          required
          autoFocus
        />
        <Input
          id="login-password"
          label={t('Mật khẩu')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (fieldError?.field === 'password') setFieldError(null)
          }}
          placeholder="••••••••"
          autoComplete="current-password"
          error={
            fieldError?.field === 'password' ? fieldError.message : undefined
          }
          required
          endAdornment={
            <PasswordToggle
              visible={showPassword}
              controls="login-password"
              onToggle={() => setShowPassword((prev) => !prev)}
            />
          }
        />
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t('Quên mật khẩu?')}
          </Link>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          icon={<LogIn className="size-4" />}
        >
          {t('Đăng nhập')}
        </Button>
      </form>
    </AuthLayout>
  )
}
