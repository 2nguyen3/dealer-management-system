import {
  businessDate,
  catalog,
  decimal,
  id,
  money,
  quantity,
  record,
  text,
  type Row,
} from '../payment_receipts/contracts'

export function master(value: unknown): Row {
  const data = record(value)
  if (typeof data.id !== 'number')
    throw new Error('Expected integer catalogue ID')
  catalog(data.id)
  text(data.code)
  text(data.name)
  if ('status' in data && !['ACTIVE', 'INACTIVE'].includes(text(data.status)))
    throw new Error('Invalid master status')
  for (const field of ['maxDebt']) if (field in data) money(data[field])
  if ('allowsFraction' in data && typeof data.allowsFraction !== 'boolean')
    throw new Error('Invalid fraction policy')
  return data
}

export function product(value: unknown): Row {
  const data = record(value)
  id(data.id)
  catalog(data.unitId)
  text(data.code)
  text(data.name)
  text(data.unitName)
  quantity(data.currentStock)
  quantity(data.lowStockThreshold)
  money(data.currentPurchasePrice)
  decimal(data.currentSellingPrice)
  if (!['ACTIVE', 'INACTIVE'].includes(text(data.status)))
    throw new Error('Invalid product status')
  return data
}

export function agency(value: unknown): Row {
  const data = record(value)
  id(data.id)
  catalog(data.typeId)
  catalog(data.wardId)
  text(data.code)
  text(data.name)
  text(data.email)
  businessDate(data.acceptedDate)
  money(data.currentDebt)
  money(data.currentCredit)
  money(data.remainingCreditLimit)
  if (!['ACTIVE', 'TERMINATED'].includes(text(data.status)))
    throw new Error('Invalid agency status')
  return data
}

export function user(value: unknown): Row {
  const data = record(value)
  id(data.id)
  catalog(data.groupId)
  text(data.fullName)
  text(data.email)
  text(data.groupName)
  if (!['ACTIVE', 'LOCKED'].includes(text(data.status)))
    throw new Error('Invalid user status')
  return data
}
