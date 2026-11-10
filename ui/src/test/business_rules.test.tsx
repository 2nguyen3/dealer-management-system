import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessRulesPage } from '../features/business_rules/BusinessRulesPage'
import * as api from '../lib/api'

vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

describe('BusinessRulesPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows plain labels and reloads without submitting the form', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: { maxAgenciesPerDistrict: 4, sellingPriceRate: '1.020000' },
      etag: '"r1"',
      status: 200,
    })
    render(<BusinessRulesPage />)
    const rate = screen.getByLabelText('Hệ số giá bán') as HTMLInputElement
    await waitFor(() => expect(rate.value).toBe('1.020000'))
    expect(screen.queryByText(/sellingPriceRate/)).toBeNull()
    expect(screen.getByText(/Giá bán = giá nhập × 1,02\./)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại quy định' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls.every(([path]) => path === '/business-rules')).toBe(
      true,
    )
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === 'PATCH'),
    ).toBe(false)
  })
})
