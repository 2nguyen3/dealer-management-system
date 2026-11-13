import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MasterPage,
  type MasterConfig,
} from '../features/master_data/MasterPage'
import { master, user } from '../features/master_data/masterContracts'
import * as api from '../lib/api'

const permission = vi.hoisted(() => ({ allow: true }))
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => permission.allow }),
}))

const config: MasterConfig = {
  path: '/agency-types',
  title: 'Danh sách loại đại lý',
  description: 'Loại đại lý và hạn mức nợ.',
  manage: 'agency_type.manage',
  decode: master,
  fields: [
    { key: 'code', label: 'Mã loại' },
    { key: 'name', label: 'Tên loại' },
    { key: 'openedOn', label: 'Ngày mở', type: 'date', optional: true },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên loại'],
  ],
}

function page(items: unknown[]) {
  return {
    data: {
      items,
      pagination: { limit: 25, nextCursor: null, hasMore: false },
    },
    etag: null,
    status: 200,
  }
}

describe('MasterPage layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    permission.allow = true
  })

  it('shows skeleton rows while loading and then the result count', async () => {
    let release: (
      value: Awaited<ReturnType<typeof api.apiFetch>>,
    ) => void = () => {}
    vi.spyOn(api, 'apiFetch').mockReturnValue(
      new Promise((done) => {
        release = done
      }),
    )
    render(<MasterPage config={config} />)
    expect(
      screen.getByRole('status', { name: 'Đang tải danh sách…' }),
    ).toBeTruthy()
    release(page([{ id: 1, code: 'L1', name: 'Loại 1' }]))
    expect(await screen.findByText('Loại 1')).toBeTruthy()
    expect(
      screen.queryByRole('status', { name: 'Đang tải danh sách…' }),
    ).toBeNull()
    expect(
      screen.getByText('kết quả trên trang', { exact: false }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Danh sách loại đại lý' }),
    ).toBeTruthy()
  })

  it('shows an empty state and no table when nothing matches', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue(page([]))
    render(<MasterPage config={config} />)
    expect(await screen.findByText('Không có kết quả')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('hides the create action and uses a view tooltip for read-only users', async () => {
    permission.allow = false
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    vi.spyOn(api, 'apiFetch').mockResolvedValue(
      page([{ id: 1, code: 'L1', name: 'Loại 1' }]),
    )
    render(<MasterPage config={config} />)
    const view = await screen.findByRole('button', { name: 'Chi tiết' })
    expect(screen.queryByRole('button', { name: 'Thêm mới' })).toBeNull()
    fireEvent.focus(view)
    expect((await screen.findAllByText('Xem chi tiết')).length).toBeGreaterThan(
      0,
    )
    vi.unstubAllGlobals()
  })

  it('creates with a two-column form and a dd/MM/yyyy date picker', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue(page([]))
    render(<MasterPage config={config} />)
    await screen.findByText('Không có kết quả')
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('button', {
        name: /^Ngày mở: \d{2}\/\d{2}\/\d{4}$/,
      }),
    ).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Tạo mới' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('groups password reset in its own section for account pages', async () => {
    const users: MasterConfig = {
      path: '/users',
      title: 'Quản lý tài khoản',
      manage: 'users.manage',
      decode: user,
      noDelete: true,
      passwordReset: true,
      fields: [{ key: 'fullName', label: 'Họ tên' }],
      columns: [
        ['fullName', 'Họ tên'],
        ['status', 'Trạng thái', 'status'],
      ],
    }
    const account = {
      id: '9',
      fullName: 'Thủ kho',
      email: 'kho@agentra.vn',
      groupId: 4,
      groupName: 'Kho',
      status: 'ACTIVE',
    }
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path, options) => {
        if (path === '/users/9/password-reset')
          return { data: {}, etag: null, status: 204 }
        if (path === '/users/9')
          return { data: account, etag: '"u1"', status: 200 }
        void options
        return page([account])
      })
    render(<MasterPage config={users} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }))
    const dialog = await screen.findByRole('dialog')
    const section = (
      await within(dialog).findByRole('heading', { name: 'Đặt lại mật khẩu' })
    ).closest('section')!
    const reset = within(section).getByRole('button', {
      name: 'Đặt lại mật khẩu',
    }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    expect(within(dialog).queryByRole('button', { name: 'Xóa' })).toBeNull()
    fireEvent.change(within(section).getByLabelText(/Mật khẩu mới/), {
      target: { value: 'Temp#123' },
    })
    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    expect(
      await screen.findByText(/Đã đặt lại mật khẩu và đăng xuất các phiên cũ/),
    ).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/users/9/password-reset',
      expect.objectContaining({
        method: 'POST',
        ifMatch: '"u1"',
        body: { newPassword: 'Temp#123' },
      }),
    )
  })
})
