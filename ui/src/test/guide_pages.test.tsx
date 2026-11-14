import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { StockIssuesPage } from '../features/stock_issues/StockIssuesPage'
import { UpfrontPaymentsPage } from '../features/upfront_payments/UpfrontPaymentsPage'
import * as api from '../lib/api'
import * as cache from '../lib/cache'
import type { FunctionCode } from '../lib/types'
import {
  allGoodsGrants,
  detail,
  page,
  renderGoods,
  response,
  revision,
  summary,
} from './goodsFixtures'

vi.mock('../components/blocks/DateField', async () => {
  const React = await import('react')
  return {
    DateField: ({
      label,
      value,
      onChange,
    }: {
      label?: string
      value: string
      onChange: (value: string) => void
    }) =>
      React.createElement('input', {
        'aria-label': label,
        value,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value),
      }),
  }
})

function readyIssue(upfrontConfirmationId: string | null) {
  return detail('STOCK_ISSUE', {
    status: 'PENDING',
    upfrontConfirmationId,
    currentRevision: revision({
      state: 'READY',
      totalAmount: '5000000',
      immediatePayment: '1250000',
    }),
  })
}

function mockIssue(doc: ReturnType<typeof readyIssue>, upfront?: string) {
  vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
    response(page([summary(doc)])),
  )
  vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
    if (path.startsWith('/upfront-confirmations/'))
      return response({ id: '31', state: upfront ?? 'VERIFIED' }, null)
    return response(doc)
  })
}

async function openDetail() {
  fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết PX-1' }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(cache, 'invalidateCache').mockImplementation(() => {})
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('stock issue guidance', () => {
  it('blocks posting until the upfront payment is verified and deep-links the form', async () => {
    mockIssue(readyIssue(null))
    renderGoods(<StockIssuesPage />, [...allGoodsGrants, 'cash.upfront.verify'])
    const dialog = await openDetail()
    const rail = await within(dialog).findByTestId('workflow-steps')
    expect(
      [...rail.querySelectorAll('li')].map((li) => li.dataset.state),
    ).toEqual(['done', 'done', 'current', 'blocked'])
    const next = within(dialog).getByTestId('next-action')
    expect(next.textContent).toContain('Xác nhận khoản trả ngay 1.250.000 ₫')
    expect(
      within(next)
        .getByRole('link', { name: /Mở form xác nhận/ })
        .getAttribute('href'),
    ).toBe('/upfront-payments?issue=1&new=1')
    const post = screen.getByRole('button', { name: 'Ghi sổ' })
    expect((post as HTMLButtonElement).disabled).toBe(true)
    expect(
      post.closest('[data-locked-reason]')?.getAttribute('data-locked-reason'),
    ).toMatch(/Chưa có xác nhận trả ngay 1\.250\.000 ₫/)
  })

  it('warns that replacing the content needs a new upfront confirmation', async () => {
    mockIssue(readyIssue(null))
    renderGoods(<StockIssuesPage />)
    await openDetail()
    const replace = screen.getByRole('button', {
      name: 'Thay nội dung chờ xuất',
    })
    expect((replace as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(replace)
    expect(await screen.findByText('Cần xác nhận trả ngay lại')).toBeDefined()
  })

  it('unlocks posting but refuses replacing once the upfront money is verified', async () => {
    mockIssue(readyIssue('31'), 'VERIFIED')
    renderGoods(<StockIssuesPage />)
    await openDetail()
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Thay nội dung chờ xuất',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    )
    expect(
      (screen.getByRole('button', { name: 'Ghi sổ' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    expect(
      document
        .querySelector('[data-locked-reason]')
        ?.getAttribute('data-locked-reason'),
    ).toMatch(/Ghi nhận tiền riêng/)
    expect(api.apiFetch).toHaveBeenCalledWith(
      '/upfront-confirmations/31',
      expect.anything(),
    )
  })

  it('tells a warehouse user without verify rights who must act', async () => {
    mockIssue(readyIssue(null))
    renderGoods(<StockIssuesPage />, ['stock.issue.post', 'debt.read'])
    const dialog = await openDetail()
    const next = await within(dialog).findByTestId('next-action')
    expect(next.textContent).toContain('Chờ Kế toán thực hiện.')
    expect(within(next).queryByRole('link')).toBeNull()
  })
})

describe('upfront deep link', () => {
  const grants: FunctionCode[] = ['cash.upfront.verify', 'cash.receipt.post']
  const auth: AuthContextValue = {
    user: null,
    allowedFunctions: grants,
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (permission) =>
      Array.isArray(permission)
        ? permission.some((grant) => grants.includes(grant))
        : grants.includes(permission),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }
  function Where() {
    const location = useLocation()
    return <span data-testid="where">{location.search}</span>
  }
  function renderAt(entry: string, value: AuthContextValue = auth) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <AuthContext.Provider value={value}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <UpfrontPaymentsPage />
                  <Where />
                </>
              }
            />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )
  }
  beforeEach(() => {
    vi.spyOn(api, 'apiFetch').mockImplementation(async (path) => {
      if (path === '/stock-issues/301')
        return response({
          ...readyIssue(null),
          id: '301',
          code: 'PX-301',
        })
      return response(page([]), null)
    })
  })

  it('opens the verification form for the linked issue and cleans the URL', async () => {
    renderAt('/upfront-payments?issue=301&new=1')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('workflow-steps')).toBeDefined()
    await waitFor(() =>
      expect(screen.getByTestId('where').textContent).toBe(''),
    )
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/stock-issues/301',
        expect.anything(),
      ),
    )
  })

  it('ignores malformed ids and does not open without verify rights', async () => {
    renderAt('/upfront-payments?issue=abc&new=1')
    await screen.findByText('Xác nhận thanh toán trả ngay')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('where').textContent).toBe('?issue=abc&new=1')
  })

  it('does not open the form for a user who cannot verify', async () => {
    const readOnly: AuthContextValue = {
      ...auth,
      allowedFunctions: ['stock.issue.post'],
      hasPermission: (permission) =>
        Array.isArray(permission)
          ? permission.includes('stock.issue.post')
          : permission === 'stock.issue.post',
    }
    renderAt('/upfront-payments?issue=301&new=1', readOnly)
    await screen.findByText('Xác nhận thanh toán trả ngay')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
