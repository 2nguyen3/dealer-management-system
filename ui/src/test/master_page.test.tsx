import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MasterPage,
  type MasterConfig,
} from '../features/master_data/MasterPage'
import { master } from '../features/master_data/masterContracts'
import * as api from '../lib/api'

const permission = vi.hoisted(() => ({ allow: true }))
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => permission.allow }),
}))

const config: MasterConfig = {
  path: '/agency-types',
  title: 'Danh sách loại đại lý',
  manage: 'agency_type.manage',
  decode: master,
  fields: [
    { key: 'code', label: 'Mã loại' },
    { key: 'name', label: 'Tên loại' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên loại'],
    ['activeAgencyCount', 'Đại lý hoạt động', 'count'],
    ['status', 'Trạng thái', 'status'],
  ],
}

function listResponse(items: unknown[]) {
  return {
    data: {
      items,
      pagination: { limit: 25, nextCursor: null, hasMore: false },
    },
    etag: null,
    status: 200,
  }
}

const catalogueRow = {
  id: 1,
  code: 'L1',
  name: 'Loại 1',
  activeAgencyCount: 4,
  status: 'ACTIVE',
}

describe('MasterPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    permission.allow = true
  })

  it('shows read-only attributes once and enables save only after editing', async () => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => ({
      data:
        path === '/agency-types/1'
          ? catalogueRow
          : {
              items: [catalogueRow],
              pagination: { limit: 25, nextCursor: null, hasMore: false },
            },
      etag: '"v1"',
      status: 200,
    }))

    render(<MasterPage config={config} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }))

    expect(await screen.findByText('Đại lý hoạt động')).toBeDefined()
    expect(
      screen.getAllByRole('option', { name: 'Đang hoạt động' }).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Loại 1')).toHaveLength(1)
    const save = screen.getByRole('button', { name: 'Lưu thay đổi' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/^Tên loại/), {
      target: { value: 'Loại mới' },
    })
    expect((save as HTMLButtonElement).disabled).toBe(false)
  })

  it('offers a retry instead of an endless spinner when detail fails', async () => {
    let detailReads = 0
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path === '/agency-types/1') {
        detailReads++
        if (detailReads === 1) throw new Error('Không tải được chi tiết')
        return { data: catalogueRow, etag: '"v1"', status: 200 }
      }
      return {
        data: {
          items: [catalogueRow],
          pagination: { limit: 25, nextCursor: null, hasMore: false },
        },
        etag: null,
        status: 200,
      }
    })

    render(<MasterPage config={config} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }))
    expect(await screen.findByText('Không tải được chi tiết')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(
      await screen.findByRole('button', { name: 'Lưu thay đổi' }),
    ).toBeDefined()
    expect(detailReads).toBe(2)
  })

  it('keeps all details visible for a read-only account', async () => {
    permission.allow = false
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => ({
      data:
        path === '/agency-types/1'
          ? catalogueRow
          : {
              items: [catalogueRow],
              pagination: { limit: 25, nextCursor: null, hasMore: false },
            },
      etag: '"v1"',
      status: 200,
    }))

    render(<MasterPage config={config} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }))
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(screen.getByRole('dialog').textContent).toContain('Loại 1')
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull()
  })

  it('skips blank search requests and trims a real search query', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: {
        items: [catalogueRow],
        pagination: { limit: 25, nextCursor: null, hasMore: false },
      },
      etag: null,
      status: 200,
    })

    render(<MasterPage config={config} />)
    await screen.findByRole('button', { name: 'Chi tiết' })
    const search = screen.getByLabelText('Tìm kiếm')
    fireEvent.change(search, { target: { value: '   ' } })
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(fetch).toHaveBeenCalledTimes(1)
    fireEvent.change(search, { target: { value: '  L1  ' } })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=L1'),
        expect.any(Object),
      )
    })
    expect(
      fetch.mock.calls.filter(([path]) => String(path).includes('q=')),
    ).toHaveLength(1)
  })

  it('formats money, quantities, booleans and statuses instead of raw values', async () => {
    const formatted: MasterConfig = {
      ...config,
      path: '/products',
      columns: [
        ['code', 'Mã hàng'],
        ['currentStock', 'Tồn', 'quantity'],
        ['currentSellingPrice', 'Giá bán', 'money'],
        ['allowsFraction', 'Số lẻ', 'boolean'],
        ['status', 'Trạng thái', 'status'],
      ],
    }
    vi.spyOn(api, 'apiFetch').mockResolvedValue(
      listResponse([
        {
          id: 7,
          code: 'SP-7',
          name: 'Bút',
          currentStock: '1500.250',
          currentSellingPrice: '12345678901234567890',
          allowsFraction: true,
          status: 'INACTIVE',
        },
      ]),
    )
    render(<MasterPage config={formatted} />)
    const price = await screen.findByText('12.345.678.901.234.567.890 ₫')
    expect(price.className).toContain('cell-number')
    expect(screen.getByText('1.500,25').className).toContain('cell-number')
    expect(screen.getByText('Có')).toBeDefined()
    const badge = screen.getByText('Ngừng hoạt động')
    expect(badge.getAttribute('data-status')).toBe('INACTIVE')
    expect(screen.queryByText('INACTIVE')).toBeNull()
    expect(
      screen.getByRole('columnheader', { name: 'Giá bán' }).className,
    ).toContain('cell-number')
  })

  it('chooses catalogue references by name and filters without raw IDs', async () => {
    const products: MasterConfig = {
      ...config,
      path: '/products',
      statuses: undefined,
      filters: [
        ['unitId', 'Đơn vị tính', { options: '/units' }],
        ['isLowStock', 'Tồn kho', { boolean: ['Dưới ngưỡng', 'Đủ hàng'] }],
        ['groupId', 'Nhóm người dùng', { picker: 'user-groups' }],
      ],
      fields: [
        {
          key: 'unitId',
          label: 'Đơn vị',
          type: 'catalog',
          lookup: { options: '/units' },
        },
      ],
    }
    const fetch = vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path.startsWith('/units'))
        return listResponse([
          { id: 1, code: 'CAI', name: 'Cái' },
          { id: 2, code: 'HOP', name: 'Hộp' },
        ])
      if (path.startsWith('/user-groups'))
        return listResponse([{ id: 4, code: 'KHO', name: 'Quản lý kho' }])
      return listResponse([])
    })
    render(<MasterPage config={products} />)
    const unit = screen.getByLabelText('Đơn vị tính') as HTMLSelectElement
    await screen.findAllByRole('option', { name: 'HOP — Hộp' })
    expect(fetch).toHaveBeenCalledWith('/units?limit=100', expect.any(Object))
    fireEvent.change(unit, { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Tồn kho'), {
      target: { value: 'true' },
    })
    const group = screen.getByRole('combobox', { name: 'Nhóm người dùng' })
    fireEvent.focus(group)
    fireEvent.click(await screen.findByText('KHO — Quản lý kho'))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/products\?(?=.*unitId=2)(?=.*isLowStock=true)(?=.*groupId=4)/,
        ),
        expect.any(Object),
      )
    })
    expect(screen.queryByLabelText(/ID/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))
    const field = (await screen.findByLabelText(/^Đơn vị/, {
      selector: '#master-field-unitId',
    })) as HTMLSelectElement
    expect(field.tagName).toBe('SELECT')
    expect(
      Array.from(field.options).map((option) => option.textContent),
    ).toContain('CAI — Cái')
  })
})
