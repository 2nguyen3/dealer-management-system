import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { DocumentCorrectionsPage } from '../features/document_corrections/DocumentCorrectionsPage'
import * as apiModule from '../lib/api'
import type { UserResponse } from '../lib/types'

describe('DocumentCorrectionsPage Component', () => {
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
    allowedFunctions: [
      'documents.correct',
      'documents.cancel',
      'stock.issue.post',
      'stock.issue.prepare',
      'debt.read',
      'sales.read',
    ],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) =>
            [
              'documents.correct',
              'documents.cancel',
              'stock.issue.post',
              'stock.issue.prepare',
              'debt.read',
              'sales.read',
            ].includes(p),
          )
        : [
            'documents.correct',
            'documents.cancel',
            'stock.issue.post',
            'stock.issue.prepare',
            'debt.read',
            'sales.read',
          ].includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const samplePostedDocs = [
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
  ]

  const sampleDetail = {
    id: '301',
    code: 'PX-301',
    kind: 'STOCK_ISSUE',
    status: 'POSTED',
    agencyId: '101',
    originDocumentId: null,
    receiptType: null,
    currentRevision: {
      id: '1',
      documentId: '301',
      revisionNo: 1,
      state: 'POSTED',
      businessDate: '2026-10-05',
      totalAmount: '1020000',
      immediatePayment: '0',
      sellingPriceRate: '1.2',
      paymentMethod: null,
      agencySnapshot: {
        name: 'Đại lý Minh Phát',
        address: '120 Nguyễn Trãi, Quận 1',
        phone: '0901234567',
        email: 'daily@example.com',
      },
      reason: null,
      note: null,
      createdAt: '2026-10-05T08:00:00Z',
      lines: [
        {
          id: '1',
          productId: '1',
          productName: 'Nước ngọt lon 330ml',
          unitName: 'Lon',
          quantity: '10',
          unitPrice: '102000',
          lineAmount: '1020000',
          originLineId: null,
          basePurchasePrice: null,
          returnAmount: null,
        },
      ],
    },
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/documents')) {
        return {
          data: {
            items: samplePostedDocs,
            pagination: { limit: 25, hasMore: false, nextCursor: null },
          },
          status: 200,
          etag: '"sample-etag"',
        } as unknown as apiModule.ApiResponse<unknown>
      }
      if (path.startsWith('/stock-issues/301')) {
        return {
          data: sampleDetail,
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

  it('renders posted documents eligible for corrections', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentCorrectionsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Sửa sai và hủy chứng từ')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('PX-301')).toBeDefined()
      expect(screen.getByText('Kiểm tra PX-301')).toBeDefined()
    })
  })

  it('opens and closes cancel confirmation modal', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentCorrectionsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('PX-301')).toBeDefined()
    })

    const inspectBtn = screen.getByRole('button', { name: 'Kiểm tra PX-301' })
    fireEvent.click(inspectBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hủy chứng từ' })).toBeDefined()
    })

    const cancelBtn = screen.getByRole('button', { name: 'Hủy chứng từ' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.getByText(/Hủy chứng từ PX-301/i)).toBeDefined()
      expect(screen.getByLabelText(/Lý do bắt buộc/i)).toBeDefined()
    })

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Hủy chứng từ PX-301/i)).toBeNull()
    })
  })

  it('opens and closes correct modal', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DocumentCorrectionsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('PX-301')).toBeDefined()
    })

    const inspectBtn = screen.getByRole('button', { name: 'Kiểm tra PX-301' })
    fireEvent.click(inspectBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Điều chỉnh' })).toBeDefined()
    })

    const correctBtn = screen.getByRole('button', { name: 'Điều chỉnh' })
    fireEvent.click(correctBtn)

    await waitFor(() => {
      expect(screen.getByText(/Thay thế toàn bộ PX-301/i)).toBeDefined()
      expect(screen.getByLabelText(/Ngày nghiệp vụ mới/i)).toBeDefined()
      expect(screen.getByLabelText(/Lý do bắt buộc/i)).toBeDefined()
    })

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Thay thế toàn bộ PX-301/i)).toBeNull()
    })
  })
})
