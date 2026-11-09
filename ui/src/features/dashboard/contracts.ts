import {
  agencyIdentity,
  count,
  fields,
  instant,
  money,
  month,
  productSalesRules,
  record,
  signedMoney,
  type ReportRow,
  type Rule,
} from '../reports/contracts'

export const dashboardAdmission = [
  'agency.read',
  'inventory.read',
  'sales.read',
  'debt.read',
  'stock.issue.post',
  'cash.upfront.verify',
]
export const sectionGrants = {
  agencies: ['agency.read'],
  inventory: ['inventory.read'],
  sales: ['sales.read'],
  receivables: ['debt.read'],
  pendingIssueCount: ['stock.issue.post', 'stock.issue.prepare'],
  verifiedUnreceiptedAmount: ['cash.upfront.verify', 'cash.receipt.post'],
}
export interface Dashboard {
  month: string
  asOf: string
  agencies?: { total: number; active: number }
  inventory?: {
    productCount: number
    lowStockProductCount: number
    receivedAmount: string
  }
  sales?: {
    gross: string
    returns: string
    net: string
    monthlyTrend: {
      month: string
      gross: string
      returns: string
      net: string
    }[]
    topProducts: ReportRow[]
  }
  receivables?: {
    currentDebt: string
    currentCredit: string
    cashReceived: string
    cashRefunded: string
    topAgencies: {
      agencyId: string
      agencyCode: string
      agencyName: string
      currentDebt: string
    }[]
  }
  pendingIssueCount?: number
  verifiedUnreceiptedAmount?: string
}

function objectRule(rules: Record<string, Rule>): Rule {
  return (value) => {
    fields(value, rules)
    return true
  }
}

function arrayRule(rules: Record<string, Rule>, max: number): Rule {
  return (value) =>
    Array.isArray(value) &&
    value.length <= max &&
    value.every((item) => {
      fields(item, rules)
      return true
    })
}

export function parseDashboard(
  value: unknown,
  requestedMonth: string,
): Dashboard {
  const source = record(value)
  const optional = {
    agencies: objectRule({ total: count, active: count }),
    inventory: objectRule({
      productCount: count,
      lowStockProductCount: count,
      receivedAmount: money,
    }),
    sales: objectRule({
      gross: money,
      returns: money,
      net: signedMoney,
      monthlyTrend: arrayRule(
        { month, gross: money, returns: money, net: signedMoney },
        12,
      ),
      topProducts: arrayRule(productSalesRules, 10),
    }),
    receivables: objectRule({
      currentDebt: money,
      currentCredit: money,
      cashReceived: money,
      cashRefunded: money,
      topAgencies: arrayRule(
        {
          ...agencyIdentity,
          currentDebt: (v) =>
            typeof v === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(v),
        },
        10,
      ),
    }),
    pendingIssueCount: count,
    verifiedUnreceiptedAmount: money,
  }
  const rules: Record<string, Rule> = { month, asOf: instant }
  for (const [name, rule] of Object.entries(optional))
    if (name in source) rules[name] = rule
  fields(source, rules)
  if (source.month !== requestedMonth)
    throw new Error('Tháng dữ liệu máy chủ không khớp yêu cầu.')
  return source as unknown as Dashboard
}
