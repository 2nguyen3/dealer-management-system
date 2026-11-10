import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgenciesPage } from '../features/agencies/AgenciesPage'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { Agency } from '../lib/types'

function authWith(granted: string[]): AuthContextValue {
  return {
    user: null,
    allowedFunctions: granted,
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) => granted.includes(p))
        : granted.includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  } as AuthContextValue
}

const agencies: Agency[] = [
  {
    id: '101',
    code: 'DL-101',
    name: 'Đại lý Minh Phát',
    phone: '0901234567',
    districtId: 1,
    districtName: 'Quận 1',
    typeId: 1,
    typeName: 'Đại lý cấp 1',
    currentDebt: '15000000',
    status: 'ACTIVE',
  } as Agency,
  {
    id: '102',
    code: 'DL-102',
    name: 'Đại lý Hùng Cường',
    phone: '0912345678',
    districtId: 1,
    districtName: 'Quận 1',
    typeId: 1,
    typeName: 'Đại lý cấp 1',
    currentDebt: '0',
    status: 'TERMINATED',
  } as Agency,
]

let districts: unknown[]

function renderPage(granted = ['agency.read', 'agency.manage']) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authWith(granted)}>
        <AgenciesPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

function openMenu(code: string) {
  const trigger = screen.getByRole('button', {
    name: new RegExp(`^Thao tác ${code}`),
  })
  fireEvent.keyDown(trigger, { key: 'Enter' })
}

describe('AgenciesPage row actions and overview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    districts = [
      { id: 1, name: 'Quận 1', status: 'ACTIVE' },
      { id: 2, name: 'Quận 3', status: 'ACTIVE' },
    ]
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => ({
        data: path.startsWith('/districts')
          ? districts
          : [{ id: 1, name: 'Đại lý cấp 1', maxDebt: '50000000' }],
        status: 200,
        etag: null,
      }),
    )
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path) => {
      if (path === '/agencies/101')
        return { data: agencies[0], status: 200, etag: '"a1"' }
      return {
        data: { items: agencies, pagination: { nextCursor: null } },
        status: 200,
        etag: null,
      }
    })
  })

  it('offers view, edit and terminate in the row menu of an active agency', async () => {
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    openMenu('DL-101')
    const items = (await screen.findAllByRole('menuitem')).map(
      (item) => item.textContent,
    )
    expect(items).toEqual(['Xem chi tiết', 'Sửa hồ sơ', 'Ngừng hợp tác'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sửa hồ sơ' }))
    expect(
      await screen.findByRole('heading', { name: 'Chỉnh sửa hồ sơ: DL-101' }),
    ).toBeTruthy()
    expect(apiModule.apiFetch).toHaveBeenCalledWith('/agencies/101')
  })

  it('opens the terminate dialog from the menu with a required reason', async () => {
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    openMenu('DL-101')
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Ngừng hợp tác' }),
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận ngừng hợp tác' }),
    )
    expect(
      await within(dialog).findByText('Vui lòng nhập lý do ngừng hợp tác.'),
    ).toBeTruthy()
  })

  it('limits a terminated agency and a read-only account to viewing', async () => {
    renderPage()
    await screen.findByText('Đại lý Hùng Cường')
    openMenu('DL-102')
    expect(
      (await screen.findAllByRole('menuitem')).map((item) => item.textContent),
    ).toEqual(['Xem chi tiết'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xem chi tiết' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('DL-102')
    expect(dialog.textContent).toContain('Ngừng hợp tác')
  })

  it('hides management actions for an account without agency.manage', async () => {
    renderPage(['agency.read'])
    await screen.findByText('Đại lý Minh Phát')
    expect(
      screen.queryByRole('button', { name: /Tiếp nhận đại lý mới/ }),
    ).toBeNull()
    openMenu('DL-101')
    expect(
      (await screen.findAllByRole('menuitem')).map((item) => item.textContent),
    ).toEqual(['Xem chi tiết'])
  })

  it('summarises catalogue counts only when the district data provides them', async () => {
    districts = [
      {
        id: 1,
        name: 'Quận 1',
        status: 'ACTIVE',
        activeAgencyCount: 3,
        remainingSlots: 1,
      },
      {
        id: 2,
        name: 'Quận 3',
        status: 'ACTIVE',
        activeAgencyCount: '4',
        remainingSlots: 0,
      },
    ]
    renderPage()
    const overview = await screen.findByRole('list', {
      name: 'Tổng quan đại lý',
    })
    const text = overview.textContent ?? ''
    expect(text).toContain('Đại lý đang hoạt động7')
    expect(text).toContain('Quận2')
    expect(text).toContain('Loại đại lý1')
    expect(text).toContain('Chỗ còn nhận1')
  })

  it('omits counts that the district rows do not carry', async () => {
    renderPage()
    const overview = await screen.findByRole('list', {
      name: 'Tổng quan đại lý',
    })
    expect(overview.textContent).not.toContain('Đại lý đang hoạt động')
    expect(overview.textContent).not.toContain('Chỗ còn nhận')
    expect(overview.textContent).toContain('Quận2')
  })

  it('uses a dd/MM/yyyy date picker for the reception date', async () => {
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    fireEvent.click(
      screen.getByRole('button', { name: /Tiếp nhận đại lý mới/ }),
    )
    const date = await screen.findByRole('button', {
      name: /^Ngày tiếp nhận: \d{2}\/\d{2}\/\d{4}$/,
    })
    expect(date).toBeTruthy()
  })
})
