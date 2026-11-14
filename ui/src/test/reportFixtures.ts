import type { ReportKind, ReportQuery } from '../features/reports/contracts'

export const huge = '123456789012345678901234567890'
export function reportFixture(
  kind: ReportKind,
  fromDate = '2026-10-01',
  toDate = '2026-11-01',
) {
  const agency = {
    agencyId: '9223372036854775807',
    agencyCode: 'DL-101',
    agencyName: 'Đại lý nguồn',
  }
  const product = {
    productId: '9223372036854775807',
    productCode: 'MH-01',
    productName: 'Mặt hàng nguồn',
    unitId: 1,
    unitName: 'Kg',
  }
  const debt = {
    openingDebt: '-5',
    debtIncrease: huge,
    paidAmount: '1',
    closingDebt: huge,
  }
  const collections = {
    receiptCount: 3,
    cashAmount: '1',
    bankTransferAmount: '2',
    onlineAmount: '0',
    totalAmount: '3',
  }
  const rows = {
    sales: {
      ...agency,
      numberOfIssues: 2,
      salesAmount: huge,
      salesRate: '0.0001',
    },
    debt: { ...agency, ...debt },
    inventory: {
      ...product,
      openingStock: '-0.001',
      receiptQuantity: '0.001',
      issueQuantity: '0',
      closingStock: '0',
    },
    'product-sales': {
      ...product,
      numberOfIssues: 4,
      soldQuantity: '0.001',
      salesAmount: huge,
    },
    collections: { businessDate: '2026-10-05', ...collections },
  }
  const totals = {
    sales: {
      numberOfIssues: 999,
      salesAmount: huge,
      companySalesAmount: huge + '00',
    },
    debt,
    inventory: undefined,
    'product-sales': { salesAmount: huge },
    collections,
  }
  return {
    fromDate,
    toDate,
    generatedAt: '2026-10-30T00:39:22.123456+00:00',
    pagination: {
      limit: 25,
      hasMore: false,
      nextCursor: null as string | null,
    },
    items: [rows[kind]],
    ...(totals[kind] ? { totals: totals[kind] } : {}),
  }
}

export function reportQuery(kind: ReportKind = 'sales'): ReportQuery {
  return {
    kind,
    fromDate: '2026-10-01',
    toDate: '2026-11-01',
    filters: {},
    sort:
      kind === 'inventory'
        ? 'productId'
        : kind === 'product-sales'
          ? '-salesAmount'
          : kind === 'collections'
            ? 'businessDate'
            : 'agencyId',
    limit: '25',
  }
}

export function dashboardFixture() {
  return {
    month: '2026-10',
    asOf: '2026-10-30T07:39:22+00:00',
    agencies: { total: 30, active: 29 },
    sales: {
      salesAmount: huge,
      issueCount: 7,
      monthlyTrend: [
        { month: '2026-09', salesAmount: '100', issueCount: 4 },
        { month: '2026-10', salesAmount: '150', issueCount: 2 },
      ],
      topProducts: reportFixture('product-sales').items,
    },
    collections: {
      receiptCount: 5,
      totalAmount: '600',
      cashAmount: '100',
      bankTransferAmount: '200',
      onlineAmount: '300',
    },
    debt: {
      totalDebt: huge,
      prepaidAmount: '0',
      agenciesInDebt: 12,
      topAgencies: [
        {
          agencyId: '1',
          agencyCode: 'DL-101',
          agencyName: 'Đại lý nguồn',
          debt: '999999999999999999',
          maxDebt: '999999999999999999',
          debtRatio: '99.99',
        },
      ],
    },
    drafts: { stockReceipts: 1, stockIssues: 2, paymentReceipts: 3 },
  }
}
