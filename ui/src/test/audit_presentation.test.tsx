import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { AuditLogsPage } from '../features/audit_logs/AuditLogsPage'
import * as apiModule from '../lib/api'
import { formatDateTime } from '../lib/formatters'
import type { FunctionCode } from '../lib/types'

const permissions: FunctionCode[] = ['audit.read']

const auth: AuthContextValue = {
  user: null,
  allowedFunctions: permissions,
  isAuthenticated: true,
  isLoading: false,
  hasPermission: (perm) =>
    Array.isArray(perm)
      ? perm.some((p) => permissions.includes(p))
      : permissions.includes(perm),
  login: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
}

const pageOf = (items: unknown[]) => ({
  data: {
    items,
    pagination: { limit: 25, nextCursor: null, hasMore: false },
  },
  status: 200,
  etag: null,
})

const auditRow = {
  id: '91',
  actorId: '4',
  actorType: 'USER',
  functionCode: 'cash.receipt.post',
  action: 'UPDATE',
  entityName: 'documents',
  entityKey: '501',
  oldData: { status: 'DRAFT' },
  newData: { status: 'POSTED' },
  requestId: 'req-abc',
  createdAt: '2026-10-09T03:40:00Z',
  updatedAt: '2026-10-09T03:40:00Z',
}

const renderPage = (ui: ReactNode) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path) => {
    if (path === '/audit-logs/91')
      return { data: auditRow, status: 200, etag: null }
    if (path.startsWith('/audit-logs')) return pageOf([auditRow])
    return pageOf([])
  })
})

describe('AuditLogsPage presentation', () => {
  it('shows Vietnamese action/actor labels, formatted time and detail', async () => {
    renderPage(<AuditLogsPage />)
    const row = (await screen.findByText('cash.receipt.post')).closest('tr')!
    const cells = within(row)
    expect(cells.getByText('Cập nhật')).toBeDefined()
    expect(cells.getByText('Người dùng #4')).toBeDefined()
    expect(cells.getByText(formatDateTime(auditRow.createdAt))).toBeDefined()
    expect(screen.queryByText('UPDATE')).toBeNull()
    const action = screen.getByLabelText('Hành động', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(action.options).map((o) => [o.value, o.text])).toEqual([
      ['', 'Tất cả'],
      ['INSERT', 'Tạo mới'],
      ['UPDATE', 'Cập nhật'],
      ['DELETE', 'Xóa'],
    ])
    expect(screen.queryByLabelText('Request ID')).toBeNull()

    fireEvent.click(cells.getByRole('button', { name: 'Xem' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('req-abc')).toBeDefined()
    const blocks = dialog.querySelectorAll('pre.finance-json')
    expect(blocks.length).toBe(2)
    expect(blocks[1]?.textContent).toContain('"POSTED"')
  })
})
