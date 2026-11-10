import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { apiFetch } from '../../lib/api'
import { PasswordToggle } from './PasswordToggle'
import { useAuth } from './useAuth'

export interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const { logout } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleReset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setErrorMessage(null)
    setIsSuccess(false)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!currentPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại.')
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
      // Preserve untouched password bytes
      await apiFetch('/auth/password', {
        method: 'PUT',
        body: { currentPassword, newPassword },
      })

      setIsSuccess(true)
      setTimeout(async () => {
        await logout()
      }, 1500)
    } catch (err: unknown) {
      const errorObj = err as {
        code?: string
        status?: number
        message?: string
      }
      if (errorObj.status === 401 || errorObj.code === 'INVALID_CREDENTIALS') {
        setErrorMessage('Mật khẩu hiện tại không chính xác.')
      } else {
        setErrorMessage(
          errorObj.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.',
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Đổi mật khẩu tài khoản"
      maxWidth="sm"
    >
      {isSuccess ? (
        <Alert type="success" title="Đổi mật khẩu thành công">
          Mật khẩu của bạn đã được cập nhật. Bạn sẽ được chuyển về màn hình đăng
          nhập...
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errorMessage && <Alert type="error">{errorMessage}</Alert>}

          <Input
            id="current-password"
            label="Mật khẩu hiện tại"
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
            endAdornment={
              <PasswordToggle
                visible={showCurrent}
                onToggle={() => setShowCurrent((p) => !p)}
              />
            }
          />

          <Input
            id="new-pwd"
            label="Mật khẩu mới"
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            endAdornment={
              <PasswordToggle
                visible={showNew}
                onToggle={() => setShowNew((p) => !p)}
              />
            }
          />

          <Input
            id="confirm-new-pwd"
            label="Xác nhận mật khẩu mới"
            type={showNew ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Cập nhật
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
