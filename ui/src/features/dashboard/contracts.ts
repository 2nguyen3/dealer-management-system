import {
  count,
  fields,
  id,
  instant,
  money,
  month,
  productSalesRules,
  record,
  text,
  type ReportRow,
  type Rule,
} from '../reports/contracts'
import { t } from '@/lib/i18n/core'

/** Any of these grants admits `GET /dashboard` (contract admission list). */
export const dashboardAdmission = [
  'agency.read',
  'cash.receipt.post',
  'cash.receipt.prepare',
  'debt.read',
  'sales.read',
  'stock.issue.post',
  'stock.issue.prepare',
  'stock.receipt.post',
  'stock.receipt.prepare',
]
/** Grants that make the server include each optional dashboard section. */
export const sectionGrants = {
  agencies: ['agency.read'],
  sales: ['sales.read'],
  collections: ['debt.read', 'cash.receipt.post'],
  debt: ['debt.read'],
  drafts: [
    'stock.receipt.prepare',
    'stock.receipt.post',
    'stock.issue.prepare',
    'stock.issue.post',
    'cash.receipt.prepare',
    'cash.receipt.post',
  ],
}

export interface MonthlySalesPoint {
  month: string
  salesAmount: string
  issueCount: number
}

export interface AgencyDebtPoint {
  agencyId: string
  agencyCode: string
  agencyName: string
  /** Current debt; negative when the agency has prepaid. */
  debt: string
  maxDebt: string
  /** Debt as a percentage of maxDebt (≤ 2 decimals), null when maxDebt is 0. */
  debtRatio: string | null
}

export interface Dashboard {
  month: string
  asOf: string
  agencies?: { total: number; active: number }
  sales?: {
    salesAmount: string
    issueCount: number
    monthlyTrend: MonthlySalesPoint[]
    topProducts: ReportRow[]
  }
  collections?: {
    receiptCount: number
    totalAmount: string
    cashAmount: string
    bankTransferAmount: string
    onlineAmount: string
  }
  debt?: {
    totalDebt: string
    prepaidAmount: string
    agenciesInDebt: number
    topAgencies: AgencyDebtPoint[]
  }
  drafts?: {
    stockReceipts?: number
    stockIssues?: number
    paymentReceipts?: number
  }
}

function objectRule(
  rules: Record<string, Rule>,
  optional: string[] = [],
): Rule {
  return (value) => {
    const source = record(value)
    const present = Object.fromEntries(
      Object.entries(rules).filter(
        ([key]) => !optional.includes(key) || key in source,
      ),
    )
    fields(source, present)
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

const debtRatio: Rule = (v) =>
  v === null ||
  (typeof v === 'string' && /^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(v))

export function parseDashboard(
  value: unknown,
  requestedMonth: string,
): Dashboard {
  const source = record(value)
  const optional: Record<string, Rule> = {
    agencies: objectRule({ total: count, active: count }),
    sales: objectRule({
      salesAmount: money,
      issueCount: count,
      monthlyTrend: arrayRule(
        { month, salesAmount: money, issueCount: count },
        12,
      ),
      topProducts: arrayRule(productSalesRules, 10),
    }),
    collections: objectRule({
      receiptCount: count,
      totalAmount: money,
      cashAmount: money,
      bankTransferAmount: money,
      onlineAmount: money,
    }),
    debt: objectRule({
      totalDebt: money,
      prepaidAmount: money,
      agenciesInDebt: count,
      topAgencies: arrayRule(
        {
          agencyId: id,
          agencyCode: text,
          agencyName: text,
          debt: (v) =>
            typeof v === 'string' && /^-?(0|[1-9][0-9]{0,17})$/.test(v),
          maxDebt: (v) =>
            typeof v === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(v),
          debtRatio,
        },
        10,
      ),
    }),
    drafts: objectRule(
      { stockReceipts: count, stockIssues: count, paymentReceipts: count },
      ['stockReceipts', 'stockIssues', 'paymentReceipts'],
    ),
  }
  const rules: Record<string, Rule> = { month, asOf: instant }
  for (const [name, rule] of Object.entries(optional))
    if (name in source) rules[name] = rule
  fields(source, rules)
  if (source.month !== requestedMonth)
    throw new Error(t('Tháng dữ liệu máy chủ không khớp yêu cầu.'))
  return source as unknown as Dashboard
}
