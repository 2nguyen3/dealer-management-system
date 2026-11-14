import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import type {
  ChainItem,
  DocumentDetail,
  DocumentKind,
  DocumentLine,
  DocumentSummary,
} from '../features/document_history/documentContracts'
import type { FunctionCode } from '../lib/types'
import { LocationProbe } from './LocationProbe'

export const timestamp = '2026-11-10T01:00:00Z'
/** Vietnam business day the document tests run on (see `useToday`). */
export const TODAY = '2026-11-14'
/** Fakes only `Date` so posted documents of November are in the open month. */
export function useToday() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${TODAY}T03:00:00Z`))
}

const prefixes: Record<DocumentKind, string> = {
  STOCK_RECEIPT: 'PN',
  STOCK_ISSUE: 'PX',
  PAYMENT_RECEIPT: 'PT',
}

export function line(overrides: Partial<DocumentLine> = {}): DocumentLine {
  return {
    id: '201',
    lineNo: 1,
    productId: '301',
    productCode: 'SP-301',
    productName: 'Historical product',
    unitId: 1,
    unitName: 'Hộp',
    quantity: '1.001',
    unitPrice: '900719925474099301',
    lineAmount: '900719925474099301',
    ...overrides,
  }
}

export function detail(
  kind: DocumentKind = 'STOCK_RECEIPT',
  overrides: Partial<DocumentDetail> = {},
): DocumentDetail {
  const agency = kind !== 'STOCK_RECEIPT'
  const payment = kind === 'PAYMENT_RECEIPT'
  return {
    id: '1',
    code: `${prefixes[kind]}-1`,
    kind,
    status: 'DRAFT',
    businessDate: '2026-11-10',
    agencyId: agency ? '401' : null,
    agencyCode: agency ? 'DL-401' : null,
    agencyName: agency ? 'Đại lý An Phát' : null,
    receiptType: payment ? 'CASH' : null,
    totalAmount: payment ? '300000' : '900719925474099301',
    lineCount: payment ? 0 : 1,
    note: 'Original note',
    replacesDocumentId: null,
    replacedByDocumentId: null,
    createdBy: '1',
    createdByName: 'Test operator',
    postedBy: null,
    postedByName: null,
    postedAt: null,
    cancelledAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    cancelReason: null,
    sellingPriceRate: kind === 'STOCK_ISSUE' ? '1.02' : null,
    cancelledBy: null,
    cancelledByName: null,
    replaces: null,
    replacedBy: null,
    onlinePaymentId: null,
    agencyDebt: agency ? '500000' : null,
    agencyMaxDebt: agency ? '1000000' : null,
    lines: payment ? [] : [line()],
    ...overrides,
  }
}

/** A posted copy of `detail` (current month, cancellable). */
export function posted(
  kind: DocumentKind = 'STOCK_RECEIPT',
  overrides: Partial<DocumentDetail> = {},
): DocumentDetail {
  return detail(kind, {
    status: 'POSTED',
    postedBy: '1',
    postedByName: 'Test operator',
    postedAt: '2026-11-10T02:00:00Z',
    ...overrides,
  })
}

export function summary(doc: DocumentDetail = detail()): DocumentSummary {
  return {
    id: doc.id,
    code: doc.code,
    kind: doc.kind,
    status: doc.status,
    businessDate: doc.businessDate,
    agencyId: doc.agencyId,
    agencyCode: doc.agencyCode,
    agencyName: doc.agencyName,
    receiptType: doc.receiptType,
    totalAmount: doc.totalAmount,
    lineCount: doc.lineCount,
    note: doc.note,
    replacesDocumentId: doc.replacesDocumentId,
    replacedByDocumentId: doc.replacedByDocumentId,
    createdBy: doc.createdBy,
    createdByName: doc.createdByName,
    postedBy: doc.postedBy,
    postedByName: doc.postedByName,
    postedAt: doc.postedAt,
    cancelledAt: doc.cancelledAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export function chainItem(doc: DocumentDetail = detail()): ChainItem {
  return { ...summary(doc), cancelReason: doc.cancelReason }
}

export function agency(overrides: Record<string, unknown> = {}) {
  return {
    id: '401',
    code: 'DL-401',
    name: 'Đại lý An Phát',
    status: 'ACTIVE',
    debt: '500000',
    maxDebt: '1000000',
    remainingCreditLimit: '500000',
    ...overrides,
  }
}

export function product(overrides: Record<string, unknown> = {}) {
  return {
    id: '301',
    code: 'SP-301',
    name: 'Bút bi',
    unitName: 'Cây',
    status: 'ACTIVE',
    stock: '10',
    lastPurchasePrice: '1000',
    sellingPrice: '1020',
    allowsFraction: false,
    ...overrides,
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
  'cash.receipt.prepare',
  'cash.receipt.post',
  'documents.correct',
  'documents.cancel',
  'agency.read',
  'debt.read',
  'sales.read',
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

/**
 * Renders inside auth and a memory router (the workbench reads the URL). The
 * component lives at `url`'s path; any other path shows only the location.
 */
export function renderGoods(
  component: ReactElement,
  grants?: FunctionCode[],
  url = '/',
) {
  return render(
    <AuthContext.Provider value={auth(grants)}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path={url.split('?')[0]}
            element={
              <>
                {component}
                <LocationProbe />
              </>
            }
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

export function currentLocation() {
  return document.querySelector('[data-testid="location"]')?.textContent ?? ''
}
