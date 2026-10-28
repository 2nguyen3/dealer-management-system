import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EyeIcon, EyeOffIcon, LockIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { apiFetch } from '../../lib/api'

export function ResetPasswordPage() {
  const [token] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    let extracted: string | null = null
    const hash = window.location.hash
    if (hash) {
      const match = hash.match(/[#&]token=([^&]+)/)
      if (match?.[1]) {
        extracted = decodeURIComponent(match[1])
      }
    }
    if (!extracted) {
      const params = new URLSearchParams(window.location.search)
      extracted = params.get('token')
    }
    return extracted
  })

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const hash = window.location.hash
    let extracted: string | null = null
    if (hash) {
      const match = hash.match(/[#&]token=([^&]+)/)
      if (match?.[1]) extracted = decodeURIComponent(match[1])
    }
    if (!extracted) {
      const params = new URLSearchParams(window.location.search)
      extracted = params.get('token')
    }
    return extracted
      ? null
      : 'Không tìm thấy mã đặt lại mật khẩu hoặc liên kết đã hết hiệu lực.'
  })

  useEffect(() => {
    // Immediately clear token from URL history to avoid leaking it
    if (window.location.hash || window.location.search.includes('token=')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!token) {
      setErrorMessage('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.')
      return
    }

    if (!newPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu mới.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Xác nhận mật khẩu mới không khớp.')
      return
    }

    setIsLoading(true)

    try {
      // Preserve untouched newPassword bytes
      await apiFetch('/auth/password-resets', {
        method: 'POST',
        body: { token, newPassword },
        requiresAuth: false,
      })
      setIsSuccess(true)
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string }
      if (
        errorObj.code === 'INVALID_TOKEN' ||
        errorObj.code === 'EXPIRED_TOKEN'
      ) {
        setErrorMessage('Mã đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.')
      } else {
        setErrorMessage(
          errorObj.message ||
            'Không thể đặt lại mật khẩu. Vui lòng thử lại hoặc yêu cầu liên kết mới.',
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
          <h1 className="auth-title">Đặt lại mật khẩu</h1>
          <p className="auth-desc">Tạo mật khẩu mới cho tài khoản của bạn</p>
        </div>

        {errorMessage && (
          <Alert type="error" className="auth-alert">
            {errorMessage}
          </Alert>
        )}

        {isSuccess ? (
          <div className="auth-success-box">
            <Alert type="success" title="Đặt lại mật khẩu thành công">
              Mật khẩu mới của bạn đã được cập nhật thành công. Vui lòng đăng
              nhập bằng mật khẩu mới.
            </Alert>
            <div className="auth-actions-centered">
              <Link to="/login" className="btn btn--primary">
                Đăng nhập ngay
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="password-field-container">
              <Input
                id="new-password"
                label="Mật khẩu mới"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                autoFocus
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

            <Input
              id="confirm-password"
              label="Xác nhận mật khẩu mới"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="auth-submit-btn"
              isLoading={isLoading}
              disabled={!token}
              icon={<LockIcon size={18} />}
            >
              Cập nhật mật khẩu
            </Button>

            <div className="auth-footer-link">
              <Link to="/login" className="back-link">
                ← Quay lại Đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
