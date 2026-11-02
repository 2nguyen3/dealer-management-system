import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { ChatbotPage } from '../features/chatbot/ChatbotPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { UserResponse } from '../lib/types'

describe('ChatbotPage Component', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Nguyễn Văn Quản Lý',
    email: 'quanly@agentra.vn',
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
      'agency.read',
      'debt.read',
      'inventory.read',
      'sales.read',
    ],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleAgencies = [
    {
      id: '101',
      code: 'DL-101',
      name: 'Đại lý Minh Phát',
      currentDebt: '1500000',
      maxDebt: '5000000',
      status: 'ACTIVE',
    },
  ]

  const sampleProducts = [
    {
      id: 'p1',
      code: 'MH-01',
      name: 'Máy lọc nước',
      currentStock: '12',
      sellingPrice: '3500000',
      unitName: 'Cái',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/agencies')) {
          return {
            data: sampleAgencies,
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        if (path.startsWith('/products')) {
          return {
            data: sampleProducts,
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
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      data: null,
      status: 404,
      etag: null,
    })
  })

  it('renders chatbot interface with greeting and suggestion chips', () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ChatbotPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Trợ lý ảo thông minh')).toBeDefined()
    expect(screen.getByText(/Tôi là Trợ lý ảo Agentra DMS/)).toBeDefined()
    expect(screen.getByText('Dư nợ Minh Phát')).toBeDefined()
    expect(screen.getByText('Mặt hàng sắp hết tồn')).toBeDefined()
  })

  it('submits a question and receives an answer', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ChatbotPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    const input = screen.getByPlaceholderText(
      'Đặt câu hỏi về công nợ, tồn kho hoặc doanh số...',
    )
    const sendBtn = screen.getByText('Gửi câu hỏi')

    fireEvent.change(input, {
      target: { value: 'Đại lý Minh Phát đang nợ bao nhiêu?' },
    })
    fireEvent.click(sendBtn)

    expect(
      screen.getByText('Đại lý Minh Phát đang nợ bao nhiêu?'),
    ).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText(/1.500.000 ₫/)).toBeDefined()
    })
  })
})
