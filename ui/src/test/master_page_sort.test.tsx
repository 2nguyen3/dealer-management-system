import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  MasterPage,
  type MasterConfig,
} from '../features/master_data/MasterPage'
import { master } from '../features/master_data/masterContracts'
import { ProductsPage } from '../features/products/ProductsPage'
import { UsersPage } from '../features/users/UsersPage'
import * as api from '../lib/api'

// Each step waits for the 300 ms list-query debounce; allow slow CI runs.
configure({ asyncUtilTimeout: 4000 })

vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

function page(items: unknown[], hasMore = false) {
  return {
    data: {
      items,
      pagination: { limit: 25, nextCursor: hasMore ? 'c2' : null, hasMore },
    },
    etag: null,
    status: 200,
  }
}

const accounts = [
  {
    id: '7',
    fullName: 'Thủ kho',
    email: 'kho@agentra.vn',
    groupId: 4,
    groupName: 'Kho',
    status: 'ACTIVE',
  },
  {
    id: '8',
    fullName: 'Kế toán',
    email: 'ketoan@agentra.vn',
    groupId: 5,
    groupName: 'Kế toán',
    status: 'LOCKED',
  },
]

const goods = [
  {
    id: '201',
    code: 'SP-201',
    name: 'Bút bi',
    unitId: 1,
    unitName: 'Cái',
    allowsFraction: false,
    stock: '150',
    lastPurchasePrice: '4000',
    sellingPrice: '5000',
    status: 'ACTIVE',
  },
]

/** Request paths of one list resource, oldest first. */
function listCalls(fetch: MockInstance, path: string): string[] {
  return fetch.mock.calls
    .map(([target]) => String(target))
    .filter((target) => target.startsWith(`${path}?`))
}

function lastCall(fetch: MockInstance, path: string): string {
  return listCalls(fetch, path).at(-1) ?? ''
}

async function header(name: RegExp) {
  return screen.findByRole('columnheader', { name })
}

// Multi-step list requests wait for the 300 ms query debounce each time.
describe('MasterPage server sort', { timeout: 20000 }, () => {
  beforeEach(() => vi.restoreAllMocks())

  it('cycles a header through ascending, descending and the server default', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path) =>
        path.startsWith('/users') ? page(accounts) : page([]),
      )
    render(<UsersPage />)
    let name = await header(/Họ tên/)
    expect(name.getAttribute('aria-sort')).toBe('none')
    expect(lastCall(fetch, '/users')).not.toContain('sort=')

    fireEvent.click(within(name).getByRole('button'))
    await waitFor(() =>
      expect(lastCall(fetch, '/users')).toContain('sort=fullName'),
    )
    name = await header(/Họ tên/)
    expect(name.getAttribute('aria-sort')).toBe('ascending')

    fireEvent.click(within(name).getByRole('button'))
    await waitFor(() =>
      expect(lastCall(fetch, '/users')).toContain('sort=-fullName'),
    )
    name = await header(/Họ tên/)
    expect(name.getAttribute('aria-sort')).toBe('descending')

    fireEvent.click(within(name).getByRole('button'))
    await waitFor(() =>
      expect(lastCall(fetch, '/users')).not.toContain('sort='),
    )
    expect((await header(/Họ tên/)).getAttribute('aria-sort')).toBe('none')
  })

  it('only offers contract sort fields: other columns stay plain headers', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path) =>
        path.startsWith('/users') ? page(accounts) : page([]),
      )
    render(<UsersPage />)
    const group = await header(/^Nhóm$/)
    expect(group.getAttribute('aria-sort')).toBeNull()
    expect(within(group).queryByRole('button')).toBeNull()
    fireEvent.click(within(await header(/Email/)).getByRole('button'))
    await waitFor(() =>
      expect(lastCall(fetch, '/users')).toContain('sort=email'),
    )
    const sorts = listCalls(fetch, '/users')
      .map((target) => new URLSearchParams(target.split('?')[1]).get('sort'))
      .filter(Boolean)
    for (const value of sorts)
      expect([
        'id',
        '-id',
        'fullName',
        '-fullName',
        'email',
        '-email',
        'createdAt',
        '-createdAt',
      ]).toContain(value)
  })

  it('starts numeric headers descending when configured and keeps filters', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path) =>
        path.startsWith('/products') ? page(goods) : page([]),
      )
    render(<ProductsPage />)
    const stock = await header(/Tồn hiện tại/)
    expect(stock.className).toContain('cell-number')
    fireEvent.click(within(stock).getByRole('button'))
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), {
      target: { value: 'Bút' },
    })
    await waitFor(() => {
      const target = lastCall(fetch, '/products')
      expect(target).toContain('sort=-stock')
      expect(target).toContain('q=B%C3%BAt')
    })
  })

  it('sorts from the menu, including fields without a column', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path) =>
        path.startsWith('/users') ? page(accounts) : page([]),
      )
    render(<UsersPage />)
    await header(/Họ tên/)
    fireEvent.keyDown(
      screen.getByRole('button', { name: /Sắp xếp: Mặc định/ }),
      { key: 'Enter' },
    )
    fireEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Ngày tạo' }),
    )
    await waitFor(() =>
      expect(lastCall(fetch, '/users')).toContain('sort=createdAt'),
    )
  })

  it('counts active filters, resets them and labels a partial summary', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (path) =>
        path.startsWith('/users') ? page(accounts, true) : page([]),
      )
    render(<UsersPage />)
    const summary = await screen.findByRole('region', {
      name: 'Tổng quan Quản lý tài khoản',
    })
    expect(within(summary).getByText('Trang hiện tại')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Xóa lọc/ })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Đã khóa' }))
    await waitFor(() =>
      expect(lastCall(fetch, '/users')).toContain('status=LOCKED'),
    )
    const reset = screen.getByRole('button', { name: /Xóa lọc/ })
    expect(within(reset).getByText('1')).toBeTruthy()
    fireEvent.click(reset)
    await waitFor(() =>
      expect(lastCall(fetch, '/users')).not.toContain('status='),
    )
    expect(screen.queryByRole('button', { name: /Xóa lọc/ })).toBeNull()
  })

  it('keeps configs without sorts or summary unchanged', async () => {
    const plain: MasterConfig = {
      path: '/agency-types',
      title: 'Danh sách loại đại lý',
      manage: 'agency_type.manage',
      decode: master,
      fields: [{ key: 'name', label: 'Tên loại' }],
      columns: [
        ['code', 'Mã'],
        ['name', 'Tên loại'],
      ],
    }
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValue(page([{ id: 1, code: 'L1', name: 'Loại 1' }]))
    render(<MasterPage config={plain} />)
    const name = await header(/Tên loại/)
    expect(name.getAttribute('aria-sort')).toBeNull()
    expect(screen.queryByRole('button', { name: /Sắp xếp/ })).toBeNull()
    expect(screen.queryByRole('region', { name: /Tổng quan/ })).toBeNull()
    expect(lastCall(fetch, '/agency-types')).toBe('/agency-types?limit=25')
  })

  it('labels a summary of a single complete page as the whole list', async () => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) =>
      path.startsWith('/users') ? page(accounts) : page([]),
    )
    render(<UsersPage />)
    const summary = await screen.findByRole('region', {
      name: 'Tổng quan Quản lý tài khoản',
    })
    expect(within(summary).getByText('Toàn bộ danh sách')).toBeTruthy()
    expect(summary.textContent).toContain('Đang khóa')
  })
})
