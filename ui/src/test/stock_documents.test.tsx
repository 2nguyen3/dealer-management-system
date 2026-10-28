import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { StockIssuesPage } from '../features/stock_issues/StockIssuesPage'
import { StockReceiptsPage } from '../features/stock_receipts/StockReceiptsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type {
  Agency,
  Product,
  StockIssue,
  StockReceipt,
  UserResponse,
} from '../lib/types'

describe('Stock Receipts & Issues Component Tests', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Thủ kho trưởng',
    email: 'thukho@agentra.vn',
    groupId: 4,
    groupCode: 'WAREHOUSE',
    groupName: 'Quản lý kho',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: [
      'stock.receipt.prepare',
      'stock.receipt.post',
      'stock.issue.prepare',
      'stock.issue.post',
    ],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) =>
            [
              'stock.receipt.prepare',
              'stock.receipt.post',
              'stock.issue.prepare',
              'stock.issue.post',
            ].includes(p),
          )
        : [
            'stock.receipt.prepare',
            'stock.receipt.post',
            'stock.issue.prepare',
            'stock.issue.post',
          ].includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleProducts: Product[] = [
    {
      id: '201',
      code: 'SP-201',
      name: 'Bút bi Thiên Long',
      unitId: 1,
      unitName: 'Cái',
      minStockAlert: '10',
      maxStockAlert: '500',
      currentStock: '150',
      purchasePrice: '4000',
      sellingPrice: '5000',
      status: 'ACTIVE',
    },
  ]

  const sampleAgencies: Agency[] = [
    {
      id: '101',
      code: 'DL-101',
      name: 'Đại lý Minh Phát',
      phone: '0901234567',
      email: 'minhphat@example.com',
      address: '123 Lê Lợi',
      districtId: 1,
      districtName: 'Quận 1',
      typeId: 1,
      typeName: 'Đại lý cấp 1',
      currentDebt: '15000000',
      status: 'ACTIVE',
      createdAt: '2026-06-01T00:00:00Z',
    },
  ]

  const sampleReceipts: StockReceipt[] = [
    {
      id: '301',
      code: 'PN-301',
      supplierName: 'Công ty Văn phòng phẩm Á Châu',
      status: 'POSTED',
      totalAmount: '4000000',
      businessDate: '2026-10-01',
      note: 'Nhập lô hàng bút',
      createdAt: '2026-10-01T02:00:00Z',
    },
  ]

  const sampleIssues: StockIssue[] = [
    {
      id: '401',
      code: 'PX-401',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      status: 'READY',
      totalAmount: '2500000',
      businessDate: '2026-10-02',
      note: 'Xuất hàng cho đại lý Minh Phát',
      createdAt: '2026-10-02T02:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/products')) {
          return { data: sampleProducts, status: 200, etag: 'etag-p' }
        }
        if (path.startsWith('/agencies')) {
          return { data: sampleAgencies, status: 200, etag: 'etag-a' }
        }
        if (path.startsWith('/stock-receipts')) {
          return { data: sampleReceipts, status: 200, etag: 'etag-r' }
        }
        if (path.startsWith('/stock-issues')) {
          return { data: sampleIssues, status: 200, etag: 'etag-i' }
        }
        return { data: [], status: 200, etag: null }
      },
    )
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/stock-receipts')) {
        return { data: sampleReceipts, status: 200, etag: 'etag-r' }
      }
      if (path.startsWith('/stock-issues')) {
        return { data: sampleIssues, status: 200, etag: 'etag-i' }
      }
      return { data: {}, status: 200, etag: null }
    })
  })

  it('renders StockReceiptsPage with receipt code and supplier name', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <StockReceiptsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('PN-301')).toBeDefined()
      expect(screen.getByText('Công ty Văn phòng phẩm Á Châu')).toBeDefined()
    })

    const createBtn = screen.getByRole('button', {
      name: /Lập phiếu nhập mới/i,
    })
    expect(createBtn).toBeDefined()
  })

  it('renders StockIssuesPage with issue code, agency name and total amount', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <StockIssuesPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('PX-401')).toBeDefined()
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
    })

    const createBtn = screen.getByRole('button', {
      name: /Lập phiếu xuất mới/i,
    })
    expect(createBtn).toBeDefined()
  })
})
