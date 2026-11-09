import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
})
