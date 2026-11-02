import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { PaymentReceiptsPage } from '../features/payment_receipts/PaymentReceiptsPage'
import { ReceivablesPage } from '../features/receivables/ReceivablesPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { Agency, PaymentReceipt, UserResponse } from '../lib/types'

describe('Receivables & Payment Receipts Component Tests', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Kế toán công nợ',
    email: 'ketoannoc@agentra.vn',
    groupId: 3,
    groupCode: 'ACCOUNTING',
    groupName: 'Kế toán',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: [
      'debt.read',
      'cash.receipt.prepare',
      'cash.receipt.post',
    ],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) =>
            ['debt.read', 'cash.receipt.prepare', 'cash.receipt.post'].includes(
              p,
            ),
          )
        : ['debt.read', 'cash.receipt.prepare', 'cash.receipt.post'].includes(
            perm,
          ),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

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

  const sampleReceivables = [
    {
      agencyId: '101',
      agencyCode: 'DL-101',
      agencyName: 'Đại lý Minh Phát',
      districtName: 'Quận 1',
      currentDebt: '15000000',
      maxDebt: '50000000',
      availableCredit: '2000000',
      status: 'ACTIVE' as const,
    },
  ]

  const samplePaymentReceipts: PaymentReceipt[] = [
    {
      id: '501',
      code: 'PT-501',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      status: 'POSTED',
      amount: '5000000',
      paymentMethod: 'BANK_TRANSFER',
      businessDate: '2026-10-05',
      note: 'Thu nợ tiền mặt đợt 1',
      createdAt: '2026-10-05T02:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/agencies')) {
          return { data: sampleAgencies, status: 200, etag: 'etag-a' }
        }
        if (path.startsWith('/receivables')) {
          return { data: sampleReceivables, status: 200, etag: 'etag-rec' }
        }
        if (path.startsWith('/payment-receipts')) {
          return { data: samplePaymentReceipts, status: 200, etag: 'etag-pr' }
        }
        return { data: [], status: 200, etag: null }
      },
    )
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/receivables')) {
        return { data: sampleReceivables, status: 200, etag: 'etag-rec' }
      }
      if (path.startsWith('/payment-receipts')) {
        return { data: samplePaymentReceipts, status: 200, etag: 'etag-pr' }
      }
      return { data: {}, status: 200, etag: null }
    })
  })

  it('renders ReceivablesPage with agency debt and credit summary', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ReceivablesPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getByText('15.000.000 ₫')).toBeDefined()
    })
  })

  it('renders PaymentReceiptsPage with receipt code and amount', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <PaymentReceiptsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('PT-501')).toBeDefined()
      expect(screen.getByText('5.000.000 ₫')).toBeDefined()
    })

    const createBtn = screen.getByRole('button', {
      name: /Lập phiếu thu mới/i,
    })
    expect(createBtn).toBeDefined()
  })
})
