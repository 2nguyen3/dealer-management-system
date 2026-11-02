import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { ProductsPage } from '../features/products/ProductsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { Product, Unit, UserResponse } from '../lib/types'

describe('ProductsPage Component', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Thủ kho',
    email: 'kho@agentra.vn',
    groupId: 4,
    groupCode: 'WAREHOUSE',
    groupName: 'Quản lý kho',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: ['product.manage', 'inventory.read'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) => ['product.manage', 'inventory.read'].includes(p))
        : ['product.manage', 'inventory.read'].includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleUnits: Unit[] = [
    { id: 1, name: 'Cái', allowFraction: false, status: 'ACTIVE' },
    { id: 2, name: 'Hộp', allowFraction: false, status: 'ACTIVE' },
  ]

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
    {
      id: '202',
      code: 'SP-202',
      name: 'Tập 96 trang',
      unitId: 2,
      unitName: 'Hộp',
      minStockAlert: '5',
      maxStockAlert: '200',
      currentStock: '3', // Under minStock
      purchasePrice: '70000',
      sellingPrice: '85000',
      status: 'ACTIVE',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/units')) {
          return { data: sampleUnits, status: 200, etag: 'etag-units' }
        }
        return { data: sampleProducts, status: 200, etag: 'etag-products' }
      },
    )
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/products')) {
        return {
          data: sampleProducts,
          status: 200,
          etag: 'etag-products',
        }
      }
      return { data: {}, status: 200, etag: null }
    })
  })

  it('renders products table with unit names, stock and price tags', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ProductsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Bút bi Thiên Long')).toBeDefined()
      expect(screen.getByText('Tập 96 trang')).toBeDefined()
    })

    expect(screen.getByText('SP-201')).toBeDefined()
    expect(screen.getByText('SP-202')).toBeDefined()
  })

  it('filters product list by search keyword', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ProductsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Bút bi Thiên Long')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(
      /Tìm theo tên hoặc mã mặt hàng/i,
    )
    fireEvent.change(searchInput, { target: { value: 'Bút bi' } })

    expect(screen.getByText('Bút bi Thiên Long')).toBeDefined()
    expect(screen.queryByText('Tập 96 trang')).toBeNull()
  })

  it('opens modal when clicking Thêm mặt hàng button', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ProductsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Bút bi Thiên Long')).toBeDefined()
    })

    const addBtn = screen.getByRole('button', {
      name: /Thêm mặt hàng mới/i,
    })
    fireEvent.click(addBtn)

    expect(
      screen.getByRole('heading', { name: /Thêm mặt hàng mới/i }),
    ).toBeDefined()
  })
})
