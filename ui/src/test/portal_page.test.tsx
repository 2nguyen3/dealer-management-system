import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../features/home/HomePage'
import { FavoriteButton } from '../features/portal/FavoriteButton'
import { favoritesKey } from '../features/portal/favorites'
import { PORTAL_TAB_KEY_PREFIX } from '../features/portal/portalTab'
import {
  resetFavoritesForTests,
  saveDeck,
} from '../features/portal/useFavorites'

const access = vi.hoisted(() => ({
  granted: [] as string[],
  user: { id: 'u1', fullName: 'Kế toán' } as {
    id: string
    fullName: string
  } | null,
}))
vi.mock('../features/authentication/useAuth', () => ({
  useAuth: () => ({
    user: access.user,
    hasPermission: (code: string) => access.granted.includes(code),
  }),
}))
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { success: toastSpy } }))

const ACCOUNTING = [
  'cash.receipt.prepare',
  'cash.upfront.verify',
  'debt.read',
  'reports.read',
  'sales.read',
]

function renderPortal() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

const rowNames = () =>
  screen
    .getAllByTestId('favorite-row')
    .map((row) => within(row).getByRole('link').textContent)

beforeEach(() => {
  localStorage.clear()
  resetFavoritesForTests()
  access.granted = [...ACCOUNTING]
  access.user = { id: 'u1', fullName: 'Kế toán' }
  toastSpy.mockReset()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView ??= () => {}
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Portal', () => {
  it('is called Cổng quản lý and opens the favourites with role defaults', () => {
    renderPortal()
    expect(screen.getByRole('heading', { name: 'Cổng quản lý' })).toBeDefined()
    expect(
      screen
        .getByRole('tab', { name: /Yêu thích/ })
        .getAttribute('aria-selected'),
    ).toBe('true')
    expect(rowNames()).toEqual([
      'Phiếu thu tiềnThu tiền đại lý',
      'Xác nhận trả ngayXác minh trả ngay',
      'Công nợ đại lýCông nợ, lịch sử thanh toán',
      'Báo cáo kinh doanhDoanh số, công nợ, tồn kho',
    ])
    expect(
      screen.getByTestId('favorites-restore').hasAttribute('disabled'),
    ).toBe(true)
  })

  it('reorders with the keyboard buttons and saves paths, not labels', () => {
    renderPortal()
    expect(
      screen
        .getByRole('button', { name: 'Đưa Phiếu thu tiền lên' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Đưa Báo cáo kinh doanh xuống' })
        .hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Đưa Phiếu thu tiền xuống' }),
    )
    expect(rowNames()[0]).toMatch(/^Xác nhận trả ngay/)
    expect(JSON.parse(localStorage.getItem(favoritesKey('u1'))!)).toEqual([
      '/upfront-payments',
      '/payment-receipts',
      '/receivables',
      '/reports',
    ])
    fireEvent.click(
      screen.getByRole('button', { name: 'Đưa Phiếu thu tiền lên' }),
    )
    expect(rowNames()[0]).toMatch(/^Phiếu thu tiền/)
  })

  it('removes every favourite, shows the hint and restores the defaults', () => {
    renderPortal()
    for (const name of [
      'Phiếu thu tiền',
      'Xác nhận trả ngay',
      'Công nợ đại lý',
      'Báo cáo kinh doanh',
    ])
      fireEvent.click(
        screen.getByRole('button', { name: `Bỏ ${name} khỏi yêu thích` }),
      )
    expect(screen.queryAllByTestId('favorite-row')).toHaveLength(0)
    expect(
      screen.getByRole('heading', { name: 'Chưa có chức năng yêu thích' }),
    ).toBeDefined()
    expect(localStorage.getItem(favoritesKey('u1'))).toBe('[]')
    fireEvent.click(screen.getByTestId('favorites-restore'))
    expect(screen.getAllByTestId('favorite-row')).toHaveLength(4)
    expect(localStorage.getItem(favoritesKey('u1'))).toBeNull()
  })

  it('adds from the picker, listing only permitted functions not yet added', () => {
    renderPortal()
    fireEvent.click(screen.getByTestId('favorites-add'))
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toContain('Bù trừ dư có')
    expect(options).toContain('Lịch sử chứng từ')
    expect(options).not.toContain('Phiếu thu tiền')
    expect(options).not.toContain('Tài khoản người dùng')
    expect(options).not.toContain('Trợ lý AI')
    expect(options).not.toContain('Cổng quản lý')
    fireEvent.click(
      screen
        .getAllByRole('option')
        .find((o) => o.textContent === 'Bù trừ dư có')!,
    )
    expect(rowNames().at(-1)).toMatch(/^Bù trừ dư có/)
  })

  it('hides favourites whose permission was removed and says how many', () => {
    saveDeck('u1', ['/users', '/receivables', '/permissions'])
    renderPortal()
    expect(rowNames()).toHaveLength(1)
    expect(screen.getByTestId('favorites-hidden').textContent).toBe(
      '2 chức năng yêu thích không còn quyền truy cập nên đã được ẩn.',
    )
    // Reordering visible entries keeps the hidden ones saved.
    fireEvent.click(
      screen.getByRole('button', { name: 'Bỏ Công nợ đại lý khỏi yêu thích' }),
    )
    expect(JSON.parse(localStorage.getItem(favoritesKey('u1'))!)).toEqual([
      '/users',
      '/permissions',
    ])
  })

  it('stars catalogue cards and remembers the open tab per user', () => {
    const view = renderPortal()
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: /Chức năng nghiệp vụ/ }),
    )
    expect(localStorage.getItem(PORTAL_TAB_KEY_PREFIX + 'u1')).toBe('functions')
    const star = screen.getByRole('button', {
      name: 'Thêm Bù trừ dư có vào yêu thích',
    })
    expect(star.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(star)
    expect(
      screen
        .getByRole('button', { name: 'Bỏ Bù trừ dư có khỏi yêu thích' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    // The star sits beside the card link, never inside it.
    expect(
      screen
        .getByRole('link', { name: /Bù trừ dư có/ })
        .querySelector('button'),
    ).toBeNull()
    view.unmount()
    renderPortal()
    expect(
      screen
        .getByRole('tab', { name: /Chức năng nghiệp vụ/ })
        .getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('opens the catalogue first when the deck is empty', () => {
    saveDeck('u1', [])
    renderPortal()
    expect(
      screen
        .getByRole('tab', { name: /Chức năng nghiệp vụ/ })
        .getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('keeps working in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderPortal()
    fireEvent.click(
      screen.getByRole('button', { name: 'Bỏ Phiếu thu tiền khỏi yêu thích' }),
    )
    expect(rowNames()).toHaveLength(3)
    fireEvent.click(screen.getByTestId('favorites-restore'))
    expect(rowNames()).toHaveLength(4)
  })
})

describe('FavoriteButton', () => {
  const renderButton = (path: string, title: string) =>
    render(<FavoriteButton path={path} title={title} />)

  it('adds and removes the current page with a toast', () => {
    renderButton('/receivables', 'Công nợ đại lý')
    // /receivables is in the accounting defaults.
    const button = screen.getByTestId('favorite-button')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe(
      'Bỏ Công nợ đại lý khỏi yêu thích',
    )
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(toastSpy).toHaveBeenCalledWith(
      'Đã bỏ Công nợ đại lý khỏi yêu thích.',
    )
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(toastSpy).toHaveBeenLastCalledWith(
      'Đã thêm Công nợ đại lý vào yêu thích.',
    )
  })

  it('stays hidden on the Portal, the AI assistant and forbidden pages', () => {
    for (const [path, title] of [
      ['/', 'Cổng quản lý'],
      ['/chatbot', 'Trợ lý AI'],
      ['/profile', 'Hồ sơ cá nhân'],
      ['/users', 'Tài khoản người dùng'],
    ]) {
      const view = renderButton(path!, title!)
      expect(screen.queryByTestId('favorite-button')).toBeNull()
      view.unmount()
    }
  })

  it('needs a signed-in user', () => {
    access.user = null
    renderButton('/receivables', 'Công nợ đại lý')
    expect(screen.queryByTestId('favorite-button')).toBeNull()
  })

  it('follows changes made elsewhere (shared store)', () => {
    renderButton('/units', 'Đơn vị tính')
    access.granted.push('unit.manage')
    act(() => saveDeck('u1', ['/units']))
    expect(
      screen.getByTestId('favorite-button').getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
