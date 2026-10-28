import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EyeIcon, EyeOffIcon, LockIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { useAuth } from './useAuth'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Redirect if already authenticated
  if (isAuthenticated) {
    const returnTo = searchParams.get('returnTo') || '/'
    navigate(returnTo, { replace: true })
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email) {
      setErrorMessage('Vui lòng nhập địa chỉ email.')
      return
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.')
      return
    }

    setIsLoading(true)

    try {
      // Preserve exact password bytes - no trimming
      await login(email.trim(), password)
      const returnTo = searchParams.get('returnTo') || '/'
      navigate(returnTo, { replace: true })
    } catch (err: unknown) {
      const errorObj = err as {
        code?: string
        status?: number
        message?: string
      }
      if (errorObj.code === 'INVALID_CREDENTIALS') {
        setErrorMessage('Email hoặc mật khẩu không chính xác.')
      } else if (errorObj.code === 'ACCOUNT_LOCKED') {
        setErrorMessage('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.')
      } else if (errorObj.status === 429 || errorObj.code === 'RATE_LIMITED') {
        setErrorMessage(
          'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
        )
      } else if (errorObj.status === 0 || errorObj.code === 'NETWORK_ERROR') {
        setErrorMessage(
          'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
        )
      } else {
        setErrorMessage(
          errorObj.message || 'Đăng nhập không thành công. Vui lòng thử lại.',
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand">
            <span className="brand-wordmark">Agentra</span>
            <span className="brand-subtitle">Hệ thống Quản lý Đại lý</span>
          </div>
          <h1 className="auth-title">Đăng nhập</h1>
          <p className="auth-desc">
            Nhập thông tin tài khoản để tiếp tục làm việc
          </p>
        </div>

        {errorMessage && (
          <Alert type="error" className="auth-alert">
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <Input
            id="login-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            autoComplete="email"
            required
            autoFocus
          />

          <div className="password-field-container">
            <Input
              id="login-password"
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              endAdornment={
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <EyeOffIcon size={18} />
                  ) : (
                    <EyeIcon size={18} />
                  )}
                </button>
              }
            />
          </div>

          <div className="auth-form-meta">
            <Link to="/forgot-password" className="forgot-password-link">
              Quên mật khẩu?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="auth-submit-btn"
            isLoading={isLoading}
            icon={<LockIcon size={18} />}
          >
            Đăng nhập
          </Button>
        </form>
      </div>
    </div>
  )
}
