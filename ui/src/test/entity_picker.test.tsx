import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntityPicker } from '../components/ui/EntityPicker'
import { describeItem, type PickerItem } from '../components/ui/pickerItems'
import * as apiModule from '../lib/api'

const agencies = [
  { id: '70', code: 'DL-70', name: 'Đại lý An Phát', currentDebt: '0' },
  { id: '71', code: 'DL-71', name: 'Đại lý Minh Châu', currentDebt: '500064' },
]

function ok(data: unknown) {
  return Promise.resolve({ data, status: 200, etag: null })
}

function Harness({
  initial = '',
  onPick,
}: {
  initial?: string
  onPick?: (id: string, item: PickerItem | null) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <EntityPicker
      resource="agencies"
      label="Đại lý"
      value={value}
      name="agencyId"
      params={{ status: 'ACTIVE' }}
      onChange={(id, item) => {
        setValue(id)
        onPick?.(id, item)
      }}
    />
  )
}

afterEach(() => vi.restoreAllMocks())

describe('describeItem', () => {
  it('formats each resource and rejects rows without ids', () => {
    expect(describeItem('agencies', agencies[1])).toEqual({
      id: '71',
      label: 'DL-71 — Đại lý Minh Châu',
      detail: 'Dư nợ 500.064 ₫',
    })
    expect(
      describeItem('products', {
        id: 5,
        code: 'SP-5',
        name: 'Bút',
        currentStock: '1500',
        unitName: 'Cái',
      }),
    ).toEqual({ id: '5', label: 'SP-5 — Bút', detail: 'Tồn 1.500 Cái' })
    expect(
      describeItem('stock-issues', {
        id: '9',
        code: 'PX-9',
        agencyName: 'Đại lý A',
        totalAmount: '119850',
      }),
    ).toEqual({ id: '9', label: 'PX-9 — Đại lý A', detail: '119.850 ₫' })
    expect(describeItem('user-groups', { id: 2, name: 'Kho' })?.label).toBe(
      'Kho',
    )
    expect(describeItem('agency-types', { id: 3 })?.label).toBe('#3')
    expect(describeItem('agencies', { code: 'X' })).toBeNull()
    expect(describeItem('agencies', null)).toBeNull()
  })
})

describe('EntityPicker', () => {
  it('searches by text and selects with the keyboard, keeping the raw id', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok({ items: agencies }))
    const onPick = vi.fn()
    const { container } = render(<Harness onPick={onPick} />)
    const input = screen.getByRole('combobox', { name: /Đại lý/ })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Minh' } })
    await screen.findByText('DL-71 — Đại lý Minh Châu')
    const url = String(spy.mock.calls.at(-1)?.[0])
    expect(url).toContain('/agencies?')
    expect(url).toContain('status=ACTIVE')
    expect(url).toContain('limit=20')
    expect(url).toContain('q=Minh')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(
      '71',
      expect.objectContaining({ id: '71' }),
    )
    expect((input as HTMLInputElement).value).toBe('DL-71 — Đại lý Minh Châu')
    const hidden = container.querySelector('input[name="agencyId"]')
    expect((hidden as HTMLInputElement).value).toBe('71')
  })

  it('selects by click and clears back to empty', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(() =>
      ok({ items: agencies }),
    )
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.click(await screen.findByText('DL-70 — Đại lý An Phát'))
    expect(onPick).toHaveBeenLastCalledWith('70', expect.anything())
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn Đại lý' }))
    expect(onPick).toHaveBeenLastCalledWith('', null)
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('resolves the label of an initial id from the detail endpoint', async () => {
    const spy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(() => ok(agencies[0]))
    render(<Harness initial="70" />)
    await waitFor(() =>
      expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
        'DL-70 — Đại lý An Phát',
      ),
    )
    expect(spy).toHaveBeenCalledWith('/agencies/70', expect.anything())
  })

  it('falls back to #id when the detail lookup fails', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(() =>
      Promise.reject(new Error('403')),
    )
    render(<Harness initial="99" />)
    await waitFor(() =>
      expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
        '#99',
      ),
    )
  })

  it('shows empty and failure states, and Escape closes the list', async () => {
    const spy = vi.spyOn(apiModule, 'apiFetch').mockImplementation(() => ok([]))
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    await screen.findByText('Không có kết quả phù hợp.')
    spy.mockImplementation(() => Promise.reject(new Error('down')))
    fireEvent.change(input, { target: { value: 'x' } })
    await screen.findByText('Không tải được danh sách.')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })
})
