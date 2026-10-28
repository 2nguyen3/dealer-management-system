/**
 * Formats a raw decimal money string into Vietnamese Dong notation (e.g., "1.500.000 ₫")
 * without coercing the input string through JavaScript Number to prevent precision loss.
 */
export function formatVND(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0 ₫'
  const str = String(value).trim()
  if (!str) return '0 ₫'

  const isNegative = str.startsWith('-')
  const cleanStr = isNegative ? str.slice(1) : str

  const parts = cleanStr.split('.')
  const integerPart = parts[0] || '0'
  const fractionalPart = parts[1]

  // Add thousand separators to integer part from right to left
  let formattedInteger = ''
  let count = 0
  for (let i = integerPart.length - 1; i >= 0; i--) {
    formattedInteger = integerPart[i] + formattedInteger
    count++
    if (count % 3 === 0 && i > 0) {
      formattedInteger = '.' + formattedInteger
    }
  }

  let result = (isNegative ? '-' : '') + formattedInteger
  if (fractionalPart && fractionalPart !== '0' && fractionalPart !== '00') {
    result += ',' + fractionalPart
  }
  return `${result} ₫`
}

/**
 * Formats a quantity value into a readable string without losing precision.
 */
export function formatQuantity(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '0'
  const str = String(value).trim()
  if (!str) return '0'

  const isNegative = str.startsWith('-')
  const cleanStr = isNegative ? str.slice(1) : str

  const parts = cleanStr.split('.')
  const integerPart = parts[0] || '0'
  const fractionalPart = parts[1]

  let formattedInteger = ''
  let count = 0
  for (let i = integerPart.length - 1; i >= 0; i--) {
    formattedInteger = integerPart[i] + formattedInteger
    count++
    if (count % 3 === 0 && i > 0) {
      formattedInteger = '.' + formattedInteger
    }
  }

  let result = (isNegative ? '-' : '') + formattedInteger
  if (fractionalPart) {
    const trimmedFraction = fractionalPart.replace(/0+$/, '')
    if (trimmedFraction.length > 0) {
      result += ',' + trimmedFraction
    }
  }
  return result
}

/**
 * Formats a business date string (YYYY-MM-DD) into Vietnamese display format (DD/MM/YYYY).
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const trimmed = dateStr.trim()
  // Match YYYY-MM-DD
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, year, month, day] = match
    return `${day}/${month}/${year}`
  }
  return dateStr
}

/**
 * Formats an ISO datetime string into DD/MM/YYYY HH:mm.
 */
export function formatDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  try {
    const date = new Date(isoStr)
    if (Number.isNaN(date.getTime())) return isoStr

    // Display in local time or Vietnam timezone
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch {
    return isoStr
  }
}
