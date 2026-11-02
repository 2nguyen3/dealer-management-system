import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { MailIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { apiFetch } from '../../lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email) {
      setErrorMessage('Vui lòng nhập địa chỉ email.')
      return
    }

    setIsLoading(true)

    try {
      await apiFetch('/auth/password-reset-requests', {
        method: 'POST',
        body: { email: email.trim() },
        requiresAuth: false,
      })
      setIsSubmitted(true)
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string }
      if (errorObj.code === 'RATE_LIMITED') {
        setErrorMessage(
          'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
        )
      } else {
        // Backend returns accepted message even if user does not exist,
        // but if SMTP is unavailable or error occurs, show safe feedback
        setErrorMessage(
          errorObj.message ||
            'Không thể gửi yêu cầu đặt lại mật khẩu lúc này. Vui lòng thử lại sau.',
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
          <h1 className="auth-title">Quên mật khẩu</h1>
          <p className="auth-desc">
            Nhập email tài khoản để nhận liên kết đặt lại mật khẩu
          </p>
        </div>

        {errorMessage && (
          <Alert type="error" className="auth-alert">
            {errorMessage}
          </Alert>
        )}

        {isSubmitted ? (
          <div className="auth-success-box">
            <Alert type="success" title="Đã ghi nhận yêu cầu">
              Nếu địa chỉ email tồn tại trên hệ thống, hướng dẫn đặt lại mật
              khẩu đã được gửi đến hộp thư của bạn. Vui lòng kiểm tra hộp thư
              đến.
            </Alert>
            <div className="auth-actions-centered">
              <Link to="/login" className="btn btn--primary">
                Quay lại Đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <Input
              id="reset-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              required
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="auth-submit-btn"
              isLoading={isLoading}
              icon={<MailIcon size={18} />}
            >
              Gửi yêu cầu đặt lại
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
