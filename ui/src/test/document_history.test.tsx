import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { DocumentHistoryPage } from '../features/document_history/DocumentHistoryPage'
import * as apiModule from '../lib/api'
import type { UserResponse } from '../lib/types'

describe('DocumentHistoryPage Component', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Quản trị viên',
    email: 'admin@agentra.vn',
    groupId: 1,
    groupCode: 'ADMIN',
    groupName: 'Quản trị',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: ['audit.read', 'agency.read'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleDocs = [
    {
      id: '301',
      code: 'PX-301',
      kind: 'STOCK_ISSUE' as const,
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      originDocumentId: null,
      receiptType: null,
      status: 'POSTED' as const,
      revisionNo: 1,
      businessDate: '2026-10-05',
      totalAmount: '1020000',
      immediatePayment: '0',
    },
    {
      id: '201',
      code: 'PN-201',
      kind: 'STOCK_RECEIPT' as const,
      agencyId: null,
      agencyName: null,
      originDocumentId: null,
      receiptType: null,
      status: 'POSTED' as const,
      revisionNo: 1,
      businessDate: '2026-10-04',
      totalAmount: '5000000',
      immediatePayment: '0',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/documents')) {
        return {
          data: {
            items: sampleDocs,
            pagination: { limit: 25, hasMore: false, nextCursor: null },
          },
          status: 200,
          etag: '"sample-etag"',
        } as unknown as apiModule.ApiResponse<unknown>
      }
      return {
        data: {
          items: [],
          pagination: { limit: 25, hasMore: false, nextCursor: null },
        },
        status: 200,
        etag: null,
      } as unknown as apiModule.ApiResponse<unknown>
    })
  })

  it('renders document history table', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentHistoryPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Lịch sử chứng từ')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('PX-301')).toBeDefined()
      expect(screen.getByText('PN-201')).toBeDefined()
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getAllByText('Phiếu xuất hàng').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Phiếu nhập hàng').length).toBeGreaterThan(0)
    })
    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.trim())
    // Cross-kind list keeps the kind and agency columns.
    expect(headers).toContain('Loại')
    expect(headers).toContain('Đại lý')
    expect(screen.getByText('1.020.000 ₫').className).toContain('cell-number')
    expect(screen.getByText('5.000.000 ₫')).toBeDefined()
    expect(screen.getByText('05/10/2026')).toBeDefined()
    expect(screen.queryByText('2026-10-05')).toBeNull()
    expect(
      document.querySelectorAll('.badge[data-status="POSTED"]'),
    ).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Phiên bản PX-301' }).textContent,
    ).toBe('Phiên bản')
    const status = screen.getByRole('radiogroup', {
      name: 'Lọc theo trạng thái',
    })
    expect(
      within(status)
        .getAllByRole('radio')
        .map((option) => option.textContent),
    ).toEqual(['Tất cả', 'Nháp', 'Chờ xử lý', 'Đã ghi sổ', 'Đã hủy'])
  })

  it('shows formatted revisions and a revision snapshot', async () => {
    vi.mocked(apiModule.apiFetch).mockImplementation(async (path: string) => {
      if (path.startsWith('/documents/301/revisions'))
        return {
          data: {
            items: [
              {
                id: '9',
                documentId: '301',
                revisionNo: 2,
                state: 'POSTED',
                businessDate: '2026-10-05',
                totalAmount: '1020000',
                immediatePayment: '0',
                sellingPriceRate: null,
                paymentMethod: null,
                agencySnapshot: {
                  name: 'Đại lý Minh Phát',
                  address: '120 Nguyễn Trãi',
                  phone: null,
                  email: 'a@example.com',
                },
                reason: 'Sửa số lượng',
                note: null,
                createdAt: '2026-10-05T08:00:00Z',
                lines: [
                  {
                    id: '1',
                    productId: '1',
                    productName: 'Nước ngọt lon 330ml',
                    unitName: 'Lon',
                    quantity: '1500.5',
                    unitPrice: '680',
                    lineAmount: '1020340',
                    originLineId: null,
                    basePurchasePrice: null,
                    returnAmount: null,
                  },
                ],
              },
            ],
            pagination: { limit: 25, hasMore: false, nextCursor: null },
          },
          status: 200,
          etag: null,
        } as unknown as apiModule.ApiResponse<unknown>
      return {
        data: {
          items: sampleDocs,
          pagination: { limit: 25, hasMore: false, nextCursor: null },
        },
        status: 200,
        etag: null,
      } as unknown as apiModule.ApiResponse<unknown>
    })
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentHistoryPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Phiên bản PX-301' }),
    )
    const view = await screen.findByRole('button', { name: 'Xem v2' })
    expect(view.textContent).toBe('Xem')
    expect(screen.getByText('Sửa số lượng')).toBeDefined()
    fireEvent.click(view)
    await screen.findByText('Nội dung phiên bản v2')
    expect(screen.getByText('1.500,5')).toBeDefined()
    expect(screen.getByText('680 ₫')).toBeDefined()
    expect(screen.getByText('1.020.340 ₫')).toBeDefined()
    expect(screen.queryByText('1500.5')).toBeNull()
    expect(screen.getByRole('button', { name: 'Tải PDF' })).toBeDefined()
  })

  it('filters documents by search query', async () => {
    const fetchSpy = vi.spyOn(apiModule, 'apiFetch')

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentHistoryPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('PX-301')).toBeDefined()
    })

    const searchInput = screen.getByLabelText(/Tìm chứng từ/i, {
      selector: 'input',
    })
    fireEvent.change(searchInput, { target: { value: 'PX-301' } })

    const submitBtn = screen.getByRole('button', { name: 'Áp dụng bộ lọc' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=PX-301'),
        expect.any(Object),
      )
    })
  })

  it('opens and closes printable voucher modal', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentHistoryPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('PX-301')).toBeDefined()
    })

    const versionBtn = screen.getByRole('button', {
      name: 'Phiên bản PX-301',
    })
    fireEvent.click(versionBtn)

    await waitFor(() => {
      expect(screen.getByText(/Lịch sử PX-301/i)).toBeDefined()
    })

    const closeBtn = screen.getByRole('button', { name: /Đóng hộp thoại/i })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Lịch sử PX-301/i)).toBeNull()
    })
  })

  it('renders revisions as a timeline and previews the selected print', async () => {
    const revisionItem = {
      id: '9',
      documentId: '301',
      revisionNo: 2,
      state: 'POSTED',
      businessDate: '2026-10-05',
      totalAmount: '1020000',
      immediatePayment: '0',
      sellingPriceRate: null,
      paymentMethod: null,
      agencySnapshot: null,
      reason: 'Sửa số lượng',
      note: null,
      createdAt: '2026-10-05T08:00:00Z',
      lines: [],
    }
    vi.mocked(apiModule.apiFetch).mockImplementation(async (path: string) => {
      const items = path.startsWith('/documents/301/revisions')
        ? [
            revisionItem,
            {
              ...revisionItem,
              id: '8',
              revisionNo: 1,
              state: 'DRAFT',
              reason: null,
            },
          ]
        : sampleDocs
      return {
        data: {
          items,
          pagination: { limit: 25, hasMore: false, nextCursor: null },
        },
        status: 200,
        etag: null,
      } as unknown as apiModule.ApiResponse<unknown>
    })
    const download = vi
      .spyOn(apiModule, 'apiDownload')
      .mockResolvedValueOnce({
        data: new Blob(['<p>Bản in</p>'], { type: 'text/html' }),
        status: 200,
        etag: null,
      })
      .mockRejectedValueOnce(new Error('Không tạo được PDF'))
    const createUrl = vi.fn(() => 'blob:print-v2')
    const revokeUrl = vi.fn()
    Object.assign(URL, {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    })
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentHistoryPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    // Row click opens the same history dialog as the row button.
    fireEvent.click((await screen.findByText('PX-301')).closest('tr')!)
    const timeline = await screen.findByRole('region', {
      name: 'Dòng thời gian phiên bản',
    })
    await within(timeline).findByText('v2')
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(2)
    expect(within(timeline).getByText('v1')).toBeDefined()
    expect(screen.getByText('Chọn một phiên bản')).toBeDefined()
    const view = screen.getByRole('button', { name: 'Xem v2' })
    expect(view.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(view)
    expect(view.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('Chọn một phiên bản')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem bản in' }))
    const frame = await screen.findByTitle('Bản HTML PX-301')
    expect(frame.getAttribute('src')).toBe('blob:print-v2')
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(download).toHaveBeenCalledWith(
      '/documents/301/print?revisionNo=2',
      expect.objectContaining({ headers: { Accept: 'text/html' } }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tải PDF' }))
    await screen.findByText('Không tạo được PDF')
  })
})
