import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessRulesPage } from '../features/business_rules/BusinessRulesPage'
import * as api from '../lib/api'

const access = vi.hoisted(() => ({ manage: true }))
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => access.manage }),
}))

const rules = {
  data: { maxAgenciesPerDistrict: 4, sellingPriceRate: '1.020000' },
  etag: '"r1"',
  status: 200,
}

describe('BusinessRulesPage layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    access.manage = true
  })

  it('marks a read-only account and disables both rule inputs', async () => {
    access.manage = false
    vi.spyOn(api, 'apiFetch').mockResolvedValue(rules)
    render(<BusinessRulesPage />)
    const rate = screen.getByLabelText('Hệ số giá bán') as HTMLInputElement
    await waitFor(() => expect(rate.value).toBe('1.020000'))
    expect(screen.getByText('Chỉ xem')).toBeTruthy()
    expect(rate.disabled).toBe(true)
    expect(
      (screen.getByLabelText(/Số đại lý tối đa/) as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Lưu thay đổi quy định' }),
    ).toBeNull()
  })

  it('rejects an invalid rate before any PATCH', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue(rules)
    render(<BusinessRulesPage />)
    const rate = screen.getByLabelText('Hệ số giá bán') as HTMLInputElement
    await waitFor(() => expect(rate.value).toBe('1.020000'))
    fireEvent.change(rate, { target: { value: '0' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Lưu thay đổi quy định' }),
    )
    expect(
      await screen.findByText(
        'Hệ số phải dương, tối đa 3 chữ số nguyên và 6 chữ số lẻ.',
      ),
    ).toBeTruthy()
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === 'PATCH'),
    ).toBe(false)
  })
})
