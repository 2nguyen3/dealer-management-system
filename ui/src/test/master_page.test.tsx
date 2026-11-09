import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MasterPage, type MasterConfig } from '../features/districts/MasterPage'
import { master } from '../features/districts/masterContracts'
import * as api from '../lib/api'

const permission = vi.hoisted(() => ({ allow: true }))
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => permission.allow }),
}))

const config: MasterConfig = {
  path: '/districts',
  title: 'Danh sách quận',
  manage: 'district.manage',
  decode: master,
  fields: [
    { key: 'code', label: 'Mã quận' },
    { key: 'name', label: 'Tên quận' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ],
  columns: [
    ['code', 'Mã'],
    ['name', 'Tên quận'],
    ['activeAgencyCount', 'Đại lý hoạt động'],
    ['status', 'Trạng thái'],
  ],
}

const district = {
  id: 1,
  code: 'Q1',
  name: 'Quận 1',
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
        path === '/districts/1'
          ? district
          : {
              items: [district],
              pagination: { limit: 25, nextCursor: null, hasMore: false },
            },
      etag: '"v1"',
      status: 200,
    }))

    render(<MasterPage config={config} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }))

    expect(await screen.findByText('Đại lý hoạt động')).toBeDefined()
    expect(
      screen.getAllByRole('option', { name: 'Hoạt động' }).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Quận 1')).toHaveLength(1)
    const save = screen.getByRole('button', { name: 'Lưu thay đổi' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/^Tên quận/), {
      target: { value: 'Quận mới' },
    })
    expect((save as HTMLButtonElement).disabled).toBe(false)
  })

  it('offers a retry instead of an endless spinner when detail fails', async () => {
    let detailReads = 0
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path === '/districts/1') {
        detailReads++
        if (detailReads === 1) throw new Error('Không tải được chi tiết')
        return { data: district, etag: '"v1"', status: 200 }
      }
      return {
        data: {
          items: [district],
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
        path === '/districts/1'
          ? district
          : {
              items: [district],
              pagination: { limit: 25, nextCursor: null, hasMore: false },
            },
      etag: '"v1"',
      status: 200,
    }))

    render(<MasterPage config={config} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết' }))
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(screen.getByRole('dialog').textContent).toContain('Quận 1')
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull()
  })

  it('skips blank search requests and trims a real search query', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: {
        items: [district],
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
    fireEvent.change(search, { target: { value: '  Q1  ' } })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=Q1'),
        expect.any(Object),
      )
    })
    expect(
      fetch.mock.calls.filter(([path]) => String(path).includes('q=')),
    ).toHaveLength(1)
  })
})
