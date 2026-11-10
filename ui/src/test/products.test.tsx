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
      lowStockThreshold: '10',
      currentStock: '150',
      currentPurchasePrice: '4000',
      currentSellingPrice: '5000',
      status: 'ACTIVE',
    },
    {
      id: '202',
      code: 'SP-202',
      name: 'Tập 96 trang',
      unitId: 2,
      unitName: 'Hộp',
      lowStockThreshold: '5',
      currentStock: '3',
      currentPurchasePrice: '70000',
      currentSellingPrice: '85000',
      status: 'ACTIVE',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/units')) {
          return {
            data: {
              items: sampleUnits,
              pagination: { limit: 25, nextCursor: null, hasMore: false },
            },
            status: 200,
            etag: 'etag-units',
          }
        }
        return {
          data: {
            items: sampleProducts,
            pagination: { limit: 25, nextCursor: null, hasMore: false },
          },
          status: 200,
          etag: 'etag-products',
        }
      },
    )
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/products')) {
        return {
          data: {
            items: sampleProducts,
            pagination: { limit: 25, nextCursor: null, hasMore: false },
          },
          status: 200,
          etag: 'etag-products',
        }
      }
      return {
        data: {
          items: [],
          pagination: { limit: 25, nextCursor: null, hasMore: false },
        },
        status: 200,
        etag: null,
      }
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
    expect(screen.getByText('85.000 ₫').className).toContain('cell-number')
    expect(screen.getByText('70.000 ₫')).toBeDefined()
    expect(
      screen.getAllByText('Đang hoạt động', { selector: '[data-status]' }),
    ).toHaveLength(2)
    expect(screen.queryByText('ACTIVE')).toBeNull()
    expect(screen.queryByLabelText(/ID đơn vị/)).toBeNull()
    const unit = screen.getByLabelText('Đơn vị tính', { selector: 'select' })
    expect(unit.tagName).toBe('SELECT')
  })

  it('filters product list by search keyword', async () => {
    const fetchSpy = vi.spyOn(apiModule, 'apiFetch')

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

    const searchInput = screen.getByLabelText(/Tìm kiếm/i, {
      selector: 'input',
    })
    fireEvent.change(searchInput, { target: { value: 'Bút bi' } })

    const reloadBtn = screen.getByRole('button', { name: 'Tải lại' })
    fireEvent.click(reloadBtn)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=B%C3%BAt+bi'),
        expect.any(Object),
      )
    })
  })

  it('opens modal when clicking Thêm mới button', async () => {
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
      name: /Thêm mới/i,
    })
    fireEvent.click(addBtn)

    expect(
      screen.getByRole('heading', { name: /Thêm Danh mục mặt hàng/i }),
    ).toBeDefined()
  })
})
