import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { DocumentHistoryPage } from '../features/document_history/DocumentHistoryPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
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
      id: 'doc-001',
      code: 'PX-301',
      kind: 'STOCK_ISSUE',
      agencyId: '101',
      status: 'POSTED',
      createdAt: '2026-10-05T08:00:00Z',
      currentRevision: {
        id: 'rev-301-1',
        documentId: 'doc-001',
        revisionNo: 1,
        state: 'POSTED',
        businessDate: '2026-10-05',
        totalAmount: '1020000',
        agencySnapshot: {
          name: 'Đại lý Minh Phát',
          address: '120 Nguyễn Trãi, Quận 1',
        },
        lines: [
          {
            id: 'l-1',
            productId: 'p-1',
            productName: 'Nước ngọt lon 330ml',
            quantity: '10',
            unitPrice: '102000',
            amount: '1020000',
          },
        ],
      },
    },
    {
      id: 'doc-002',
      code: 'PN-201',
      kind: 'STOCK_RECEIPT',
      agencyId: null,
      status: 'POSTED',
      createdAt: '2026-10-04T09:00:00Z',
      currentRevision: {
        id: 'rev-201-1',
        documentId: 'doc-002',
        revisionNo: 1,
        state: 'POSTED',
        businessDate: '2026-10-04',
        totalAmount: '5000000',
        lines: [],
      },
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/agencies')) {
          return {
            data: [{ id: '101', code: 'DL-101', name: 'Đại lý Minh Phát' }],
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        if (path.startsWith('/documents')) {
          return {
            data: sampleDocs,
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        return {
          data: [],
          status: 200,
          headers: new Headers(),
        } as unknown as apiModule.ApiResponse<unknown>
      },
    )
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
      expect(screen.getAllByText('Xuất hàng (PX)').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Nhập hàng (PN)').length).toBeGreaterThan(0)
    })
  })

  it('filters documents by search query', async () => {
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

    const searchInput = screen.getByPlaceholderText(
      'Tìm theo mã chứng từ, tên đối tác, ghi chú...',
    )
    fireEvent.change(searchInput, { target: { value: 'PN-201' } })

    expect(screen.queryByText('PX-301')).toBeNull()
    expect(screen.getByText('PN-201')).toBeDefined()
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

    const printBtns = screen.getAllByText('In')
    fireEvent.click(printBtns[0]!)

    expect(screen.getByText(/PHIẾU XUẤT KHO KIÊM BÁN HÀNG/)).toBeDefined()
    expect(screen.getByText('In phiếu này')).toBeDefined()

    const closeBtn = screen.getByText('Đóng')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText('In phiếu này')).toBeNull()
    })
  })
})
