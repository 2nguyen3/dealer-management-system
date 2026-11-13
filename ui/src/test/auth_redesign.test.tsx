import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../features/authentication/AuthContext'
import { ChangePasswordModal } from '../features/authentication/ChangePasswordModal'
import { ForgotPasswordPage } from '../features/authentication/ForgotPasswordPage'
import { LoginPage } from '../features/authentication/LoginPage'
import { PasswordToggle } from '../features/authentication/PasswordToggle'
import { ResetPasswordPage } from '../features/authentication/ResetPasswordPage'
import { clearSession } from '../features/authentication/session'

function renderLogin() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>,
  )
}

describe('Authentication redesign', () => {
  beforeEach(() => {
    clearSession()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('PasswordToggle names its action and reports the controlled field', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <PasswordToggle visible={false} onToggle={onToggle} controls="pw" />,
    )
    const button = screen.getByRole('button', { name: 'Hiện mật khẩu' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('aria-controls')).toBe('pw')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
    rerender(<PasswordToggle visible onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBeTruthy()
  })

  it('login shows an introduction panel without feature lists and a titled form card', () => {
    renderLogin()
    const intro = screen.getByRole('complementary', {
      name: 'Giới thiệu Agentra',
    })
    expect(intro.querySelectorAll('li')).toHaveLength(0)
    // Theme tokens (light/dark + palette-tinted shadow) travel in the query.
    expect(intro.querySelector('iframe')?.getAttribute('src')).toMatch(
      /^\/figures\/supplychain\.html\?theme=light&shadow=%23[0-9a-f]{6}$/,
    )
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Quên mật khẩu?' })).toBeTruthy()
  })

  it('login reports a missing email inline on the field', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/ }))
    const message = await screen.findByText('Vui lòng nhập địa chỉ email.')
    const email = screen.getByLabelText(/Email/, { selector: 'input' })
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(email.getAttribute('aria-describedby')).toBe(message.id)
    fireEvent.change(email, { target: { value: 'a@b.vn' } })
    expect(screen.queryByText('Vui lòng nhập địa chỉ email.')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('login reports a missing password inline after the email', async () => {
    renderLogin()
    fireEvent.change(screen.getByLabelText(/Email/, { selector: 'input' }), {
      target: { value: 'a@b.vn' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/ }))
    await screen.findByText('Vui lòng nhập mật khẩu.')
    const password = screen.getByLabelText(/Mật khẩu/, { selector: 'input' })
    expect(password.getAttribute('aria-invalid')).toBe('true')
  })

  it('login shows a loading state while signing in', async () => {
    let resolve: (value: Response) => void = () => {}
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done
      }),
    )
    renderLogin()
    fireEvent.change(screen.getByLabelText(/Email/, { selector: 'input' }), {
      target: { value: 'a@b.vn' },
    })
    fireEvent.change(screen.getByLabelText(/Mật khẩu/, { selector: 'input' }), {
      target: { value: 'secret' },
    })
    const submit = screen.getByRole('button', { name: /^Đăng nhập$/ })
    fireEvent.click(submit)
    await waitFor(() => expect(submit.getAttribute('aria-busy')).toBe('true'))
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    resolve(
      new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(
      await screen.findByText('Email hoặc mật khẩu không chính xác.'),
    ).toBeTruthy()
    expect(submit.getAttribute('aria-busy')).toBeNull()
  })

  it('forgot password validates the email inline without a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu đặt lại/ }))
    expect(await screen.findByText('Vui lòng nhập địa chỉ email.')).toBeTruthy()
    expect(screen.getByLabelText(/Email/).getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(
      screen.getByRole('link', { name: /Quay lại Đăng nhập/ }),
    ).toBeTruthy()
  })

  it('reset password toggles both fields and flags a mismatch on confirm', async () => {
    window.location.hash = '#token=abc'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>,
    )
    const next = screen.getByLabelText(/^Mật khẩu mới/, {
      selector: 'input',
    }) as HTMLInputElement
    const confirm = screen.getByLabelText(/^Xác nhận mật khẩu mới/, {
      selector: 'input',
    }) as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(next.type).toBe('text')
    expect(confirm.type).toBe('text')
    fireEvent.change(next, { target: { value: 'NewPass1!' } })
    fireEvent.change(confirm, { target: { value: 'Other' } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật mật khẩu/ }))
    expect(
      await screen.findByText('Xác nhận mật khẩu mới không khớp.'),
    ).toBeTruthy()
    expect(confirm.getAttribute('aria-invalid')).toBe('true')
    expect(next.getAttribute('aria-invalid')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reset password without a token disables submit and explains why', () => {
    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>,
    )
    expect(
      screen.getByText(
        'Không tìm thấy mã đặt lại mật khẩu hoặc liên kết đã hết hiệu lực.',
      ),
    ).toBeTruthy()
    const submit = screen.getByRole('button', { name: /Cập nhật mật khẩu/ })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })

  it('change password modal toggles current and new fields independently', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ChangePasswordModal isOpen onClose={vi.fn()} />
        </AuthProvider>
      </BrowserRouter>,
    )
    const current = screen.getByLabelText(/Mật khẩu hiện tại/, {
      selector: 'input',
    }) as HTMLInputElement
    const next = screen.getByLabelText(/^Mật khẩu mới/, {
      selector: 'input',
    }) as HTMLInputElement
    const toggles = screen.getAllByRole('button', { name: 'Hiện mật khẩu' })
    expect(toggles).toHaveLength(2)
    fireEvent.click(toggles[0]!)
    expect(current.type).toBe('text')
    expect(next.type).toBe('password')
  })
})
