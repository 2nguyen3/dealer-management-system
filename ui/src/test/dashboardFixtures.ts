import { vi } from 'vitest'
import * as api from '../lib/api'

export const HUGE = '123456789012345678901234567890'

const agencies = [
  { agencyId: '1', agencyCode: 'DL-01', agencyName: 'Đại lý An Phú' },
  { agencyId: '2', agencyCode: 'DL-02', agencyName: 'Đại lý Bình Minh' },
]
const products = [
  {
    productId: '11',
    productCode: 'MH-01',
    productName: 'Gạo thơm',
    unitId: 1,
    unitName: 'Kg',
  },
  {
    productId: '12',
    productCode: 'MH-02',
    productName: 'Dầu ăn',
    unitId: 2,
    unitName: 'Chai',
  },
]

export function snapshotFixture(month: string) {
  return {
    month,
    asOf: '2026-10-30T07:39:22+00:00',
    agencies: { total: 30, active: 24 },
    sales: {
      salesAmount: '1500',
      issueCount: 12,
      monthlyTrend: [
        { month: shift(month, -1), salesAmount: '1000', issueCount: 8 },
        { month, salesAmount: '1500', issueCount: 12 },
      ],
      topProducts: [
        {
          ...products[0],
          numberOfIssues: 5,
          soldQuantity: '9',
          salesAmount: '900',
        },
      ],
    },
    collections: {
      receiptCount: 6,
      totalAmount: '700',
      cashAmount: '400',
      bankTransferAmount: '200',
      onlineAmount: '100',
    },
    debt: {
      totalDebt: HUGE,
      prepaidAmount: '50',
      agenciesInDebt: 17,
      topAgencies: [
        {
          ...agencies[0],
          debt: '999999999999999999',
          maxDebt: '999999999999999999',
          debtRatio: '100',
        },
        {
          ...agencies[1],
          debt: '-50',
          maxDebt: '1000',
          debtRatio: null,
        },
      ],
    },
    drafts: { stockReceipts: 1, stockIssues: 2, paymentReceipts: 3 },
  }
}

export function shift(month: string, offset: number): string {
  const [y = 0, m = 1] = month.split('-').map(Number)
  const index = y * 12 + m - 1 + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

function rowsFor(kind: string, params: URLSearchParams) {
  const agencyId = params.get('agencyId')
  const productId = params.get('productId')
  const byAgency = <T extends { agencyId: string }>(rows: T[]) =>
    agencyId ? rows.filter((row) => row.agencyId === agencyId) : rows
  switch (kind) {
    case 'sales':
      return {
        items: byAgency([
          {
            ...agencies[1]!,
            numberOfIssues: 6,
            salesAmount: '1200',
            salesRate: '60',
          },
          {
            ...agencies[0]!,
            numberOfIssues: 3,
            salesAmount: '800',
            salesRate: '40',
          },
        ]),
        totals: {
          numberOfIssues: 9,
          salesAmount: '2000',
          companySalesAmount: '2000',
        },
      }
    case 'debt': {
      const debt = (closing: string) => ({
        openingDebt: '100',
        debtIncrease: '500',
        paidAmount: '0',
        closingDebt: closing,
      })
      return {
        items: byAgency([
          { ...agencies[0]!, ...debt('7000') },
          { ...agencies[1]!, ...debt('3000') },
        ]),
        totals: { ...debt('10000'), openingDebt: '200', debtIncrease: '1000' },
      }
    }
    case 'product-sales': {
      const rows = [
        {
          ...products[0]!,
          numberOfIssues: 7,
          soldQuantity: '13',
          salesAmount: '1300',
        },
        {
          ...products[1]!,
          numberOfIssues: 2,
          soldQuantity: '7',
          salesAmount: '700',
        },
      ].filter((row) => !productId || row.productId === productId)
      return { items: rows, totals: { salesAmount: '2000' } }
    }
    case 'collections': {
      const amounts =
        agencyId === '2'
          ? { cash: '100', bank: '0', online: '0' }
          : { cash: '400', bank: '200', online: '100' }
      const total = String(
        Number(amounts.cash) + Number(amounts.bank) + Number(amounts.online),
      )
      const day = {
        businessDate: '2026-10-05',
        receiptCount: 2,
        cashAmount: amounts.cash,
        bankTransferAmount: amounts.bank,
        onlineAmount: amounts.online,
        totalAmount: total,
      }
      return {
        items: [day],
        totals: {
          receiptCount: 2,
          cashAmount: amounts.cash,
          bankTransferAmount: amounts.bank,
          onlineAmount: amounts.online,
          totalAmount: total,
        },
      }
    }
    default:
      return {
        items: products
          .filter((row) => !productId || row.productId === productId)
          .map((row, index) => ({
            ...row,
            openingStock: '10',
            receiptQuantity: '5',
            issueQuantity: '3',
            closingStock: String(12 - index * 10),
          })),
      }
  }
}

export function reportResponse(path: string, empty = false) {
  const url = new URL(path, 'http://test')
  const kind = url.pathname.replace('/reports/', '')
  const limit = Number(url.searchParams.get('limit') ?? 25)
  const { items, ...rest } = rowsFor(kind, url.searchParams)
  const totals =
    'totals' in rest && rest.totals
      ? empty
        ? Object.fromEntries(
            Object.entries(rest.totals).map(([key, value]) => [
              key,
              typeof value === 'number' ? 0 : '0',
            ]),
          )
        : rest.totals
      : undefined
  return {
    fromDate: url.searchParams.get('fromDate'),
    toDate: url.searchParams.get('toDate'),
    generatedAt: '2026-10-30T07:39:22+00:00',
    items: empty ? [] : items.slice(0, limit),
    pagination: { limit, hasMore: false, nextCursor: null },
    ...(totals ? { totals } : {}),
  }
}

export type Responder = (path: string) => unknown

/** Routes every dashboard request to a fixture; override per path prefix. */
export function mockDashboardApi(overrides: Record<string, Responder> = {}) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
    for (const [prefix, respond] of Object.entries(overrides))
      if (path.startsWith(prefix)) {
        const data = respond(path)
        if (data instanceof Error) throw data
        return { data, status: 200, etag: null } as never
      }
    let data: unknown
    if (path.startsWith('/dashboard'))
      data = snapshotFixture(
        new URL(path, 'http://test').searchParams.get('month')!,
      )
    else if (path.startsWith('/reports/')) data = reportResponse(path)
    else if (path.startsWith('/agency-types'))
      data = { items: [{ id: 3, code: 'LDL-1', name: 'Loại 1' }] }
    else if (path.startsWith('/wards'))
      data = {
        items: [{ id: 5, code: '26740', name: 'Phường Sài Gòn', kind: 'WARD' }],
        pagination: { limit: 20, nextCursor: null, hasMore: false },
      }
    else if (path.startsWith('/agencies/'))
      data = { id: '2', code: 'DL-02', name: 'Đại lý Bình Minh' }
    else data = { items: [] }
    return { data, status: 200, etag: null } as never
  })
}

export function callsTo(prefix: string): URLSearchParams[] {
  return vi
    .mocked(api.apiFetch)
    .mock.calls.map(([path]) => path)
    .filter((path) => path.startsWith(prefix))
    .map((path) => new URL(path, 'http://test').searchParams)
}
