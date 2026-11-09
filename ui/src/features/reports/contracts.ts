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
    throw new Error('Dữ liệu máy chủ không đúng hợp đồng.')
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
    throw new Error('Dữ liệu máy chủ không đúng hợp đồng.')
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
    throw new Error('Kỳ báo cáo máy chủ không khớp yêu cầu.')
  const pagination = fields(source.pagination, {
    limit: (v) => count(v) && (v as number) >= 1 && (v as number) <= 100,
    hasMore: (v) => typeof v === 'boolean',
    nextCursor: (v) => v === null || (typeof v === 'string' && v.length > 0),
  })
  if (
    pagination.hasMore !== (pagination.nextCursor !== null) ||
    (source.items as unknown[]).length > (pagination.limit as number)
  )
    throw new Error('Phân trang máy chủ không hợp lệ.')
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
    label: 'Doanh số đại lý (BM6.1)',
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
    label: 'Công nợ (BM6.2)',
    permission: 'debt.read',
    filters: ['agencyId', 'typeId', 'districtId'],
    sorts: ['agencyId', '-agencyId', 'closingDebt', '-closingDebt'],
  },
  inventory: {
    label: 'Xuất nhập tồn',
    permission: 'inventory.read',
    filters: ['productId'],
    sorts: ['productId', '-productId', 'closingStock', '-closingStock'],
  },
  'product-sales': {
    label: 'Doanh số mặt hàng',
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
    label: 'Thu chi và dư có',
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
  agencyCode: 'Mã đại lý',
  agencyName: 'Tên đại lý',
  productId: 'ID mặt hàng',
  productCode: 'Mã hàng',
  productName: 'Mặt hàng',
  unitId: 'ID đơn vị',
  unitName: 'Đơn vị',
  typeId: 'ID loại đại lý',
  districtId: 'ID quận',
  numberOfIssues: 'Số phiếu xuất',
  salesAmount: 'Doanh số gộp (VND)',
  returnAmount: 'Trả hàng (VND)',
  netSalesAmount: 'Doanh số thuần (VND)',
  salesRate: 'Tỷ lệ (%)',
  companyGrossSales: 'Doanh số gộp toàn doanh nghiệp (VND)',
  openingDebt: 'Nợ đầu kỳ (VND)',
  debtIncrease: 'Tăng nợ (VND)',
  cashApplied: 'Tiền giảm nợ (VND)',
  returnsApplied: 'Trả hàng giảm nợ (VND)',
  creditApplied: 'Dư có đã bù trừ (VND)',
  debtDecrease: 'Tổng giảm nợ (VND)',
  closingDebt: 'Nợ cuối kỳ (VND)',
  openingStock: 'Tồn đầu',
  receiptQuantity: 'Nhập',
  issueQuantity: 'Xuất',
  returnQuantity: 'Trả',
  adjustmentQuantity: 'Điều chỉnh có dấu',
  closingStock: 'Tồn cuối',
  soldQuantity: 'Số lượng bán',
  returnedQuantity: 'Số lượng trả',
  cashReceived: 'Tiền thực thu (VND)',
  cashRefunded: 'Tiền thực hoàn (VND)',
  verifiedUnreceiptedAmount: 'Đã xác minh chưa ghi phiếu thu (VND)',
  openingCredit: 'Dư có đầu kỳ (VND)',
  creditCreated: 'Dư có phát sinh (VND)',
  creditRefunded: 'Dư có đã hoàn (VND)',
  closingCredit: 'Dư có cuối kỳ (VND)',
  currentReservedCredit: 'Dư có đang dành hiện tại (VND)',
  currentAvailableCredit: 'Dư có khả dụng hiện tại (VND)',
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
      'Chọn khoảng ngày hợp lệ [từ ngày, đến ngày), không bao gồm ngày cuối.',
    )
  const params = new URLSearchParams({
    fromDate: query.fromDate,
    toDate: query.toDate,
  })
  for (const key of reports[query.kind].filters) {
    const value = query.filters[key]
    if (!value) continue
    const valid =
      key === 'typeId' || key === 'districtId'
        ? /^[1-9][0-9]{0,9}$/.test(value) && BigInt(value) <= 2147483647n
        : id(value)
    if (!valid) throw new Error(`${labels[key]} không hợp lệ.`)
    params.set(key, value)
  }
  if (!exporting) {
    if (
      !reports[query.kind].sorts.includes(query.sort) ||
      !/^[1-9][0-9]?$|^100$/.test(query.limit)
    )
      throw new Error('Điều khiển phân trang không hợp lệ.')
    params.set('sort', query.sort)
    params.set('limit', query.limit)
    if (cursor) params.set('cursor', cursor)
  }
  return `/reports/${query.kind}?${params}`
}
