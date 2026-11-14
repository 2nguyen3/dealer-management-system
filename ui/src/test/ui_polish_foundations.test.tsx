import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SortableHeader } from '@/components/data/SortControls'
import { nextSort, sortDirection, sortRows } from '@/components/data/sorting'
import { CountUp } from '@/components/motion/Motion'
import {
  daysSince,
  initials,
  PERMISSION_AREAS,
  permissionCoverage,
} from '@/features/profile/profileModel'

describe('sorting helpers', () => {
  it('reads the direction of the contract sort value', () => {
    expect(sortDirection('name', 'name')).toBe('asc')
    expect(sortDirection('-name', 'name')).toBe('desc')
    expect(sortDirection('-currentDebt', 'name')).toBe(false)
    expect(sortDirection('', 'name')).toBe(false)
  })

  it('cycles asc → desc → default, or desc first when asked', () => {
    expect(nextSort('', 'name')).toBe('name')
    expect(nextSort('name', 'name')).toBe('-name')
    expect(nextSort('-name', 'name')).toBe('')
    expect(nextSort('-id', 'name')).toBe('name')
    expect(nextSort('', 'debt', 'desc')).toBe('-debt')
    expect(nextSort('-debt', 'debt', 'desc')).toBe('debt')
    expect(nextSort('debt', 'debt', 'desc')).toBe('')
  })

  it('orders rows locally with nulls last and keeps input untouched', () => {
    const rows = [
      { n: 'Bình', v: 2 },
      { n: 'an', v: null },
      { n: 'Ân', v: 10 },
    ]
    const by = {
      n: (r: (typeof rows)[number]) => r.n,
      v: (r: (typeof rows)[number]) => r.v,
    }
    expect(sortRows(rows, 'v', by).map((r) => r.v)).toEqual([2, 10, null])
    expect(sortRows(rows, '-v', by).map((r) => r.v)).toEqual([10, 2, null])
    expect(sortRows(rows, '', by)).toEqual(rows)
    expect(sortRows(rows, 'unknown', by)).toEqual(rows)
    expect(rows[0]!.n).toBe('Bình')
  })
})

function HeaderHarness() {
  const [sort, setSort] = useState('')
  return (
    <table>
      <thead>
        <tr>
          <SortableHeader
            field="name"
            sort={sort}
            onSort={(field, first) => setSort((s) => nextSort(s, field, first))}
          >
            Tên
          </SortableHeader>
        </tr>
      </thead>
    </table>
  )
}

describe('SortableHeader', () => {
  it('exposes aria-sort and cycles on click', async () => {
    const user = userEvent.setup()
    render(<HeaderHarness />)
    const header = screen.getByRole('columnheader')
    expect(header.getAttribute('aria-sort')).toBe('none')
    await user.click(screen.getByRole('button', { name: 'Tên' }))
    expect(header.getAttribute('aria-sort')).toBe('ascending')
    await user.click(screen.getByRole('button', { name: 'Tên' }))
    expect(header.getAttribute('aria-sort')).toBe('descending')
    await user.click(screen.getByRole('button', { name: 'Tên' }))
    expect(header.getAttribute('aria-sort')).toBe('none')
  })
})

describe('CountUp', () => {
  it('shows the exact final value when motion cannot observe visibility', () => {
    render(<CountUp value={1234} />)
    expect(screen.getByText('1.234')).toBeTruthy()
  })
})

describe('profile model', () => {
  it('builds two-letter initials and handles single or empty names', () => {
    expect(initials('Nguyễn Văn An')).toBe('NA')
    expect(initials('  minh ')).toBe('M')
    expect(initials('')).toBe('?')
  })

  it('computes permission coverage per area', () => {
    const coverage = permissionCoverage(
      new Set(['debt.read', 'sales.read', 'reports.read']),
    )
    const insight = coverage.find((a) => a.key === 'insight')!
    expect(insight).toMatchObject({ granted: 2, total: 2, ratio: 1 })
    expect(coverage.find((a) => a.key === 'admin')!.ratio).toBe(0)
    const all = PERMISSION_AREAS.flatMap((a) => a.codes.map((c) => c.code))
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(22)
    expect(all).not.toContain('district.manage')
  })

  it('counts whole days since an ISO time and rejects invalid input', () => {
    const now = Date.parse('2026-11-12T00:00:00Z')
    expect(daysSince('2026-11-02T00:00:00Z', now)).toBe(10)
    expect(daysSince('2026-12-01T00:00:00Z', now)).toBe(0)
    expect(daysSince('not a date', now)).toBeNull()
  })
})

describe('colour palettes', () => {
  it('accepts only known palettes and falls back to Thủy', async () => {
    const palette = await import('@/components/theme/palette')
    expect(palette.isPalette('moc')).toBe(true)
    expect(palette.isPalette('neon')).toBe(false)
    expect(palette.isPalette(null)).toBe(false)
    localStorage.setItem(palette.PALETTE_STORAGE_KEY, 'neon')
    expect(palette.readStoredPalette()).toBe('thuy')
    localStorage.removeItem(palette.PALETTE_STORAGE_KEY)
    expect(palette.readStoredPalette()).toBe('thuy')
  })

  it('applies the palette to <html> and persists it', async () => {
    const palette = await import('@/components/theme/palette')
    palette.setPalette('tim')
    expect(document.documentElement.dataset.palette).toBe('tim')
    expect(localStorage.getItem(palette.PALETTE_STORAGE_KEY)).toBe('tim')
    palette.resetPaletteCache()
    expect(palette.readStoredPalette()).toBe('tim')
    // An invalid value is ignored and leaves the current palette in place.
    palette.setPalette('neon' as never)
    expect(document.documentElement.dataset.palette).toBe('tim')
    localStorage.removeItem(palette.PALETTE_STORAGE_KEY)
    delete document.documentElement.dataset.palette
  })
})
