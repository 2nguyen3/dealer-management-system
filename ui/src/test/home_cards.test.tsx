import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../features/home/HomePage'

const access = vi.hoisted(() => ({ granted: [] as string[] }))
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({
    user: null,
    hasPermission: (code: string) => access.granted.includes(code),
  }),
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage quick-action cards', () => {
  beforeEach(() => {
    access.granted = []
  })

  it('groups permitted modules into described cards across all work areas', () => {
    access.granted = ['users.manage', 'audit.read', 'agency.read']
    renderHome()
    expect(screen.getByText('Người dùng')).toBeTruthy()
    const users = screen.getByRole('link', { name: /Tài khoản người dùng/ })
    expect(users.getAttribute('href')).toBe('/users')
    expect(users.textContent).toContain('Tài khoản, nhóm và trạng thái')
    expect(
      screen.getByRole('heading', { name: 'Quản trị & Lịch sử' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Danh mục & Quy định' }),
    ).toBeTruthy()
    const directory = screen
      .getByRole('heading', { name: 'Nghiệp vụ' })
      .closest('section')!
    const paths = within(directory)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(paths).toContain('/agencies')
    expect(paths).toContain('/audit-logs')
    expect(paths).not.toContain('/permissions')
    expect(paths).not.toContain('/chatbot')
    expect(paths).not.toContain('/document-history')
  })

  it('offers both quick shortcuts when dashboard and reports are allowed', () => {
    access.granted = ['reports.read', 'sales.read']
    renderHome()
    const shortcuts = screen.getByRole('navigation', {
      name: 'Truy cập nhanh',
    })
    expect(
      within(shortcuts)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/dashboard', '/reports'])
  })
})
