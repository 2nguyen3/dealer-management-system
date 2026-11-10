/**
 * Exact display-only arithmetic for document lines and stock values. Inputs are
 * the server's decimal strings (quantities with up to three decimals, whole-VND
 * prices); BigInt keeps 18-digit amounts exact. Results are estimates shown to
 * the operator — the server stays the authority for every posted amount.
 */
const QUANTITY = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/
const MONEY = /^(0|[1-9][0-9]*)$/

/** Quantity scaled by 1000 (thousandths), or null when not a valid decimal. */
export function scaledQuantity(value: string): bigint | null {
  const match = QUANTITY.exec(value.trim())
  if (!match) return null
  const [, sign, whole = '0', fraction = ''] = match
  const scaled = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'))
  return sign ? -scaled : scaled
}

/** quantity × unitPrice rounded half away from zero to whole VND. */
export function lineAmount(quantity: string, unitPrice: string): bigint | null {
  const scaled = scaledQuantity(quantity)
  if (scaled === null || !MONEY.test(unitPrice.trim())) return null
  const raw = scaled * BigInt(unitPrice.trim())
  const magnitude = raw < 0n ? -raw : raw
  const rounded = (magnitude + 500n) / 1000n
  return raw < 0n ? -rounded : rounded
}

/** Sum of amounts; null entries are skipped. */
export function sumAmounts(values: readonly (bigint | null)[]): bigint {
  return values.reduce<bigint>((total, value) => total + (value ?? 0n), 0n)
}

/** Sign of a decimal quantity string: 1, -1, 0, or null when invalid. */
export function quantitySign(value: string): 1 | -1 | 0 | null {
  const scaled = scaledQuantity(value)
  if (scaled === null) return null
  return scaled === 0n ? 0 : scaled > 0n ? 1 : -1
}
