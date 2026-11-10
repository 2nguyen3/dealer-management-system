import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChartCard } from '../components/blocks/ChartCard'
import { DateField } from '../components/blocks/DateField'
import { KpiCard } from '../components/blocks/KpiCard'
import { PageHeader } from '../components/blocks/PageHeader'
import {
  chartColor,
  formatCompactVND,
  percentChange,
  toNumber,
} from '../lib/chart'

describe('chart helpers', () => {
  it('parses decimals and falls back to zero', () => {
    expect(toNumber('1250.50')).toBe(1250.5)
    expect(toNumber('abc')).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber('')).toBe(0)
  })

  it('computes period change and refuses a zero base', () => {
    expect(percentChange(120, 100)).toBeCloseTo(0.2)
    expect(percentChange(80, 100)).toBeCloseTo(-0.2)
    expect(percentChange(5, 0)).toBeNull()
  })

  it('assigns palette slots in order and mutes overflow', () => {
    expect(chartColor(0)).toBe('var(--chart-1)')
    expect(chartColor(7)).toBe('var(--chart-8)')
    expect(chartColor(8)).toBe('var(--muted-foreground)')
    expect(formatCompactVND(0)).toContain('₫')
  })
})

describe('KpiCard', () => {
  it('shows value, good/bad delta and exact value for assistive tech', () => {
    render(
      <KpiCard
        label="Doanh thu"
        value="1,2 Tr ₫"
        exactValue="1.200.000 ₫"
        delta={{ ratio: 0.25, label: 'so với tháng trước' }}
      />,
    )
    expect(screen.getByText('Doanh thu')).toBeTruthy()
    expect(screen.getByText(/1\.200\.000 ₫/)).toBeTruthy()
    expect(screen.getByText(/\+25/).className).toContain('text-emerald-700')
  })

  it('marks an increase as bad when upIsGood is false and hides null ratios', () => {
    const { rerender } = render(
      <KpiCard
        label="Công nợ"
        value="5"
        delta={{ ratio: 0.1, upIsGood: false }}
      />,
    )
    expect(screen.getByText(/\+10/).className).toContain('text-red-700')
    rerender(
      <KpiCard
        label="Công nợ"
        value="5"
        delta={{ ratio: null, label: 'mới' }}
      />,
    )
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.getByText('mới')).toBeTruthy()
  })

  it('acts as a toggle button when clickable', () => {
    const onClick = vi.fn()
    render(<KpiCard label="Đại lý" value="30" onClick={onClick} active />)
    const button = screen.getByRole('button', { name: 'Lọc theo Đại lý' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('ChartCard', () => {
  it('switches between chart and table views', () => {
    render(
      <ChartCard title="Doanh thu" table={<table aria-label="bảng" />}>
        <div>chart-body</div>
      </ChartCard>,
    )
    expect(screen.getByText('chart-body')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Bảng số liệu' }))
    expect(screen.queryByText('chart-body')).toBeNull()
    expect(screen.getByRole('table', { name: 'bảng' })).toBeTruthy()
  })

  it('renders the empty state instead of the chart', () => {
    render(
      <ChartCard title="Tồn kho" isEmpty>
        <div>chart-body</div>
      </ChartCard>,
    )
    expect(screen.queryByText('chart-body')).toBeNull()
    expect(screen.getByText(/Chưa có dữ liệu/)).toBeTruthy()
  })
})

describe('DateField', () => {
  it('displays dd/MM/yyyy while keeping the ISO value, and clears', () => {
    const onChange = vi.fn()
    render(<DateField label="Từ ngày" value="2026-09-05" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /05\/09\/2026/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Từ ngày' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('shows the placeholder for empty/invalid values and an error', () => {
    render(
      <DateField
        label="Đến ngày"
        value="2026-13-45"
        onChange={() => {}}
        error="Ngày không hợp lệ"
        required
      />,
    )
    expect(
      screen
        .getByRole('button', { name: /dd\/mm\/yyyy/ })
        .getAttribute('aria-invalid'),
    ).toBe('true')
    expect(screen.getByRole('alert').textContent).toContain('Ngày không hợp lệ')
    expect(screen.queryByRole('button', { name: /Xóa/ })).toBeNull()
  })
})

describe('PageHeader', () => {
  it('renders heading, description and actions', () => {
    render(
      <PageHeader
        title="Báo cáo"
        description="Tổng hợp"
        actions={<button type="button">Xuất</button>}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Báo cáo' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xuất' })).toBeTruthy()
  })
})

describe('IllustratedFigure', () => {
  it('embeds the static figure sandboxed, lazily, with a title and skeleton until load', async () => {
    const { IllustratedFigure } =
      await import('../components/blocks/IllustratedFigure')
    const { container } = render(
      <IllustratedFigure name="forklift.html" title="Xe nâng" />,
    )
    const frame = screen.getByTitle('Xe nâng')
    expect(frame.getAttribute('src')).toBe('/figures/forklift.html')
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.getAttribute('loading')).toBe('lazy')
    expect(frame.className).toContain('opacity-0')
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    fireEvent.load(frame)
    expect(frame.className).toContain('opacity-100')
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()
  })
})
