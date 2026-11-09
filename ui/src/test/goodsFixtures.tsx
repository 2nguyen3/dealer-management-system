import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import type {
  DocumentDetail,
  DocumentKind,
  DocumentSummary,
  Revision,
} from '../features/document_history/documentContracts'
import type { FunctionCode } from '../lib/types'

export const timestamp = '2026-10-30T01:00:00Z'
export function revision(overrides: Partial<Revision> = {}): Revision {
  return {
    id: '101',
    documentId: '1',
    revisionNo: 1,
    state: 'DRAFT',
    businessDate: '2026-10-30',
    totalAmount: '900719925474099301',
    immediatePayment: '0',
    sellingPriceRate: null,
    paymentMethod: null,
    agencySnapshot: null,
    reason: null,
    note: 'Original note',
    createdAt: timestamp,
    lines: [
      {
        id: '201',
        productId: '301',
        productName: 'Historical product',
        unitName: 'Hộp',
        quantity: '1.001',
        unitPrice: '900719925474099301',
        lineAmount: '900719925474099301',
        originLineId: null,
        basePurchasePrice: null,
        returnAmount: null,
      },
    ],
    ...overrides,
  }
}
export function detail(
  kind: DocumentKind = 'STOCK_RECEIPT',
  overrides: Partial<DocumentDetail> = {},
): DocumentDetail {
  return {
    id: '1',
    code:
      kind === 'STOCK_ISSUE'
        ? 'PX-1'
        : kind === 'SALES_RETURN'
          ? 'TH-1'
          : kind === 'STOCK_ADJUSTMENT'
            ? 'DC-1'
            : kind === 'PAYMENT_RECEIPT'
              ? 'PT-1'
              : 'PN-1',
    kind,
    status: 'DRAFT',
    agencyId:
      kind === 'STOCK_RECEIPT' || kind === 'STOCK_ADJUSTMENT' ? null : '401',
    originDocumentId: kind === 'SALES_RETURN' ? '99' : null,
    receiptType: null,
    stockCountId: null,
    upfrontConfirmationId: null,
    autoReceiptId: null,
    currentRevision: revision(),
    ...overrides,
  }
}
export function summary(doc: DocumentDetail = detail()): DocumentSummary {
  return {
    id: doc.id,
    code: doc.code,
    kind: doc.kind,
    status: doc.status,
    agencyId: doc.agencyId,
    agencyName: doc.currentRevision.agencySnapshot?.name ?? null,
    originDocumentId: doc.originDocumentId,
    receiptType: doc.receiptType,
    revisionNo: doc.currentRevision.revisionNo,
    businessDate: doc.currentRevision.businessDate,
    totalAmount: doc.currentRevision.totalAmount,
    immediatePayment: doc.currentRevision.immediatePayment,
  }
}
export function page<T>(items: T[], nextCursor: string | null = null) {
  return {
    items,
    pagination: { limit: 25, hasMore: nextCursor !== null, nextCursor },
  }
}
export function response<T>(data: T, etag: string | null = '"parent-v1"') {
  return { data, etag, status: 200 }
}
export const allGoodsGrants: FunctionCode[] = [
  'stock.receipt.prepare',
  'stock.receipt.post',
  'stock.issue.prepare',
  'stock.issue.post',
  'stock.adjustment.prepare',
  'stock.adjustment.post',
  'returns.prepare',
  'returns.post',
  'documents.correct',
  'documents.cancel',
  'cash.receipt.post',
  'credit.apply',
  'debt.read',
  'stock.count',
]
export function auth(
  grants: FunctionCode[] = allGoodsGrants,
): AuthContextValue {
  return {
    user: {
      id: '1',
      fullName: 'Test operator',
      email: 'test@example.com',
      groupId: 1,
      groupCode: 'TEST',
      groupName: 'Test',
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    allowedFunctions: grants,
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (permission) =>
      Array.isArray(permission)
        ? permission.some((grant) => grants.includes(grant))
        : grants.includes(permission),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }
}
export function renderGoods(component: ReactElement, grants?: FunctionCode[]) {
  return render(
    <AuthContext.Provider value={auth(grants)}>
      {component}
    </AuthContext.Provider>,
  )
}
