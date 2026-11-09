import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../features/home/HomePage'

const access = vi.hoisted(() => ({ granted: [] as string[] }))
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({
    user: { fullName: 'Thủ kho' },
    hasPermission: (code: string) => access.granted.includes(code),
  }),
}))

describe('HomePage', () => {
  beforeEach(() => {
    access.granted = []
  })

  it('shows a task directory with only permitted work links', () => {
    access.granted = ['inventory.read']
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Bàn làm việc' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Nghiệp vụ' })).toBeDefined()
    expect(
      screen.getByRole('link', { name: /Danh mục mặt hàng/ }),
    ).toBeDefined()
    expect(screen.queryByRole('link', { name: /Phiếu thu tiền/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Xem tổng quan/ })).toBeDefined()
    expect(screen.queryByRole('link', { name: /Mở báo cáo/ })).toBeNull()
  })

  it('explains an empty permission set without fake operational data', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Chưa có khu vực nghiệp vụ được cấp quyền',
      }),
    ).toBeDefined()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
