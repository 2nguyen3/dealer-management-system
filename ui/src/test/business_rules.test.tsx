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
      data: { maxAgenciesPerWard: 4, sellingPriceRate: '1.020000' },
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

  it('edits the per-ward agency capacity and saves maxAgenciesPerWard', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockImplementation(async (_path, options) => ({
        data:
          options?.method === 'PATCH'
            ? { maxAgenciesPerWard: 5, sellingPriceRate: '1.020000' }
            : { maxAgenciesPerWard: 4, sellingPriceRate: '1.020000' },
        etag: '"r1"',
        status: 200,
      }))
    render(<BusinessRulesPage />)
    const capacity = screen.getByLabelText(
      /Số đại lý tối đa mỗi phường\/xã/,
    ) as HTMLInputElement
    await waitFor(() => expect(capacity.value).toBe('4'))
    expect(screen.getByText('Đại lý tối đa / phường/xã')).toBeDefined()
    expect(document.body.textContent).not.toMatch(/quận/i)
    fireEvent.change(capacity, { target: { value: '5' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Lưu thay đổi quy định' }),
    )
    await waitFor(() =>
      expect(
        fetch.mock.calls.find(([, options]) => options?.method === 'PATCH'),
      ).toBeDefined(),
    )
    const patch = fetch.mock.calls.find(
      ([, options]) => options?.method === 'PATCH',
    )!
    expect(patch[1]?.body).toEqual({
      maxAgenciesPerWard: 5,
      sellingPriceRate: '1.020000',
    })
    await waitFor(() => expect(capacity.value).toBe('5'))
  })

  it('rejects a capacity of zero before calling the server', async () => {
    const fetch = vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: { maxAgenciesPerWard: 4, sellingPriceRate: '1.020000' },
      etag: '"r1"',
      status: 200,
    })
    render(<BusinessRulesPage />)
    const capacity = screen.getByLabelText(
      /Số đại lý tối đa mỗi phường\/xã/,
    ) as HTMLInputElement
    await waitFor(() => expect(capacity.value).toBe('4'))
    fireEvent.change(capacity, { target: { value: '0' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Lưu thay đổi quy định' }),
    )
    await waitFor(() =>
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0),
    )
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === 'PATCH'),
    ).toBe(false)
  })

  it('fails closed when the server omits maxAgenciesPerWard', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: { sellingPriceRate: '1.020000' },
      etag: '"r1"',
      status: 200,
    })
    render(<BusinessRulesPage />)
    await waitFor(() =>
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0),
    )
    const capacity = screen.getByLabelText(
      /Số đại lý tối đa mỗi phường\/xã/,
    ) as HTMLInputElement
    expect(capacity.value).toBe('')
  })
})
