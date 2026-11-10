import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button as ShadcnButton } from '../../components/shadcn/button'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { apiFetch } from '../../lib/api'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setEmailError(null)

    if (!email) {
      setEmailError('Vui lòng nhập địa chỉ email.')
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
    <AuthLayout
      title="Quên mật khẩu"
      description="Nhập email tài khoản để nhận liên kết đặt lại mật khẩu"
    >
      {isSubmitted ? (
        <div className="space-y-5">
          <div className="flex justify-center" aria-hidden="true">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="size-6" />
            </span>
          </div>
          <Alert type="success" title="Đã ghi nhận yêu cầu">
            Nếu địa chỉ email tồn tại trên hệ thống, hướng dẫn đặt lại mật khẩu
            đã được gửi đến hộp thư của bạn. Vui lòng kiểm tra hộp thư đến.
          </Alert>
          <ShadcnButton asChild size="lg" className="w-full">
            <Link to="/login">Quay lại Đăng nhập</Link>
          </ShadcnButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errorMessage && <Alert type="error">{errorMessage}</Alert>}
          <Input
            id="reset-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError(null)
            }}
            placeholder="name@company.com"
            autoComplete="email"
            error={emailError ?? undefined}
            required
            autoFocus
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
            icon={<Mail className="size-4" />}
          >
            Gửi yêu cầu đặt lại
          </Button>
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Quay lại Đăng nhập
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
