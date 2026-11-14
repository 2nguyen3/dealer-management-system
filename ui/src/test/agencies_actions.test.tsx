import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgenciesPage } from '../features/agencies/AgenciesPage'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import * as apiModule from '../lib/api'
import { ApiError } from '../lib/api'
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
    wardId: 2,
    wardName: 'Phường Sài Gòn',
    typeId: 1,
    typeName: 'Đại lý cấp 1',
    debt: '15000000',
    maxDebt: '50000000',
    remainingCreditLimit: '35000000',
    status: 'ACTIVE',
  } as Agency,
  {
    id: '102',
    code: 'DL-102',
    name: 'Đại lý Hùng Cường',
    phone: '0912345678',
    wardId: 2,
    wardName: 'Phường Sài Gòn',
    typeId: 1,
    typeName: 'Đại lý cấp 1',
    debt: '0',
    maxDebt: '50000000',
    remainingCreditLimit: '50000000',
    status: 'TERMINATED',
  } as Agency,
  {
    id: '103',
    code: 'DL-103',
    name: 'Đại lý Trả Trước',
    phone: '0923456789',
    wardId: 2,
    wardName: 'Phường Sài Gòn',
    typeId: 1,
    typeName: 'Đại lý cấp 1',
    debt: '-200000',
    maxDebt: '50000000',
    remainingCreditLimit: '50200000',
    status: 'ACTIVE',
  } as Agency,
]

let types: unknown[]
let wardRows: unknown[]
let posted: { path: string; body: unknown }[]
let failCreate: unknown = null

function renderPage(granted = ['agency.read', 'agency.manage']) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authWith(granted)}>
        <AgenciesPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

function fillContact(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText(/Tên đại lý/), {
    target: { value: 'Đại lý Mới' },
  })
  fireEvent.change(within(dialog).getByLabelText(/Số điện thoại/), {
    target: { value: '0900000000' },
  })
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
    types = [{ id: 1, name: 'Đại lý cấp 1', maxDebt: '50000000' }]
    wardRows = [
      { id: 2, code: '26740', name: 'Phường Sài Gòn', kind: 'WARD' },
      {
        id: 168,
        code: '26732',
        name: 'Đặc khu Côn Đảo',
        kind: 'SPECIAL_ZONE',
      },
    ]
    posted = []
    failCreate = null
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => ({
        data: path.startsWith('/agency-types') ? types : [],
        status: 200,
        etag: null,
      }),
    )
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path, opts) => {
      if (opts?.method === 'POST' || opts?.method === 'PATCH') {
        posted.push({ path, body: opts.body })
        if (failCreate) throw failCreate
        return { data: agencies[0], status: 201, etag: '"a2"' }
      }
      if (path.startsWith('/wards/'))
        return {
          data: { id: 2, code: '26740', name: 'Phường Sài Gòn', kind: 'WARD' },
          status: 200,
          etag: null,
        }
      if (path.startsWith('/wards'))
        return {
          data: {
            items: wardRows,
            pagination: { limit: 20, nextCursor: null, hasMore: false },
          },
          status: 200,
          etag: null,
        }
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

  it('shows current debt, maximum debt and a prepaid balance', async () => {
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    expect(
      screen.getByRole('columnheader', { name: /Nợ hiện tại/ }),
    ).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Nợ tối đa' })).toBeTruthy()
    expect(
      screen.queryByRole('columnheader', { name: /Dư nợ|Dư có/ }),
    ).toBeNull()
    const prepaid = screen.getByText('Đại lý Trả Trước').closest('tr')!
    expect(prepaid.textContent).toContain('Trả trước')
    openMenu('DL-101')
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Xem chi tiết' }),
    )
    const dialog = await screen.findByRole('dialog')
    const text = dialog.textContent ?? ''
    expect(text).toContain('Nợ hiện tại')
    expect(text).toContain('15.000.000')
    expect(text).toContain('Nợ tối đa')
    expect(text).toContain('Còn được nợ')
    expect(text).toContain('35.000.000')
    expect(text).not.toContain('Dư có')
  })

  it('warns before terminating an agency with debt and shows the 409 reason', async () => {
    failCreate = new ApiError(
      409,
      'AGENCY_HAS_DEBT',
      apiModule.ERROR_CODE_MESSAGES.AGENCY_HAS_DEBT!,
    )
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    openMenu('DL-101')
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Ngừng hợp tác' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Chỉ ngừng hợp tác được khi nợ bằng 0')
    fireEvent.change(within(dialog).getByLabelText(/Lý do/), {
      target: { value: 'Đóng cửa hàng' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận ngừng hợp tác' }),
    )
    await waitFor(() =>
      expect(posted.at(-1)?.path).toBe('/agencies/101/terminate'),
    )
    expect(
      await within(dialog).findByText(
        apiModule.ERROR_CODE_MESSAGES.AGENCY_HAS_DEBT!,
      ),
    ).toBeTruthy()
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

  it('summarises active agencies and ward coverage from the ward catalogue', async () => {
    types = [
      { id: 1, name: 'Đại lý cấp 1', maxDebt: '50000000' },
      { id: 2, name: 'Đại lý cấp 2', maxDebt: '20000000' },
    ]
    wardRows = [
      {
        id: 2,
        code: '26740',
        name: 'Phường Sài Gòn',
        kind: 'WARD',
        activeAgencyCount: 4,
        maxAgencies: 4,
        remainingSlots: 0,
      },
      {
        id: 3,
        code: '26743',
        name: 'Phường Bến Thành',
        kind: 'WARD',
        activeAgencyCount: 3,
        maxAgencies: 4,
        remainingSlots: 1,
      },
      {
        id: 168,
        code: '26732',
        name: 'Đặc khu Côn Đảo',
        kind: 'SPECIAL_ZONE',
        activeAgencyCount: 0,
        maxAgencies: 4,
        remainingSlots: 4,
      },
    ]
    renderPage()
    const overview = await screen.findByRole('list', {
      name: 'Tổng quan đại lý',
    })
    await waitFor(() =>
      expect(overview.textContent ?? '').toContain('Đại lý đang hoạt động7'),
    )
    const text = overview.textContent ?? ''
    expect(text).toContain('Phường/xã có đại lý2')
    expect(text).toContain('Loại đại lý2')
    expect(text).toContain('Phường/xã đã đủ đại lý1')
    expect(text).not.toMatch(/Quận|Chỗ còn nhận/)
  })

  it('rejects a ward row with a negative capacity count', async () => {
    wardRows = [
      {
        id: 2,
        code: '26740',
        name: 'Phường Sài Gòn',
        kind: 'WARD',
        activeAgencyCount: -1,
      },
    ]
    renderPage()
    const overview = await screen.findByRole('list', {
      name: 'Tổng quan đại lý',
    })
    expect(overview.textContent).not.toContain('Phường/xã có đại lý')
  })

  it('omits counts that the type rows do not carry', async () => {
    renderPage()
    const overview = await screen.findByRole('list', {
      name: 'Tổng quan đại lý',
    })
    expect(overview.textContent).not.toContain('Đại lý đang hoạt động')
    expect(overview.textContent).toContain('Loại đại lý1')
  })

  it('requires a ward before creating and sends the chosen wardId', async () => {
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    fireEvent.click(
      screen.getByRole('button', { name: /Tiếp nhận đại lý mới/ }),
    )
    const dialog = await screen.findByRole('dialog')
    fillContact(dialog)
    const ward = within(dialog).getByRole('combobox', { name: /Phường\/xã/ })
    expect((ward as HTMLInputElement).value).toBe('')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }))
    expect(
      await within(dialog).findByText('Vui lòng chọn phường/xã.'),
    ).toBeTruthy()
    expect(posted).toHaveLength(0)

    fireEvent.focus(ward)
    fireEvent.click(
      await within(dialog).findByRole('option', { name: /Đặc khu Côn Đảo/ }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]!.path).toBe('/agencies')
    expect(posted[0]!.body).toMatchObject({
      name: 'Đại lý Mới',
      typeId: 1,
      wardId: 168,
    })
    expect(posted[0]!.body).not.toHaveProperty('districtId')
  })

  it('shows the ward capacity conflict message on create', async () => {
    failCreate = new ApiError(
      409,
      'WARD_CAPACITY_EXCEEDED',
      apiModule.ERROR_CODE_MESSAGES.WARD_CAPACITY_EXCEEDED!,
    )
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    fireEvent.click(
      screen.getByRole('button', { name: /Tiếp nhận đại lý mới/ }),
    )
    const dialog = await screen.findByRole('dialog')
    fillContact(dialog)
    fireEvent.focus(
      within(dialog).getByRole('combobox', { name: /Phường\/xã/ }),
    )
    fireEvent.click(
      await within(dialog).findByRole('option', { name: /Phường Sài Gòn/ }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }))
    expect(
      await within(dialog).findByText(/Phường\/xã đã đủ số đại lý tối đa/),
    ).toBeTruthy()
  })

  it('keeps the agency ward when editing and patches wardId', async () => {
    renderPage()
    await screen.findByText('Đại lý Minh Phát')
    openMenu('DL-101')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sửa hồ sơ' }))
    const dialog = await screen.findByRole('dialog')
    const ward = within(dialog).getByRole('combobox', { name: /Phường\/xã/ })
    await waitFor(() =>
      expect((ward as HTMLInputElement).value).toBe('Phường Sài Gòn'),
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    )
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]!.path).toBe('/agencies/101')
    expect(posted[0]!.body).toMatchObject({ wardId: 2 })
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
