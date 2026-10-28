import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  formatVND,
} from '../lib/formatters'

describe('Formatters', () => {
  describe('formatVND', () => {
    it('formats normal monetary values correctly', () => {
      expect(formatVND('1500000')).toBe('1.500.000 ₫')
      expect(formatVND('50000')).toBe('50.000 ₫')
      expect(formatVND('0')).toBe('0 ₫')
      expect(formatVND(null)).toBe('0 ₫')
      expect(formatVND(undefined)).toBe('0 ₫')
    })

    it('preserves exact string representation for arbitrary large amounts without Number precision loss', () => {
      // 1.2e18 exceeds Number.MAX_SAFE_INTEGER (9e15)
      const largeAmount = '1200000000000000000'
      const formatted = formatVND(largeAmount)
      expect(formatted).toBe('1.200.000.000.000.000.000 ₫')
    })

    it('handles negative monetary values properly', () => {
      expect(formatVND('-250000')).toBe('-250.000 ₫')
    })

    it('handles fractional amounts if present', () => {
      expect(formatVND('1500000.50')).toBe('1.500.000,50 ₫')
    })
  })

  describe('formatQuantity', () => {
    it('formats integer and fractional quantities without precision loss', () => {
      expect(formatQuantity('100')).toBe('100')
      expect(formatQuantity('1234.5')).toBe('1.234,5')
      expect(formatQuantity('1234.5000')).toBe('1.234,5')
      expect(formatQuantity('0')).toBe('0')
    })

    it('formats negative quantities', () => {
      expect(formatQuantity('-15.25')).toBe('-15,25')
    })
  })

  describe('formatDate', () => {
    it('converts YYYY-MM-DD into DD/MM/YYYY', () => {
      expect(formatDate('2026-10-18')).toBe('18/10/2026')
      expect(formatDate('2026-06-01')).toBe('01/06/2026')
    })

    it('handles empty or missing dates cleanly', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate('')).toBe('—')
    })
  })

  describe('formatDateTime', () => {
    it('converts ISO timestamp into readable Vietnamese date-time', () => {
      const formatted = formatDateTime('2026-10-18T09:30:00Z')
      expect(formatted).toMatch(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}/)
    })
  })
})
