import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../features/authentication/AuthContext'
import { ChangePasswordModal } from '../features/authentication/ChangePasswordModal'
import { ForgotPasswordPage } from '../features/authentication/ForgotPasswordPage'
import { LoginPage } from '../features/authentication/LoginPage'
import { ResetPasswordPage } from '../features/authentication/ResetPasswordPage'
import { clearSession } from '../features/authentication/session'

describe('Authentication Components', () => {
  beforeEach(() => {
    clearSession()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  describe('LoginPage', () => {
    it('renders clean, app-focused Vietnamese UI with branding and controls', () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>,
      )

      expect(screen.getByText('Agentra')).toBeDefined()
      expect(screen.getByText('Hệ thống Quản lý Đại lý')).toBeDefined()
      expect(
        screen.getByLabelText(/Email/i, { selector: 'input' }),
      ).toBeDefined()
      expect(
        screen.getByLabelText(/Mật khẩu/i, { selector: 'input' }),
      ).toBeDefined()
      expect(screen.getByRole('button', { name: /^Đăng nhập$/i })).toBeDefined()
      expect(
        screen.getByRole('button', { name: /Hiện mật khẩu/i }),
      ).toBeDefined()
      expect(screen.getByText('Quên mật khẩu?')).toBeDefined()

      // Explicit verification requirement: NO AI commentary or dev status in UI
      const bodyText = document.body.textContent || ''
      expect(bodyText).not.toContain('AI generated')
      expect(bodyText).not.toContain('verification')
      expect(bodyText).not.toContain('F01')
      expect(bodyText).not.toContain('M01')
      expect(bodyText).not.toContain('API is online')
      expect(bodyText).not.toContain('FastAPI')
    })

    it('toggles password visibility with accessible label', () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>,
      )

      const passwordInput = screen.getByLabelText(/Mật khẩu/i, {
        selector: 'input',
      }) as HTMLInputElement
      expect(passwordInput.type).toBe('password')

      const toggleBtn = screen.getByRole('button', { name: /Hiện mật khẩu/i })
      fireEvent.click(toggleBtn)

      expect(passwordInput.type).toBe('text')
      expect(screen.getByRole('button', { name: /Ẩn mật khẩu/i })).toBeDefined()
    })

    it('validates empty inputs without making network call', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>,
      )

      fireEvent.click(screen.getByRole('button', { name: /Đăng nhập/i }))

      expect(
        await screen.findByText('Vui lòng nhập địa chỉ email.'),
      ).toBeDefined()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('displays Vietnamese error message for invalid credentials', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>,
      )

      fireEvent.change(screen.getByLabelText(/Email/i, { selector: 'input' }), {
        target: { value: 'user@test.com' },
      })
      fireEvent.change(
        screen.getByLabelText(/Mật khẩu/i, { selector: 'input' }),
        {
          target: { value: 'WrongPass!' },
        },
      )
      fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }))

      expect(
        await screen.findByText('Email hoặc mật khẩu không chính xác.'),
      ).toBeDefined()
    })

    it('displays Vietnamese error message for locked account', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'ACCOUNT_LOCKED',
            message: 'Account is locked',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      render(
        <BrowserRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </BrowserRouter>,
      )

      fireEvent.change(screen.getByLabelText(/Email/i, { selector: 'input' }), {
        target: { value: 'locked@agentra.demo' },
      })
      fireEvent.change(
        screen.getByLabelText(/Mật khẩu/i, { selector: 'input' }),
        {
          target: { value: 'Pass123' },
        },
      )
      fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }))

      expect(
        await screen.findByText(
          'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
        ),
      ).toBeDefined()
    })
  })

  describe('ForgotPasswordPage', () => {
    it('submits email and displays accepted message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Accepted', requestId: 'req-123' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      render(
        <BrowserRouter>
          <ForgotPasswordPage />
        </BrowserRouter>,
      )

      fireEvent.change(screen.getByLabelText(/Email/i), {
        target: { value: 'test@example.com' },
      })
      fireEvent.click(
        screen.getByRole('button', { name: /Gửi yêu cầu đặt lại/i }),
      )

      expect(await screen.findByText(/Đã ghi nhận yêu cầu/i)).toBeDefined()
    })
  })

  describe('ResetPasswordPage', () => {
    it('extracts token from fragment and removes fragment from history', async () => {
      window.location.hash = '#token=test-reset-token-xyz'

      render(
        <BrowserRouter>
          <ResetPasswordPage />
        </BrowserRouter>,
      )

      // Fragment should be cleared from URL immediately
      await waitFor(() => {
        expect(window.location.hash).toBe('')
      })

      expect(
        screen.getByLabelText(/^Mật khẩu mới/i, { selector: 'input' }),
      ).toBeDefined()
      expect(
        screen.getByLabelText(/^Xác nhận mật khẩu mới/i, { selector: 'input' }),
      ).toBeDefined()
    })
  })

  describe('ChangePasswordModal', () => {
    it('renders change password modal when open and handles cancel', () => {
      const handleClose = vi.fn()

      render(
        <BrowserRouter>
          <AuthProvider>
            <ChangePasswordModal isOpen={true} onClose={handleClose} />
          </AuthProvider>
        </BrowserRouter>,
      )

      expect(screen.getByText('Đổi mật khẩu tài khoản')).toBeDefined()
      expect(screen.getByLabelText(/Mật khẩu hiện tại/i)).toBeDefined()

      fireEvent.click(screen.getByRole('button', { name: /Hủy/i }))
      expect(handleClose).toHaveBeenCalled()
    })
  })
})
