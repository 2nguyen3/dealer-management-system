import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryPage } from '../features/inventory/InventoryPage'
import * as api from '../lib/api'
import { renderGoods, response } from './goodsFixtures'

const products = [
  {
    id: '1',
    code: 'SP-1',
    name: 'Bút bi',
    unitName: 'Cây',
    currentStock: '1500.5',
    lowStockThreshold: '10',
  },
  {
    id: '2',
    code: 'SP-2',
    name: 'Giấy A4',
    unitName: 'Ram',
    currentStock: '9.999',
    lowStockThreshold: '10',
  },
  // The server flag wins over the local comparison.
  {
    id: '3',
    code: 'SP-3',
    name: 'Mực in',
    unitName: 'Hộp',
    currentStock: '50',
    lowStockThreshold: '10',
    isLowStock: true,
  },
  // Malformed rows are skipped instead of breaking the overview.
  { id: '4', code: 'SP-4' },
]

function rowOf(code: string) {
  return screen.getByText(code).closest('tr')!
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path === '/products?limit=100&sort=name')
        return response({
          items: products,
          pagination: { limit: 100, hasMore: true, nextCursor: 'next' },
        })
      if (path.startsWith('/products?'))
        return response({ items: products.slice(0, 2) })
      const single = /^\/products\/(\d+)$/.exec(path)
      if (single)
        return response(products.find((item) => item.id === single[1]))
      throw new api.ApiError(503, 'DOWN', 'Statement unavailable')
    })
  })

  it('shows a formatted stock overview with low-stock badges', async () => {
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('SP-1')
    expect(api.apiFetch).toHaveBeenCalledWith(
      '/products?limit=100&sort=name',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(screen.getByText('1.500,5').className).toContain('cell-number')
    expect(screen.getByText('9,999')).toBeDefined()
    expect(screen.queryByText('1500.5')).toBeNull()
    expect(within(rowOf('SP-1')).getByText('Đủ hàng')).toBeDefined()
    expect(within(rowOf('SP-2')).getByText('Sắp hết')).toBeDefined()
    expect(within(rowOf('SP-3')).getByText('Sắp hết')).toBeDefined()
    expect(screen.queryByText('SP-4')).toBeNull()
    expect(screen.getByText(/3 mặt hàng · 2 sắp hết/)).toBeDefined()
    expect(screen.getByText(/100 mặt hàng đầu tiên/)).toBeDefined()
    expect(screen.queryByLabelText('ID mặt hàng')).toBeNull()
  })

  it('clicking a row loads that product stock card', async () => {
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('SP-2')
    fireEvent.click(rowOf('SP-2'))
    await screen.findByRole('heading', { name: 'Thẻ kho: SP-2 — Giấy A4' })
    expect(rowOf('SP-2').className).toContain('is-selected')
    await waitFor(() =>
      expect(
        vi
          .mocked(api.apiFetch)
          .mock.calls.some(([path]) =>
            path.startsWith('/products/2/inventory-entries?'),
          ),
      ).toBe(true),
    )
  })

  it('the row button and the product picker select the same flow', async () => {
    renderGoods(<InventoryPage />, ['inventory.read'])
    const button = await screen.findByRole('button', {
      name: 'Xem thẻ kho SP-1',
    })
    expect(button.textContent).toBe('Thẻ kho')
    fireEvent.click(button)
    await screen.findByRole('heading', { name: 'Thẻ kho: SP-1 — Bút bi' })
    const picker = screen.getByRole('combobox', { name: /Mặt hàng/ })
    expect((picker as HTMLInputElement).value).toBe('SP-1 — Bút bi')
    fireEvent.focus(picker)
    fireEvent.click(await screen.findByText('SP-2 — Giấy A4'))
    await screen.findByRole('heading', { name: 'Thẻ kho: SP-2 — Giấy A4' })
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn Mặt hàng' }))
    expect(screen.queryByRole('heading', { name: /Thẻ kho:/ })).toBeNull()
  })

  it('reports overview failures with a retry', async () => {
    vi.mocked(api.apiFetch).mockRejectedValueOnce(new Error('Mất kết nối'))
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText(/Không tải được tồn kho\. Mất kết nối/)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('SP-1')
  })

  it('does not load anything without inventory.read', () => {
    renderGoods(<InventoryPage />, ['product.manage'])
    expect(screen.getByRole('alert').textContent).toContain(
      'không có quyền xem tồn kho',
    )
    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it('shows KPI tiles, an exact stock value and a value chart with table view', async () => {
    const priced = [
      { ...products[0], currentPurchasePrice: '2000' },
      { ...products[1], currentPurchasePrice: '100000' },
      products[2],
    ]
    vi.mocked(api.apiFetch).mockResolvedValue(
      response({
        items: priced,
        pagination: { limit: 100, hasMore: false, nextCursor: null },
      }),
    )
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('SP-1')
    const kpis = screen.getByRole('region', { name: 'Chỉ số tồn kho' })
    // 1500.5 × 2000 + 9.999 × 100000 = 3 001 000 + 999 900.
    expect(within(kpis).getByText(/4\.000\.900 ₫/)).toBeDefined()
    expect(within(kpis).getByText('Theo giá nhập hiện hành')).toBeDefined()
    expect(within(kpis).getByText('Toàn bộ danh mục')).toBeDefined()
    expect(within(rowOf('SP-1')).getByText('3.001.000 ₫')).toBeDefined()
    expect(within(rowOf('SP-3')).getAllByText('—').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('radio', { name: 'Bảng số liệu' }))
    const table = screen.getByRole('table', {
      name: 'Giá trị tồn kho theo mặt hàng',
    })
    const cells = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)
    expect(cells).toEqual([
      'Bút bi (SP-1)3.001.000 ₫',
      'Giấy A4 (SP-2)999.900 ₫',
    ])
  })

  it('without prices the value KPI and chart explain the missing data', async () => {
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('SP-1')
    expect(screen.getByText('Chưa có giá nhập để tính')).toBeDefined()
    expect(
      screen.getByText('Chưa có mặt hàng nào có giá nhập để tính giá trị tồn.'),
    ).toBeDefined()
    expect(screen.getByText('Tính trên 100 mặt hàng đầu')).toBeDefined()
  })

  it('filters to low stock from the KPI tile, the segment and the search box', async () => {
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('SP-1')
    fireEvent.click(
      screen.getByRole('button', { name: 'Lọc theo Sắp hết hàng' }),
    )
    expect(screen.queryByText('SP-1')).toBeNull()
    expect(screen.getByText('SP-2')).toBeDefined()
    expect(
      screen
        .getByRole('radio', { name: 'Sắp hết' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Tất cả' }))
    expect(screen.getByText('SP-1')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Lọc theo mã hoặc tên'), {
      target: { value: 'mực' },
    })
    expect(screen.queryByText('SP-1')).toBeNull()
    expect(screen.getByText('SP-3')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Lọc theo mã hoặc tên'), {
      target: { value: 'không-có' },
    })
    expect(screen.getByText('Không có mặt hàng khớp bộ lọc.')).toBeDefined()
    // No server request is made for client-side filtering.
    expect(api.apiFetch).toHaveBeenCalledTimes(1)
  })

  it('lists low-stock products with a level bar and opens their stock card', async () => {
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('SP-1')
    expect(screen.getByText('9,999 / 10 Ram')).toBeDefined()
    expect(
      screen
        .getByRole('progressbar', { name: 'Mức tồn SP-1' })
        .getAttribute('aria-valuenow'),
    ).toBe('100')
    expect(
      screen
        .getByRole('progressbar', { name: 'Mức tồn SP-2' })
        .getAttribute('aria-valuenow'),
    ).toBe('49')
    fireEvent.click(screen.getByRole('button', { name: /^Giấy A4/ }))
    await screen.findByRole('heading', { name: 'Thẻ kho: SP-2 — Giấy A4' })
  })

  it('shows an empty state when the catalogue has no products', async () => {
    vi.mocked(api.apiFetch).mockResolvedValue(
      response({
        items: [],
        pagination: { limit: 100, hasMore: false, nextCursor: null },
      }),
    )
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('Chưa có mặt hàng.')
    expect(screen.getByText(/^0 mặt hàng$/)).toBeDefined()
  })
})
