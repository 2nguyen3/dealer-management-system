import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from '../components/ui/StatusBadge'
import {
  auditActionLabel,
  enumOptions,
  kindLabel,
  methodLabel,
  receiptTypeLabel,
  statusLabel,
  statusTone,
} from '../lib/labels'

describe('labels', () => {
  it('maps known server values to Vietnamese', () => {
    expect(statusLabel('POSTED')).toBe('Đã ghi sổ')
    expect(statusLabel('CANCELED')).toBe(statusLabel('CANCELLED'))
    expect(kindLabel('STOCK_ISSUE')).toBe('Phiếu xuất hàng')
    expect(methodLabel('BANK_TRANSFER')).toBe('Chuyển khoản')
    expect(receiptTypeLabel('ONLINE')).toBe('Trực tuyến (VNPAY)')
    expect(kindLabel('PAYMENT_RECEIPT')).toBe('Phiếu thu tiền')
    // Kinds and statuses of removed features fall back to the raw value.
    expect(kindLabel('REFUND')).toBe('REFUND')
    expect(statusLabel('READY')).toBe('READY')
    expect(auditActionLabel('INSERT')).toBe('Tạo mới')
  })

  it('falls back to the raw value or a dash at the boundaries', () => {
    expect(statusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
    expect(kindLabel(null)).toBe('—')
    expect(methodLabel(undefined)).toBe('—')
    expect(statusLabel('')).toBe('—')
  })

  it('assigns tones, neutral for unknown values', () => {
    expect(statusTone('POSTED')).toBe('success')
    expect(statusTone('PENDING')).toBe('warning')
    expect(statusTone('CANCELLED')).toBe('danger')
    expect(statusTone('NOPE')).toBe('neutral')
    expect(statusTone(undefined)).toBe('neutral')
  })

  it('builds select options with and without an "all" entry', () => {
    expect(enumOptions(['DRAFT', 'POSTED'], statusLabel, 'Tất cả')).toEqual([
      { value: '', label: 'Tất cả' },
      { value: 'DRAFT', label: 'Nháp' },
      { value: 'POSTED', label: 'Đã ghi sổ' },
    ])
    expect(enumOptions([], statusLabel)).toEqual([])
  })
})

describe('StatusBadge', () => {
  it('renders the Vietnamese label, tone and raw value', () => {
    render(<StatusBadge status="PENDING" suffix="v2" />)
    const badge = screen.getByText('Chờ xử lý · v2')
    expect(badge.getAttribute('data-status')).toBe('PENDING')
    expect(badge.className).toContain('badge--warning')
  })

  it('renders a dash for a missing status', () => {
    render(<StatusBadge status={null} />)
    expect(screen.getByText('—').getAttribute('data-status')).toBe('')
  })
})
