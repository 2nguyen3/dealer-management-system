import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportsPage } from '../features/reports/ReportsPage'
import { reports, type ReportKind } from '../features/reports/contracts'
import * as api from '../lib/api'
import * as exports from '../features/reports/export'
import { huge, reportFixture } from './reportFixtures'

const auth = vi.hoisted(() => ({
  user: { id: '1' },
  allowedFunctions: [
    'reports.read',
    'sales.read',
    'debt.read',
    'inventory.read',
  ],
}))
vi.mock('../features/authentication/useAuth', () => ({ useAuth: () => auth }))

function apply() {
  fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
}
function response(path: string) {
  const url = new URL(path, 'http://test')
  const kind = url.pathname.split('/').pop() as ReportKind
  return {
    data: reportFixture(
      kind,
      url.searchParams.get('fromDate')!,
      url.searchParams.get('toDate')!,
    ),
    status: 200,
    etag: null,
  }
}

describe('authoritative reports', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    auth.user = { id: '1' }
    auth.allowedFunctions = [
      'reports.read',
      'sales.read',
      'debt.read',
      'inventory.read',
    ]
    vi.spyOn(api, 'apiFetch').mockImplementation(
      async (path) => response(path) as never,
    )
  })

  it.each(Object.keys(reports) as ReportKind[])(
    'reads only selected %s on explicit apply with authoritative totals',
    async (kind) => {
      render(<ReportsPage />)
      expect(api.apiFetch).not.toHaveBeenCalled()
      fireEvent.change(screen.getByLabelText('Loại báo cáo'), {
        target: { value: kind },
      })
      if (reports[kind].filters.includes('agencyId'))
        fireEvent.change(screen.getByLabelText('ID đại lý'), {
          target: { value: '9223372036854775807' },
        })
      expect(api.apiFetch).not.toHaveBeenCalled()
      apply()
      await screen.findByRole('region', { name: reports[kind].label })
      expect(api.apiFetch).toHaveBeenCalledTimes(1)
      expect(vi.mocked(api.apiFetch).mock.calls[0]![0]).toContain(
        `/reports/${kind}?`,
      )
      expect(vi.mocked(api.apiFetch).mock.calls[0]![1]?.headers).toEqual({
        Accept: 'application/json',
      })
      expect(screen.getAllByText('9223372036854775807').length).toBe(1)
      if (kind === 'sales') {
        expect(screen.getByText('999')).toBeDefined()
        expect(screen.getByText('0.0001')).toBeDefined()
        expect(screen.getByText(huge + '00')).toBeDefined()
      }
      if (kind === 'inventory')
        expect(
          screen.queryByRole('region', { name: 'Tổng toàn bộ kết quả đã lọc' }),
        ).toBeNull()
    },
  )

  it.each(
    [
      ['sales.read'],
      ['reports.read'],
      [],
      ['product.manage', 'reports.read'],
    ].map((grants) => ({ grants })),
  )('does not request with missing allOf grants $grants', ({ grants }) => {
    auth.allowedFunctions = grants
    render(<ReportsPage />)
    expect(screen.getByText(/Bạn không có quyền xem báo cáo/)).toBeDefined()
    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it('uses inventory defaults for an inventory-only reader', async () => {
    auth.allowedFunctions = ['reports.read', 'inventory.read']
    render(<ReportsPage />)
    apply()
    await screen.findByRole('region', { name: 'Xuất nhập tồn' })
    expect(vi.mocked(api.apiFetch).mock.calls[0]![0]).toContain(
      'sort=productId',
    )
  })

  it('preserves empty as empty and exposes invalid-response/network errors with retry', async () => {
    vi.mocked(api.apiFetch).mockResolvedValueOnce({
      ...response('/reports/sales?fromDate=2026-10-01&toDate=2026-11-01'),
      data: [],
    })
    render(<ReportsPage />)
    apply()
    await screen.findByText(/Dữ liệu máy chủ không đúng hợp đồng/)
    vi.mocked(api.apiFetch).mockRejectedValueOnce(
      new Error('HTTP 429: thử lại sau'),
    )
    fireEvent.click(screen.getByText('Thử lại'))
    await screen.findByText(/HTTP 429/)
    vi.mocked(api.apiFetch).mockImplementationOnce(async (path) => {
      const result = response(path)
      result.data.items = []
      return result as never
    })
    fireEvent.click(screen.getByText('Thử lại'))
    await screen.findByText('Không có dữ liệu trong kỳ và bộ lọc đã chọn.')
    expect(screen.queryByText('Đại lý nguồn')).toBeNull()
  })

  it('validates exact ID filters before issuing any request', async () => {
    render(<ReportsPage />)
    fireEvent.change(screen.getByLabelText('ID đại lý'), {
      target: { value: '9223372036854775808' },
    })
    apply()
    await screen.findByText('ID đại lý không hợp lệ.')
    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it('uses opaque cursors, resets on apply, and does not refetch while editing filters', async () => {
    vi.mocked(api.apiFetch).mockImplementation(async (path) => {
      const result = response(path)
      if (!path.includes('cursor='))
        result.data.pagination = {
          limit: 25,
          hasMore: true,
          nextCursor: 'opaque+cursor/=',
        }
      return result as never
    })
    render(<ReportsPage />)
    apply()
    await screen.findByText('Đại lý nguồn')
    fireEvent.click(screen.getByText('Trang tiếp'))
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(2))
    await screen.findByText('Đại lý nguồn')
    expect(vi.mocked(api.apiFetch).mock.calls[1]![0]).toContain(
      'cursor=opaque%2Bcursor%2F%3D',
    )
    fireEvent.click(screen.getByText('Trang trước'))
    await screen.findByText('Đại lý nguồn')
    expect(vi.mocked(api.apiFetch).mock.calls[2]![0]).not.toContain('cursor=')
    fireEvent.change(screen.getByLabelText('ID đại lý'), {
      target: { value: '2' },
    })
    expect(api.apiFetch).toHaveBeenCalledTimes(3)
    expect(
      screen.getByText('Xuất PDF toàn bộ').closest('button')!.disabled,
    ).toBe(true)
    apply()
    await screen.findByText('Đại lý nguồn')
    expect(vi.mocked(api.apiFetch).mock.calls[3]![0]).toContain('agencyId=2')
    expect(vi.mocked(api.apiFetch).mock.calls[3]![0]).not.toContain('cursor=')
  })

  it('aborts stale reads on apply/unmount and never paints a late response', async () => {
    let resolve!: (value: api.ApiResponse<unknown>) => void
    vi.mocked(api.apiFetch).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }) as never,
    )
    const view = render(<ReportsPage />)
    apply()
    const first = vi.mocked(api.apiFetch).mock.calls[0]!
    fireEvent.change(screen.getByLabelText('ID đại lý'), {
      target: { value: '2' },
    })
    apply()
    await screen.findByText('Đại lý nguồn')
    expect(first[1]!.signal!.aborted).toBe(true)
    await act(async () => {
      resolve({ data: [], status: 200, etag: null })
    })
    expect(screen.queryByText(/Dữ liệu máy chủ không đúng hợp đồng/)).toBeNull()
    view.unmount()
    expect(vi.mocked(api.apiFetch).mock.calls[1]![1]!.signal!.aborted).toBe(
      true,
    )
  })

  it('clears sensitive results immediately and aborts on identity/grant changes', async () => {
    const view = render(<ReportsPage />)
    apply()
    await screen.findByText('Đại lý nguồn')
    auth.allowedFunctions = ['reports.read', 'inventory.read']
    view.rerender(<ReportsPage />)
    expect(screen.queryByText('Đại lý nguồn')).toBeNull()
    expect(vi.mocked(api.apiFetch).mock.calls[0]![1]!.signal!.aborted).toBe(
      true,
    )
    expect(api.apiFetch).toHaveBeenCalledTimes(1)
  })

  it.each(['pdf', 'xlsx'] as const)(
    'exports %s once with applied filters, handles errors, and prevents duplicate export',
    async (format) => {
      let finish!: () => void
      const download = vi
        .spyOn(exports, 'downloadReport')
        .mockImplementationOnce(
          () =>
            new Promise<void>((done) => {
              finish = done
            }),
        )
      render(<ReportsPage />)
      fireEvent.change(screen.getByLabelText('ID đại lý'), {
        target: { value: '7' },
      })
      apply()
      await screen.findByText('Đại lý nguồn')
      const button = screen.getByText(`Xuất ${format.toUpperCase()} toàn bộ`)
      fireEvent.click(button)
      fireEvent.click(button)
      expect(download).toHaveBeenCalledTimes(1)
      expect(download.mock.calls[0]![0].filters).toEqual({ agencyId: '7' })
      expect(api.apiFetch).toHaveBeenCalledTimes(1)
      await act(async () => {
        finish()
      })
      await screen.findByText('Đã tải tệp báo cáo toàn bộ kết quả đã lọc.')
      download.mockRejectedValueOnce(new Error('HTTP 406'))
      fireEvent.click(button)
      await screen.findByText('HTTP 406')
    },
  )

  it('aborts an in-flight export on permission loss', async () => {
    const download = vi
      .spyOn(exports, 'downloadReport')
      .mockReturnValue(new Promise(() => {}))
    const view = render(<ReportsPage />)
    apply()
    await screen.findByText('Đại lý nguồn')
    fireEvent.click(screen.getByText('Xuất PDF toàn bộ'))
    const signal = download.mock.calls[0]![2]
    auth.allowedFunctions = []
    view.rerender(<ReportsPage />)
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('Đại lý nguồn')).toBeNull()
  })
})
