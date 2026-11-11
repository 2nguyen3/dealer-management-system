import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { AgenciesPage } from '../features/agencies/AgenciesPage'
import { AuditLogsPage } from '../features/audit_logs/AuditLogsPage'
import { BusinessRulesPage } from '../features/business_rules/BusinessRulesPage'
import { PermissionsPage } from '../features/permissions/PermissionsPage'
import * as api from '../lib/api'
import * as cache from '../lib/cache'

// Each step waits for the 300 ms list-query debounce; allow slow CI runs.
configure({ asyncUtilTimeout: 4000 })

vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, refreshProfile: vi.fn() }),
}))

function page(items: unknown[], nextCursor: string | null = null) {
  return {
    data: {
      items,
      pagination: { limit: 25, nextCursor, hasMore: !!nextCursor },
    },
    etag: null,
    status: 200,
  }
}

function calls(fetch: MockInstance, path: string): string[] {
  return fetch.mock.calls
    .map(([target]) => String(target))
    .filter((target) => target.startsWith(`${path}?`))
}

const last = (fetch: MockInstance, path: string) =>
  calls(fetch, path).at(-1) ?? ''

const agencies = [
  {
    id: '101',
    code: 'DL-101',
    name: 'Đại lý Minh Phát',
    phone: '0901234567',
    districtId: 1,
    districtName: 'Quận 1',
    typeId: 1,
    typeName: 'Đại lý cấp 1',
    currentDebt: '45000000',
    acceptedDate: '2026-06-01',
    status: 'ACTIVE',
  },
  {
    id: '102',
    code: 'DL-102',
    name: 'Đại lý Hùng Cường',
    phone: '0912345678',
    districtId: 2,
    districtName: 'Quận 3',
    typeId: 1,
    typeName: 'Đại lý cấp 1',
    currentDebt: '5000000',
    acceptedDate: '2026-07-01',
    status: 'ACTIVE',
  },
]

// Multi-step list requests wait for the 300 ms query debounce each time.
describe('AgenciesPage sort and debt usage', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'cachedApiFetch').mockImplementation(async (path) => ({
      data: path.startsWith('/districts')
        ? [
            { id: 1, name: 'Quận 1', status: 'ACTIVE' },
            { id: 2, name: 'Quận 3', status: 'ACTIVE' },
          ]
        : [{ id: 1, name: 'Đại lý cấp 1', maxDebt: '50000000' }],
      status: 200,
      etag: null,
    }))
  })

  it('sends contract sorts from headers and restarts from the first page', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path) =>
        String(path).includes('cursor=c2')
          ? page(agencies)
          : page(agencies, 'c2'),
      )
    render(<AgenciesPage />)
    await screen.findByText('Đại lý Minh Phát')
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(last(fetch, '/agencies')).toContain('cursor=c2'))

    const debt = await screen.findByRole('columnheader', { name: /Dư nợ/ })
    fireEvent.click(within(debt).getByRole('button'))
    await waitFor(() => {
      const target = last(fetch, '/agencies')
      expect(target).toContain('sort=-currentDebt')
      expect(target).not.toContain('cursor=')
    })
    expect(
      (await screen.findByRole('columnheader', { name: /Dư nợ/ })).getAttribute(
        'aria-sort',
      ),
    ).toBe('descending')

    fireEvent.click(
      within(
        screen.getByRole('columnheader', { name: /Tên đại lý/ }),
      ).getByRole('button'),
    )
    await waitFor(() => expect(last(fetch, '/agencies')).toContain('sort=name'))
    expect(
      screen
        .getByRole('columnheader', { name: /Điện thoại/ })
        .getAttribute('aria-sort'),
    ).toBeNull()
  })

  it('shows debt-limit usage per agency and for the page', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue(page(agencies))
    render(<AgenciesPage />)
    await screen.findByText('Đại lý Minh Phát')
    const usage = screen.getAllByRole('progressbar')
    expect(usage.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Đã dùng 90% hạn mức nợ',
      'Đã dùng 10% hạn mức nợ',
    ])
    const charts = screen.getByRole('region', {
      name: 'Biểu đồ đại lý trên trang',
    })
    expect(within(charts).getByText('Toàn bộ danh sách')).toBeTruthy()
    const meter = within(charts).getByRole('meter', {
      name: 'Hạn mức nợ đã dùng',
    })
    expect(meter.getAttribute('aria-valuenow')).toBe('50')
  })

  it('counts and resets agency filters', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue(page(agencies))
    render(<AgenciesPage />)
    await screen.findByText('Đại lý Minh Phát')
    fireEvent.click(screen.getByRole('radio', { name: 'Ngừng hợp tác' }))
    await waitFor(() =>
      expect(last(fetch, '/agencies')).toContain('status=TERMINATED'),
    )
    fireEvent.click(screen.getByRole('button', { name: /Xóa lọc/ }))
    await waitFor(() =>
      expect(last(fetch, '/agencies')).not.toContain('status='),
    )
  })
})

// Multi-step list requests wait for the 300 ms query debounce each time.
describe('PermissionsPage sort', { timeout: 20000 }, () => {
  beforeEach(() => vi.restoreAllMocks())

  const grants = [
    {
      id: '1',
      groupId: 4,
      functionId: 1,
      functionCode: 'reports.read',
      functionName: 'Xem báo cáo',
      isAllowed: true,
    },
    {
      id: '2',
      groupId: 4,
      functionId: 2,
      functionCode: 'agency.manage',
      functionName: 'Quản lý đại lý',
      isAllowed: false,
    },
  ]

  function mockApi() {
    return vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path.startsWith('/functions'))
        return page([{ id: 1, code: 'reports.read', name: 'Xem báo cáo' }])
      if (path.startsWith('/user-groups?'))
        return page([{ id: 4, code: 'KHO', name: 'Quản lý kho' }])
      if (path.startsWith('/user-groups/4/permissions?')) return page(grants)
      throw new Error(`unexpected ${path}`)
    })
  }

  it('sorts the function catalogue by code and name headers', async () => {
    const fetch = mockApi()
    render(<PermissionsPage />)
    const code = await screen.findByRole('columnheader', { name: /^Mã/ })
    fireEvent.click(within(code).getByRole('button'))
    await waitFor(() =>
      expect(last(fetch, '/functions')).toContain('sort=code'),
    )
    fireEvent.click(
      within(
        await screen.findByRole('columnheader', { name: /Tên chức năng/ }),
      ).getByRole('button'),
    )
    await waitFor(() =>
      expect(last(fetch, '/functions')).toContain('sort=name'),
    )
  })

  it('loads group grants only on demand, with functionId sort and filter', async () => {
    const fetch = mockApi()
    render(<PermissionsPage />)
    const tab = screen.getByRole('tab', { name: 'Quyền của nhóm' })
    expect(tab.hasAttribute('disabled')).toBe(true)
    const group = screen.getByRole('combobox', { name: 'Nhóm người dùng' })
    fireEvent.focus(group)
    fireEvent.click(await screen.findByText('KHO — Quản lý kho'))
    expect(calls(fetch, '/user-groups/4/permissions')).toHaveLength(0)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Quyền của nhóm' }))
    const table = await screen.findByRole('table', { name: 'Quyền của nhóm' })
    expect(within(table).getByText('Quản lý đại lý')).toBeTruthy()
    expect(last(fetch, '/user-groups/4/permissions')).not.toContain('sort=')
    const summary = screen.getByRole('region', {
      name: 'Tổng quan quyền của nhóm',
    })
    expect(summary.textContent).toContain('Được phép1')

    const fn = within(table).getByRole('columnheader', { name: /Chức năng/ })
    fireEvent.click(within(fn).getByRole('button'))
    await waitFor(() =>
      expect(last(fetch, '/user-groups/4/permissions')).toContain(
        'sort=functionId',
      ),
    )
    fireEvent.click(
      within(
        await screen.findByRole('columnheader', { name: /Chức năng/ }),
      ).getByRole('button'),
    )
    await waitFor(() =>
      expect(last(fetch, '/user-groups/4/permissions')).toContain(
        'sort=-functionId',
      ),
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Không được phép' }))
    await waitFor(() =>
      expect(last(fetch, '/user-groups/4/permissions')).toContain(
        'isAllowed=false',
      ),
    )
  })
})

// Multi-step list requests wait for the 300 ms query debounce each time.
describe('AuditLogsPage sort', { timeout: 20000 }, () => {
  beforeEach(() => vi.restoreAllMocks())

  const row = {
    id: '7',
    actorType: 'USER',
    actorId: '4',
    functionCode: 'agency.manage',
    action: 'UPDATE',
    entityName: 'agency',
    entityKey: '101',
    createdAt: '2026-10-09T03:30:00Z',
  }

  it('asks for newest first and toggles the time order', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue(page([row]))
    render(<AuditLogsPage />)
    await screen.findByText('agency.manage')
    expect(last(fetch, '/audit-logs')).toContain('sort=-createdAt')
    const time = screen.getByRole('columnheader', { name: /Thời điểm/ })
    expect(time.getAttribute('aria-sort')).toBe('descending')
    fireEvent.click(within(time).getByRole('button'))
    await waitFor(() =>
      expect(last(fetch, '/audit-logs')).toMatch(/sort=createdAt(&|$)/),
    )
    fireEvent.click(
      within(
        await screen.findByRole('columnheader', { name: /Thời điểm/ }),
      ).getByRole('button'),
    )
    await waitFor(() =>
      expect(last(fetch, '/audit-logs')).toContain('sort=-createdAt'),
    )
  })
})

// Multi-step list requests wait for the 300 ms query debounce each time.
describe('BusinessRulesPage tiles', { timeout: 20000 }, () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the saved rules, not unsaved edits', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: { maxAgenciesPerDistrict: 4, sellingPriceRate: '1.020000' },
      etag: '"r1"',
      status: 200,
    })
    render(<BusinessRulesPage />)
    const tiles = await screen.findByRole('list', {
      name: 'Quy định đang áp dụng',
    })
    expect(tiles.textContent).toContain('×1,02')
    expect(tiles.textContent).toContain('102.000')
    fireEvent.change(screen.getByLabelText('Hệ số giá bán'), {
      target: { value: '2' },
    })
    expect(tiles.textContent).toContain('×1,02')
  })
})
