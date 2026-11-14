import { ArrowLeft, CircleCheck, Lock, LockKeyhole, LogIn } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button as ShadcnButton } from '../../components/shadcn/button'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { apiFetch } from '../../lib/api'
import { AuthLayout } from './AuthLayout'
import { PasswordToggle } from './PasswordToggle'
import { t } from '@/lib/i18n/core'

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
      : t('Không tìm thấy mã đặt lại mật khẩu hoặc liên kết đã hết hiệu lực.')
  })

  const [fieldError, setFieldError] = useState<{
    field: 'new' | 'confirm'
    message: string
  } | null>(null)

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
      setErrorMessage(t('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'))
      return
    }

    setFieldError(null)
    if (!newPassword) {
      setFieldError({ field: 'new', message: t('Vui lòng nhập mật khẩu mới.') })
      return
    }

    if (newPassword !== confirmPassword) {
      setFieldError({
        field: 'confirm',
        message: t('Xác nhận mật khẩu mới không khớp.'),
      })
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
        setErrorMessage(
          t('Mã đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.'),
        )
      } else {
        setErrorMessage(
          errorObj.message ||
            t(
              'Không thể đặt lại mật khẩu. Vui lòng thử lại hoặc yêu cầu liên kết mới.',
            ),
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('Đặt lại mật khẩu')}
      description={t('Tạo mật khẩu mới cho tài khoản của bạn')}
      icon={<LockKeyhole />}
    >
      {isSuccess ? (
        <div className="space-y-5">
          <div className="flex justify-center" aria-hidden="true">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CircleCheck className="size-6" />
            </span>
          </div>
          <Alert type="success" title={t('Đặt lại mật khẩu thành công')}>
            {t(
              'Mật khẩu mới của bạn đã được cập nhật thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
            )}
          </Alert>
          <ShadcnButton asChild size="lg" className="w-full">
            <Link to="/login">
              <LogIn aria-hidden="true" />
              {t('Đăng nhập ngay')}
            </Link>
          </ShadcnButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errorMessage && <Alert type="error">{errorMessage}</Alert>}
          <Input
            id="new-password"
            label={t('Mật khẩu mới')}
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setFieldError(null)
            }}
            placeholder="••••••••"
            autoComplete="new-password"
            error={fieldError?.field === 'new' ? fieldError.message : undefined}
            required
            autoFocus
            endAdornment={
              <PasswordToggle
                visible={showPassword}
                controls="new-password"
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            }
          />
          <Input
            id="confirm-password"
            label={t('Xác nhận mật khẩu mới')}
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setFieldError(null)
            }}
            placeholder="••••••••"
            autoComplete="new-password"
            error={
              fieldError?.field === 'confirm' ? fieldError.message : undefined
            }
            required
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
            disabled={!token}
            icon={<Lock className="size-4" />}
          >
            {t('Cập nhật mật khẩu')}
          </Button>
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('Quay lại Đăng nhập')}
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
