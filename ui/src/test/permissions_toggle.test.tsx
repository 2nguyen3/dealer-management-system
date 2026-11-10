import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionsPage } from '../features/permissions/PermissionsPage'
import * as api from '../lib/api'

const refreshProfile = vi.hoisted(() => vi.fn())
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, refreshProfile }),
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

async function chooseGroupAndInspect() {
  const group = screen.getByRole('combobox', { name: 'Nhóm người dùng' })
  fireEvent.focus(group)
  fireEvent.click(await screen.findByText('KHO — Quản lý kho'))
  fireEvent.click(await screen.findByRole('button', { name: 'Kiểm tra quyền' }))
}

describe('PermissionsPage grant toggle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    refreshProfile.mockReset()
  })

  it('grants an unset pair with If-None-Match and highlights the row', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path, options) => {
        if (path.startsWith('/functions'))
          return list([{ id: 1, code: 'reports.read', name: 'Xem báo cáo' }])
        if (path.startsWith('/user-groups?'))
          return list([{ id: 4, code: 'KHO', name: 'Quản lý kho' }])
        if (options?.method === 'PUT')
          return { data: { isAllowed: true }, etag: '"g2"', status: 200 }
        throw new api.ApiError(404, 'NOT_FOUND', 'Không tìm thấy')
      })
    render(<PermissionsPage />)
    await chooseGroupAndInspect()
    fireEvent.click(await screen.findByRole('button', { name: 'Cho phép' }))
    expect(await screen.findByText('Được phép')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Thu hồi' })).toBeTruthy()
    const put = fetch.mock.calls.find(
      ([, options]) => options?.method === 'PUT',
    )
    expect(put?.[0]).toBe('/user-groups/4/permissions/1')
    expect(put?.[1]).toMatchObject({
      ifNoneMatch: '*',
      body: { isAllowed: true },
    })
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled())
    const row = screen.getByText('Xem báo cáo').closest('tr')!
    expect(row.getAttribute('aria-current')).toBe('true')
  })

  it('reports a failed revoke and keeps the current grant', async () => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path, options) => {
      if (path.startsWith('/functions'))
        return list([{ id: 1, code: 'reports.read', name: 'Xem báo cáo' }])
      if (path.startsWith('/user-groups?'))
        return list([{ id: 4, code: 'KHO', name: 'Quản lý kho' }])
      if (options?.method === 'PUT')
        throw new api.ApiError(412, 'PRECONDITION_FAILED', 'Dữ liệu đã đổi')
      return { data: { isAllowed: true }, etag: '"g1"', status: 200 }
    })
    render(<PermissionsPage />)
    await chooseGroupAndInspect()
    fireEvent.click(await screen.findByRole('button', { name: 'Thu hồi' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Được phép')).toBeTruthy()
    expect(refreshProfile).not.toHaveBeenCalled()
  })
})
