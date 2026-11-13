import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditLogsPage } from '../features/audit_logs/AuditLogsPage'
import { changedKeys, entityLabel } from '../features/audit_logs/auditLabels'
import * as api from '../lib/api'
import { formatDateTime } from '../lib/formatters'

const row = {
  id: '7',
  actorId: null,
  actorType: 'SYSTEM',
  functionCode: 'agency.manage',
  action: 'INSERT',
  entityName: 'agency',
  entityKey: '12',
  oldData: null,
  newData: { name: 'Đại lý A', status: 'ACTIVE' },
  requestId: null,
  createdAt: '2026-10-09T03:40:00Z',
}

function page(items: unknown[]) {
  return {
    data: {
      items,
      pagination: { limit: 25, nextCursor: null, hasMore: false },
    },
    etag: null,
    status: 200,
  }
}

describe('audit labels', () => {
  it('names known tables in Vietnamese, with or without schema/plural', () => {
    expect(entityLabel('document')).toBe('Chứng từ')
    expect(entityLabel('documents')).toBe('Chứng từ')
    expect(entityLabel('dms.app_user')).toBe('Tài khoản')
  })

  it('labels wards and marks historical district rows as legacy', () => {
    expect(entityLabel('ward')).toBe('Phường/xã')
    expect(entityLabel('dms.wards')).toBe('Phường/xã')
    expect(entityLabel('district')).toBe('Quận (cũ)')
    expect(entityLabel('dms.districts')).toBe('Quận (cũ)')
  })

  it('keeps unknown or empty table names unchanged', () => {
    expect(entityLabel('mystery_table')).toBe('mystery_table')
    expect(entityLabel(undefined)).toBe('')
  })

  it('lists changed top-level keys, treating missing snapshots as empty', () => {
    expect(
      changedKeys({ a: 1, b: { c: 1 }, d: 2 }, { a: 1, b: { c: 2 }, e: 3 }),
    ).toEqual(['b', 'd', 'e'])
    expect(changedKeys(null, { x: 1 })).toEqual(['x'])
    expect(changedKeys([1], 'text')).toEqual([])
    expect(changedKeys({ same: [1, 2] }, { same: [1, 2] })).toEqual([])
  })
})

describe('AuditLogsPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders readable actor, table and action labels with dd/MM/yyyy HH:mm', async () => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) =>
      path === '/audit-logs/7'
        ? { data: row, etag: null, status: 200 }
        : page([row]),
    )
    render(<AuditLogsPage />)
    const tr = (await screen.findByText('agency.manage')).closest('tr')!
    const cells = within(tr)
    expect(cells.getByText('Hệ thống')).toBeTruthy()
    expect(cells.getByText('Đại lý')).toBeTruthy()
    expect(cells.getByText('Tạo mới')).toBeTruthy()
    expect(
      cells.getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/).textContent,
    ).toBe(formatDateTime(row.createdAt))

    fireEvent.click(cells.getByRole('button', { name: 'Xem' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Trường thay đổi:')).toBeTruthy()
    expect(within(dialog).getByText('name')).toBeTruthy()
    expect(within(dialog).getByText('status')).toBeTruthy()
    const blocks = dialog.querySelectorAll('pre.finance-json')
    expect(blocks[0]?.textContent).toBe('Không có dữ liệu.')
  })

  it('shows an empty state, and a detail failure inside the dialog', async () => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path === '/audit-logs/7') throw new Error('Không tải được nhật ký')
      return page(path.includes('action=DELETE') ? [] : [row])
    })
    render(<AuditLogsPage />)
    const tr = (await screen.findByText('agency.manage')).closest('tr')!
    fireEvent.click(within(tr).getByRole('button', { name: 'Xem' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText('Không tải được nhật ký'),
    ).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }),
    )
    fireEvent.change(
      screen.getByLabelText('Hành động', { selector: 'select' }),
      {
        target: { value: 'DELETE' },
      },
    )
    expect(await screen.findByText('Không có nhật ký phù hợp.')).toBeTruthy()
  })
})
