import { t } from '@/lib/i18n/core'
// Runtime projection of the mounted reports schemas. Numeric strings stay strings.
export type Rule = (value: unknown) => boolean
export const text: Rule = (v) => typeof v === 'string'
export const count: Rule = (v) => Number.isSafeInteger(v) && (v as number) >= 0
export const money: Rule = (v) =>
  typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v)
export const signedMoney: Rule = (v) =>
  typeof v === 'string' && /^-?(0|[1-9][0-9]*)$/.test(v)
export const quantity: Rule = (v) =>
  typeof v === 'string' && /^(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/.test(v)
export const signedQuantity: Rule = (v) =>
  typeof v === 'string' && /^-?(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/.test(v)
export const id: Rule = (v) =>
  typeof v === 'string' &&
  /^[1-9][0-9]{0,18}$/.test(v) &&
  BigInt(v) <= 9223372036854775807n
export const catalogId: Rule = (v) =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 2147483647
export const month: Rule = (v) =>
  typeof v === 'string' && /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(v)
export const businessDate: Rule = (v) => {
  if (typeof v !== 'string' || !/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))
    return false
  const date = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v
}
export const instant: Rule = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) &&
  businessDate(v.slice(0, 10)) &&
  !Number.isNaN(Date.parse(v))

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(t('Dữ liệu máy chủ không đúng hợp đồng.'))
  return value as Record<string, unknown>
}

export function fields(
  value: unknown,
  rules: Record<string, Rule>,
): Record<string, unknown> {
  const result = record(value)
  if (
    Object.keys(result).some((key) => !(key in rules)) ||
    Object.entries(rules).some(([key, rule]) => !rule(result[key]))
  )
    throw new Error(t('Dữ liệu máy chủ không đúng hợp đồng.'))
  return result
}

export function vietnamMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`
}

export type ReportKind =
  'sales' | 'debt' | 'inventory' | 'product-sales' | 'cash-and-credit'
export type ReportRow = Record<string, string | number>
export interface ReportPage {
  fromDate: string
  toDate: string
  generatedAt: string
  items: ReportRow[]
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
  totals?: ReportRow
}

export const agencyIdentity = {
  agencyId: id,
  agencyCode: text,
  agencyName: text,
}
export const productIdentity = {
  productId: id,
  productCode: text,
  productName: text,
  unitId: catalogId,
  unitName: text,
}
export const salesAmounts = {
  salesAmount: money,
  returnAmount: money,
  netSalesAmount: signedMoney,
}
export const debtAmounts = {
  openingDebt: money,
  debtIncrease: money,
  cashApplied: money,
  returnsApplied: money,
  creditApplied: money,
  debtDecrease: money,
  closingDebt: money,
}
export const cashAmounts = {
  cashReceived: money,
  cashRefunded: money,
  verifiedUnreceiptedAmount: money,
  openingCredit: money,
  creditCreated: money,
  creditApplied: money,
  creditRefunded: money,
  closingCredit: money,
  currentReservedCredit: money,
  currentAvailableCredit: money,
}
export const productSalesRules = {
  ...productIdentity,
  ...salesAmounts,
  soldQuantity: quantity,
  returnedQuantity: quantity,
}
export const rowRules: Record<ReportKind, Record<string, Rule>> = {
  sales: {
    ...agencyIdentity,
    ...salesAmounts,
    numberOfIssues: count,
    salesRate: (v) =>
      typeof v === 'string' &&
      /^(?:(?:0|[1-9][0-9]?)(?:\.[0-9]{1,4})?|100(?:\.0{1,4})?)$/.test(v),
  },
  debt: { ...agencyIdentity, ...debtAmounts },
  inventory: {
    ...productIdentity,
    openingStock: quantity,
    receiptQuantity: quantity,
    issueQuantity: quantity,
    returnQuantity: quantity,
    adjustmentQuantity: signedQuantity,
    closingStock: quantity,
  },
  'product-sales': productSalesRules,
  'cash-and-credit': { ...agencyIdentity, ...cashAmounts },
}
const totalRules: Partial<Record<ReportKind, Record<string, Rule>>> = {
  sales: { ...salesAmounts, numberOfIssues: count, companyGrossSales: money },
  debt: debtAmounts,
  'product-sales': salesAmounts,
  'cash-and-credit': cashAmounts,
}

export function parseReport(
  value: unknown,
  kind: ReportKind,
  fromDate: string,
  toDate: string,
): ReportPage {
  const source = record(value)
  fields(source, {
    fromDate: businessDate,
    toDate: businessDate,
    generatedAt: instant,
    items: Array.isArray,
    pagination: (v) => !!v && typeof v === 'object',
    ...(totalRules[kind]
      ? { totals: (v: unknown) => !!v && typeof v === 'object' }
      : {}),
  })
  if (source.fromDate !== fromDate || source.toDate !== toDate)
    throw new Error(t('Kỳ báo cáo máy chủ không khớp yêu cầu.'))
  const pagination = fields(source.pagination, {
    limit: (v) => count(v) && (v as number) >= 1 && (v as number) <= 100,
    hasMore: (v) => typeof v === 'boolean',
    nextCursor: (v) => v === null || (typeof v === 'string' && v.length > 0),
  })
  if (
    pagination.hasMore !== (pagination.nextCursor !== null) ||
    (source.items as unknown[]).length > (pagination.limit as number)
  )
    throw new Error(t('Phân trang máy chủ không hợp lệ.'))
  for (const item of source.items as unknown[]) fields(item, rowRules[kind])
  const totals = totalRules[kind]
  if (totals) fields(source.totals, totals)
  return source as unknown as ReportPage
}

export const reports: Record<
  ReportKind,
  { label: string; permission: string; filters: string[]; sorts: string[] }
> = {
  sales: {
    label: t('Doanh số đại lý (BM6.1)'),
    permission: 'sales.read',
    filters: ['agencyId', 'typeId'],
    sorts: [
      'agencyId',
      '-agencyId',
      'salesAmount',
      '-salesAmount',
      'netSalesAmount',
      '-netSalesAmount',
    ],
  },
  debt: {
    label: t('Công nợ (BM6.2)'),
    permission: 'debt.read',
    filters: ['agencyId', 'typeId', 'wardId'],
    sorts: ['agencyId', '-agencyId', 'closingDebt', '-closingDebt'],
  },
  inventory: {
    label: t('Xuất nhập tồn'),
    permission: 'inventory.read',
    filters: ['productId'],
    sorts: ['productId', '-productId', 'closingStock', '-closingStock'],
  },
  'product-sales': {
    label: t('Doanh số mặt hàng'),
    permission: 'sales.read',
    filters: ['productId', 'agencyId'],
    sorts: [
      '-salesAmount',
      'salesAmount',
      'productId',
      '-productId',
      'soldQuantity',
      '-soldQuantity',
    ],
  },
  'cash-and-credit': {
    label: t('Thu chi và dư có'),
    permission: 'debt.read',
    filters: ['agencyId'],
    sorts: [
      'agencyId',
      '-agencyId',
      'cashReceived',
      '-cashReceived',
      'closingCredit',
      '-closingCredit',
    ],
  },
}

export const labels: Record<string, string> = {
  agencyId: 'ID',
  agencyCode: t('Mã đại lý'),
  agencyName: t('Tên đại lý'),
  productId: t('ID mặt hàng'),
  productCode: t('Mã hàng'),
  productName: t('Mặt hàng'),
  unitId: t('ID đơn vị'),
  unitName: t('Đơn vị'),
  typeId: t('ID loại đại lý'),
  wardId: t('ID phường/xã'),
  numberOfIssues: t('Số phiếu xuất'),
  salesAmount: t('Doanh số gộp (VND)'),
  returnAmount: t('Trả hàng (VND)'),
  netSalesAmount: t('Doanh số thuần (VND)'),
  salesRate: t('Tỷ lệ (%)'),
  companyGrossSales: t('Doanh số gộp toàn doanh nghiệp (VND)'),
  openingDebt: t('Nợ đầu kỳ (VND)'),
  debtIncrease: t('Tăng nợ (VND)'),
  cashApplied: t('Tiền giảm nợ (VND)'),
  returnsApplied: t('Trả hàng giảm nợ (VND)'),
  creditApplied: t('Dư có đã bù trừ (VND)'),
  debtDecrease: t('Tổng giảm nợ (VND)'),
  closingDebt: t('Nợ cuối kỳ (VND)'),
  openingStock: t('Tồn đầu'),
  receiptQuantity: t('Nhập'),
  issueQuantity: t('Xuất'),
  returnQuantity: t('Trả'),
  adjustmentQuantity: t('Điều chỉnh có dấu'),
  closingStock: t('Tồn cuối'),
  soldQuantity: t('Số lượng bán'),
  returnedQuantity: t('Số lượng trả'),
  cashReceived: t('Tiền thực thu (VND)'),
  cashRefunded: t('Tiền thực hoàn (VND)'),
  verifiedUnreceiptedAmount: t('Đã xác minh chưa ghi phiếu thu (VND)'),
  openingCredit: t('Dư có đầu kỳ (VND)'),
  creditCreated: t('Dư có phát sinh (VND)'),
  creditRefunded: t('Dư có đã hoàn (VND)'),
  closingCredit: t('Dư có cuối kỳ (VND)'),
  currentReservedCredit: t('Dư có đang dành hiện tại (VND)'),
  currentAvailableCredit: t('Dư có khả dụng hiện tại (VND)'),
}

export interface ReportQuery {
  kind: ReportKind
  fromDate: string
  toDate: string
  filters: Record<string, string>
  sort: string
  limit: string
}

export function reportPath(
  query: ReportQuery,
  cursor: string | null = null,
  exporting = false,
): string {
  if (
    !businessDate(query.fromDate) ||
    !businessDate(query.toDate) ||
    query.fromDate >= query.toDate
  )
    throw new Error(
      t(
        'Chọn khoảng ngày hợp lệ [từ ngày, đến ngày), không bao gồm ngày cuối.',
      ),
    )
  const params = new URLSearchParams({
    fromDate: query.fromDate,
    toDate: query.toDate,
  })
  for (const key of reports[query.kind].filters) {
    const value = query.filters[key]
    if (!value) continue
    const valid =
      key === 'typeId' || key === 'wardId'
        ? /^[1-9][0-9]{0,9}$/.test(value) && BigInt(value) <= 2147483647n
        : id(value)
    if (!valid)
      throw new Error(
        t('{value} không hợp lệ.', {
          value: key === 'agencyId' ? t('ID đại lý') : labels[key],
        }),
      )
    params.set(key, value)
  }
  if (!exporting) {
    if (
      !reports[query.kind].sorts.includes(query.sort) ||
      !/^[1-9][0-9]?$|^100$/.test(query.limit)
    )
      throw new Error(t('Điều khiển phân trang không hợp lệ.'))
    params.set('sort', query.sort)
    params.set('limit', query.limit)
    if (cursor) params.set('cursor', cursor)
  }
  return `/reports/${query.kind}?${params}`
}
