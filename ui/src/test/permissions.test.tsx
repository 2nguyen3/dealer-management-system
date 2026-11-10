import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionsPage } from '../features/permissions/PermissionsPage'
import * as api from '../lib/api'

vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, refreshProfile: vi.fn() }),
}))

function list(items: unknown[]) {
  return {
    data: {
      items,
      pagination: { limit: 25, nextCursor: null, hasMore: false },
    },
    etag: null,
    status: 200,
  }
}

describe('PermissionsPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('chooses the user group by name and reads that exact grant pair', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path.startsWith('/functions'))
        return list([{ id: 1, code: 'reports.read', name: 'Xem báo cáo' }])
      if (path.startsWith('/user-groups?'))
        return list([{ id: 4, code: 'KHO', name: 'Quản lý kho' }])
      if (path === '/user-groups/4/permissions/1')
        return { data: { isAllowed: true }, etag: '"g1"', status: 200 }
      throw new Error(`unexpected ${path}`)
    })
    render(<PermissionsPage />)
    expect(screen.queryByLabelText(/ID nhóm/)).toBeNull()
    const inspect = await screen.findByRole('button', {
      name: 'Kiểm tra quyền',
    })
    expect((inspect as HTMLButtonElement).disabled).toBe(true)
    expect(inspect.getAttribute('title')).toBe(
      'Chọn nhóm người dùng trước khi kiểm tra',
    )
    const group = screen.getByRole('combobox', { name: 'Nhóm người dùng' })
    fireEvent.focus(group)
    fireEvent.click(await screen.findByText('KHO — Quản lý kho'))
    expect((group as HTMLInputElement).value).toBe('KHO — Quản lý kho')
    expect((inspect as HTMLButtonElement).disabled).toBe(false)
    expect(inspect.getAttribute('title')).toBeNull()
    fireEvent.click(inspect)
    expect(
      await screen.findByRole('heading', {
        name: 'KHO — Quản lý kho: Xem báo cáo',
      }),
    ).toBeDefined()
    expect(screen.getByText('Được phép')).toBeDefined()
    expect(fetch).toHaveBeenCalledWith('/user-groups/4/permissions/1')
    expect(screen.getByRole('button', { name: 'Thu hồi' })).toBeDefined()
  })

  it('shows an unset grant as not yet granted', async () => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path.startsWith('/functions'))
        return list([{ id: 1, code: 'reports.read', name: 'Xem báo cáo' }])
      if (path.startsWith('/user-groups?'))
        return list([{ id: 4, code: 'KHO', name: 'Quản lý kho' }])
      throw new api.ApiError(404, 'NOT_FOUND', 'Không tìm thấy')
    })
    render(<PermissionsPage />)
    const group = screen.getByRole('combobox', { name: 'Nhóm người dùng' })
    fireEvent.focus(group)
    fireEvent.click(await screen.findByText('KHO — Quản lý kho'))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Kiểm tra quyền' }),
    )
    expect(await screen.findByText('Chưa được cấp')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Cho phép' })).toBeDefined()
  })
})
