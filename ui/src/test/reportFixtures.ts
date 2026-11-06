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
  const sales = { salesAmount: huge, returnAmount: '1', netSalesAmount: '-1' }
  const debt = {
    openingDebt: huge,
    debtIncrease: '0',
    cashApplied: '0',
    returnsApplied: '0',
    creditApplied: '0',
    debtDecrease: '0',
    closingDebt: huge,
  }
  const cash = {
    cashReceived: huge,
    cashRefunded: '1',
    verifiedUnreceiptedAmount: '2',
    openingCredit: '3',
    creditCreated: '4',
    creditApplied: '5',
    creditRefunded: '6',
    closingCredit: '7',
    currentReservedCredit: '8',
    currentAvailableCredit: '9',
  }
  const rows = {
    sales: { ...agency, ...sales, numberOfIssues: 2, salesRate: '0.0001' },
    debt: { ...agency, ...debt },
    inventory: {
      ...product,
      openingStock: '0',
      receiptQuantity: '0.001',
      issueQuantity: '0',
      returnQuantity: '0',
      adjustmentQuantity: '-0.001',
      closingStock: '0',
    },
    'product-sales': {
      ...product,
      ...sales,
      soldQuantity: '0.001',
      returnedQuantity: '2.003',
    },
    'cash-and-credit': { ...agency, ...cash },
  }
  const totals = {
    sales: { ...sales, numberOfIssues: 999, companyGrossSales: huge + '00' },
    debt,
    inventory: undefined,
    'product-sales': sales,
    'cash-and-credit': cash,
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
          : 'agencyId',
    limit: '25',
  }
}

export function dashboardFixture() {
  return {
    month: '2026-10',
    asOf: '2026-10-30T07:39:22+00:00',
    agencies: { total: 30, active: 29 },
    inventory: {
      productCount: 24,
      lowStockProductCount: 2,
      receivedAmount: huge,
    },
    sales: {
      gross: huge,
      returns: '1',
      net: '-1',
      monthlyTrend: [
        { month: '2026-10', gross: huge, returns: '1', net: '-1' },
      ],
      topProducts: reportFixture('product-sales').items,
    },
    receivables: {
      currentDebt: huge,
      currentCredit: '1',
      cashReceived: '2',
      cashRefunded: '3',
      topAgencies: [
        {
          agencyId: '1',
          agencyCode: 'DL-101',
          agencyName: 'Đại lý nguồn',
          currentDebt: '999999999999999999',
        },
      ],
    },
    pendingIssueCount: 0,
    verifiedUnreceiptedAmount: '0',
  }
}
