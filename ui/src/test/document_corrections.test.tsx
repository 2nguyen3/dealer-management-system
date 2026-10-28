import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { DocumentCorrectionsPage } from '../features/document_corrections/DocumentCorrectionsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
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
    allowedFunctions: ['documents.correct', 'documents.cancel'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) =>
            ['documents.correct', 'documents.cancel'].includes(p),
          )
        : ['documents.correct', 'documents.cancel'].includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const samplePostedDocs = [
    {
      id: 'doc-301',
      code: 'PX-301',
      kind: 'STOCK_ISSUE',
      agencyId: '101',
      status: 'POSTED',
      createdAt: '2026-10-05T08:00:00Z',
      currentRevision: {
        id: 'rev-301-1',
        revisionNo: 1,
        state: 'POSTED',
        businessDate: '2026-10-05',
        totalAmount: '1020000',
        agencySnapshot: {
          name: 'Đại lý Minh Phát',
        },
      },
    },
    {
      id: 'doc-401',
      code: 'PT-401',
      kind: 'PAYMENT_RECEIPT',
      agencyId: '102',
      status: 'POSTED',
      createdAt: '2026-10-06T10:00:00Z',
      currentRevision: {
        id: 'rev-401-1',
        revisionNo: 1,
        state: 'POSTED',
        businessDate: '2026-10-06',
        totalAmount: '500000',
        agencySnapshot: {
          name: 'Đại lý Toàn Thắng',
        },
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
            data: samplePostedDocs,
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
      expect(screen.getByText('PT-401')).toBeDefined()
      expect(screen.getAllByText('Điều chỉnh').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Hủy chứng từ').length).toBeGreaterThan(0)
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

    const cancelBtns = screen.getAllByText('Hủy chứng từ')
    fireEvent.click(cancelBtns[0]!)

    expect(screen.getByText(/Hủy chứng từ đã ghi sổ PX-301/)).toBeDefined()
    expect(screen.getByText(/Cảnh báo an toàn nghiệp vụ/)).toBeDefined()
    expect(screen.getByText(/Lý do hủy bỏ chứng từ/)).toBeDefined()

    const closeBtn = screen.getByText('Hủy bỏ')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Cảnh báo an toàn nghiệp vụ/)).toBeNull()
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

    const correctBtns = screen.getAllByText('Điều chỉnh')
    fireEvent.click(correctBtns[0]!)

    expect(
      screen.getByText(/Điều chỉnh chứng từ đã ghi sổ PX-301/),
    ).toBeDefined()
    expect(screen.getByText(/Cơ chế sửa sai \(Version Replay\)/)).toBeDefined()
    expect(screen.getByText('Ngày nghiệp vụ mới (*)')).toBeDefined()

    const closeBtn = screen.getByText('Hủy bỏ')
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Cơ chế sửa sai/)).toBeNull()
    })
  })
})
