import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { dashboardAdmission } from '../features/dashboard/contracts'
import * as api from '../lib/api'
import { dashboardFixture, huge } from './reportFixtures'

const auth = vi.hoisted(() => ({
  user: { id: '1' },
  allowedFunctions: [
    'agency.read',
    'inventory.read',
    'sales.read',
    'debt.read',
    'stock.issue.post',
    'cash.upfront.verify',
  ],
}))
vi.mock('../features/authentication/useAuth', () => ({ useAuth: () => auth }))

describe('authoritative dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    auth.user = { id: '1' }
    auth.allowedFunctions = [...dashboardAdmission]
    vi.spyOn(api, 'apiFetch').mockImplementation(
      async (path) =>
        ({
          data: {
            ...dashboardFixture(),
            month: new URL(path, 'http://test').searchParams.get('month'),
          },
          status: 200,
          etag: null,
        }) as never,
    )
  })

  it('reads one server snapshot only, preserves numeric strings and snapshot date', async () => {
    render(<DashboardPage />)
    await screen.findByText('Đại lý nguồn')
    expect(screen.getAllByText(huge).length).toBeGreaterThan(0)
    expect(screen.getByText('999999999999999999')).toBeDefined()
    expect(screen.getByText('2026-10-30T07:39:22+00:00')).toBeDefined()
    expect(api.apiFetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.apiFetch).mock.calls[0]![0]).toMatch(
      /^\/dashboard\?month=\d{4}-\d{2}$/,
    )
  })

  it.each(
    [
      [],
      ['stock.issue.prepare'],
      ['cash.receipt.post'],
      ['product.manage'],
    ].map((grants) => ({ grants })),
  )('denies admission without source grants $grants', ({ grants }) => {
    auth.allowedFunctions = grants
    render(<DashboardPage />)
    expect(
      screen.getByText(/Bạn không có quyền truy cập bảng điều khiển/),
    ).toBeDefined()
    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it.each(dashboardAdmission)(
    'admits each exact admission grant %s without unauthorized sections',
    async (grant) => {
      auth.allowedFunctions = [grant]
      render(<DashboardPage />)
      await screen.findByText(/Thời điểm chụp dữ liệu/)
      expect(api.apiFetch).toHaveBeenCalledTimes(1)
      if (grant !== 'sales.read')
        expect(screen.queryByText('Top 10 mặt hàng theo máy chủ')).toBeNull()
      if (grant !== 'debt.read')
        expect(screen.queryByText('Đại lý nguồn')).toBeNull()
      if (grant !== 'inventory.read')
        expect(screen.queryByText('Số mặt hàng')).toBeNull()
    },
  )

  it('accepts omitted optional sections without inventing zeroes', async () => {
    vi.mocked(api.apiFetch).mockImplementationOnce(
      async (path) =>
        ({
          data: {
            month: new URL(path, 'http://test').searchParams.get('month'),
            asOf: '2026-10-30T00:00:00Z',
          },
          status: 200,
          etag: null,
        }) as never,
    )
    render(<DashboardPage />)
    await screen.findByText(/Thời điểm chụp dữ liệu/)
    expect(screen.getAllByText(/không thay thế bằng số 0/).length).toBe(6)
    expect(screen.queryByText('Nợ hiện tại')).toBeNull()
  })

  it('renders explicit errors and recovers without fallback financial values', async () => {
    vi.mocked(api.apiFetch).mockRejectedValueOnce(new Error('HTTP 403'))
    render(<DashboardPage />)
    await screen.findByText(/HTTP 403/)
    expect(screen.queryByText(huge)).toBeNull()
    fireEvent.click(screen.getByText('Thử lại'))
    await screen.findByText('Đại lý nguồn')
  })

  it('only reads an applied month and aborts old month/identity requests', async () => {
    let resolve!: (value: api.ApiResponse<unknown>) => void
    vi.mocked(api.apiFetch).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }) as never,
    )
    const view = render(<DashboardPage />)
    const firstSignal = vi.mocked(api.apiFetch).mock.calls[0]![1]!.signal!
    fireEvent.change(screen.getByLabelText(/Tháng nghiệp vụ \(Việt Nam\)/), {
      target: { value: '2026-09' },
    })
    expect(api.apiFetch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Xem tháng'))
    await screen.findByText('Đại lý nguồn')
    expect(firstSignal.aborted).toBe(true)
    expect(vi.mocked(api.apiFetch).mock.calls[1]![0]).toBe(
      '/dashboard?month=2026-09',
    )
    await act(async () => {
      resolve({ data: dashboardFixture(), status: 200, etag: null })
    })
    expect(screen.queryByText(/Tháng 2026-10\./)).toBeNull()
    auth.allowedFunctions = []
    view.rerender(<DashboardPage />)
    expect(screen.queryByText('Đại lý nguồn')).toBeNull()
    expect(vi.mocked(api.apiFetch).mock.calls[1]![1]!.signal!.aborted).toBe(
      true,
    )
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(2))
  })
})
