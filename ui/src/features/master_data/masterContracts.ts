import {
  businessDate,
  catalog,
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
  quantity(data.stock)
  // Both prices stay null until the product's first posted receipt.
  if (data.lastPurchasePrice !== null) money(data.lastPurchasePrice)
  if (data.sellingPrice !== null) money(data.sellingPrice)
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
  businessDate(data.acceptedDate)
  // Debt is negative only after a late verified online payment (prepaid).
  signedMoney(data.debt)
  money(data.maxDebt)
  signedMoney(data.remainingCreditLimit)
  if (!['ACTIVE', 'TERMINATED'].includes(text(data.status)))
    throw new Error('Invalid agency status')
  return data
}

function signedMoney(value: unknown): string {
  const result = text(value)
  if (!/^-?(0|[1-9][0-9]{0,17})$/.test(result))
    throw new Error('Invalid signed VND amount')
  return result
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
