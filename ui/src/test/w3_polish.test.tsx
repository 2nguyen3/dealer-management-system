import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { Store } from 'lucide-react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShellLayout } from '../app/ShellLayout'
import { IllustratedFigure } from '../components/blocks/IllustratedFigure'
import { PageHeader } from '../components/blocks/PageHeader'
import { PageIconContext } from '../components/blocks/pageIconContext'
import { BRAND_LOGO, BrandLogo } from '../components/brand/BrandLogo'
import {
  figureShadow,
  figureSrc,
  mixHex,
} from '../components/theme/figureTheme'
import {
  PALETTES,
  resetPaletteCache,
  setPalette,
} from '../components/theme/palette'
import { inferAction, textOf } from '../components/ui/actionIcons'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { FilterIcon } from '../components/ui/FilterIcon'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'
import { filterOptionIcon, statusIcon } from '../components/ui/statusIcons'
import { AuthLayout } from '../features/authentication/AuthLayout'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import type { UserResponse } from '../lib/types'

const svgNames = (root: Element) =>
  Array.from(root.querySelectorAll('svg')).map((svg) =>
    Array.from(svg.classList).find(
      (name) => name.startsWith('lucide-') && name !== 'lucide-icon',
    ),
  )

beforeEach(() => {
  localStorage.clear()
  resetPaletteCache()
  delete document.documentElement.dataset.palette
})

afterEach(() => {
  localStorage.clear()
  resetPaletteCache()
})

describe('figure theme tokens', () => {
  it('mixes two hex colours linearly and clamps the weight', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#102030', '#ffffff', 0)).toBe('#102030')
    expect(mixHex('#102030', '#ffffff', 1)).toBe('#ffffff')
    expect(mixHex('#102030', '#ffffff', -3)).toBe('#102030')
    expect(mixHex('#102030', '#ffffff', 7)).toBe('#ffffff')
  })

  it('rejects colours that are not #rrggbb', () => {
    expect(() => mixHex('#fff', '#000000', 0.5)).toThrow(/#rrggbb/)
    expect(() => mixHex('#000000', 'red', 0.5)).toThrow(/#rrggbb/)
    expect(() => mixHex('oklch(0.5 0.1 200)', '#000000', 0.5)).toThrow()
  })

  it('tints the figure shadow per palette and deepens it in dark mode', () => {
    const light = PALETTES.map((p) => figureShadow(p.value, false))
    const dark = PALETTES.map((p) => figureShadow(p.value, true))
    expect(new Set(light).size).toBe(PALETTES.length)
    expect(new Set(dark).size).toBe(PALETTES.length)
    for (const value of [...light, ...dark])
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
    light.forEach((value, i) => expect(value).not.toBe(dark[i]))
    // Thủy keeps a blue shadow close to the figure's original #41538f.
    expect(figureShadow('thuy', false)).toBe('#365ba5')
    // An unknown palette value falls back to Thủy instead of throwing.
    expect(figureShadow('neon' as never, false)).toBe('#365ba5')
  })

  it('builds the figure URL with theme and shadow query tokens', () => {
    const src = figureSrc('supplychain.html', 'hoa', true, '/base/')
    const url = new URL(src, 'http://x')
    expect(url.pathname).toBe('/base/figures/supplychain.html')
    expect(url.searchParams.get('theme')).toBe('dark')
    expect(url.searchParams.get('shadow')).toBe(figureShadow('hoa', true))
    expect(figureSrc('forklift.html', 'thuy', false)).toBe(
      '/figures/forklift.html?theme=light&shadow=%23365ba5',
    )
  })
})

describe('IllustratedFigure theming', () => {
  it('passes light tokens by default and keeps the frame transparent', () => {
    render(<IllustratedFigure name="forklift.html" title="Xe nâng" />)
    const frame = screen.getByTitle('Xe nâng') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe(
      figureSrc('forklift.html', 'thuy', false),
    )
    expect(frame.style.colorScheme).toBe('light')
    expect(frame.className).toContain('dark:brightness-[.86]')
  })

  it('uses dark tokens under a dark theme', () => {
    render(
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="w3-theme-test"
      >
        <IllustratedFigure name="supplychain.html" title="Chuỗi" />
      </NextThemesProvider>,
    )
    const src = screen.getByTitle('Chuỗi').getAttribute('src') ?? ''
    expect(src).toContain('theme=dark')
    expect(src).toBe(figureSrc('supplychain.html', 'thuy', true))
  })

  it('reloads the frame (skeleton again) when the palette changes', () => {
    const { container } = render(
      <IllustratedFigure name="forklift.html" title="Xe nâng" />,
    )
    fireEvent.load(screen.getByTitle('Xe nâng'))
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()
    act(() => setPalette('hoa'))
    const frame = screen.getByTitle('Xe nâng')
    expect(frame.getAttribute('src')).toBe(
      figureSrc('forklift.html', 'hoa', false),
    )
    expect(frame.className).toContain('opacity-0')
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy()
  })
})

describe('BrandLogo and the authentication frame', () => {
  it('renders both wordmarks and lets the theme class pick one', () => {
    render(<BrandLogo className="h-14" />)
    const [light, dark] = screen.getAllByAltText('Agentra')
    expect(light?.getAttribute('src')).toBe(BRAND_LOGO.light)
    expect(dark?.getAttribute('src')).toBe(BRAND_LOGO.dark)
    expect(light?.className).toContain('dark:hidden')
    expect(dark?.className).toContain('hidden')
    expect(dark?.className).toContain('dark:block')
    for (const logo of [light, dark]) {
      expect(logo?.className).toContain('h-14')
      expect(logo?.className).toContain('object-contain')
    }
  })

  it('uses theme tokens only, offers the theme menu and an icon title', () => {
    render(
      <MemoryRouter>
        <AuthLayout
          title="Đăng nhập"
          description="Mô tả"
          icon={<Store data-testid="title-icon" />}
        >
          <p>Biểu mẫu</p>
        </AuthLayout>
      </MemoryRouter>,
    )
    const intro = screen.getByTestId('auth-intro')
    expect(intro.className).not.toMatch(/#[0-9a-f]{3,6}/i)
    expect(intro.className).toContain('from-primary/12')
    expect(
      screen.getByRole('button', { name: 'Đổi giao diện và màu chủ đạo' }),
    ).toBeDefined()
    expect(screen.getByTestId('title-icon')).toBeDefined()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Đăng nhập' }),
    ).toBeDefined()
    // Desktop intro + mobile header each carry both theme variants.
    expect(screen.getAllByAltText('Agentra')).toHaveLength(4)
  })

  it('omits the title icon tile when no icon is given', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthLayout title="Quên mật khẩu" description="Mô tả">
          <p>Biểu mẫu</p>
        </AuthLayout>
      </MemoryRouter>,
    )
    const header = container.querySelector('[data-slot="card-header"]')
    expect(header?.querySelector('svg')).toBeNull()
  })
})

describe('sidebar brand and route page icons', () => {
  const user: UserResponse = {
    id: '1',
    fullName: 'Lê Văn B',
    email: 'sales@agentra.vn',
    groupId: 2,
    groupCode: 'SALES',
    groupName: 'Kinh doanh',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }
  const auth: AuthContextValue = {
    user,
    allowedFunctions: ['agency.read'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }
  const renderShell = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route element={<ShellLayout />}>
              <Route
                path="/agencies"
                element={<PageHeader title="Hồ sơ đại lý" />}
              />
              <Route
                path="/agencies/:id"
                element={<PageHeader title="Chi tiết" />}
              />
              <Route path="/unknown" element={<PageHeader title="Lạ" />} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

  it('keeps the brand mark a fixed, unsqueezable square', () => {
    renderShell('/agencies')
    const brand = screen.getByTestId('sidebar-brand')
    const tile = brand.firstElementChild as HTMLElement
    const image = tile.querySelector('img') as HTMLImageElement
    expect(tile.className).toMatch(/\bsize-8\b/)
    expect(tile.className).toMatch(/\bshrink-0\b/)
    expect(image.getAttribute('src')).toBe('/assets/brand/agentra-icon.png')
    expect(image.getAttribute('width')).toBe('28')
    expect(image.getAttribute('height')).toBe('28')
    for (const name of ['aspect-square', 'max-w-none', 'object-contain'])
      expect(image.className).toContain(name)
    // No collapse-only padding/justification that would move or squeeze it.
    expect(brand.className).not.toContain('group-data-[collapsible=icon]')
    // The wordmark text hides in the icon rail instead of wrapping.
    const text = tile.nextElementSibling as HTMLElement
    expect(text.className).toContain('group-data-[collapsible=icon]:hidden')
    expect(text.className).toContain('whitespace-nowrap')
  })

  it('gives each page header the icon of its navigation entry', () => {
    renderShell('/agencies')
    const tile = screen.getByTestId('page-header-icon')
    expect(svgNames(tile)).toEqual(['lucide-store'])
  })

  it('uses the closest parent route icon on nested paths', () => {
    renderShell('/agencies/7')
    expect(svgNames(screen.getByTestId('page-header-icon'))).toEqual([
      'lucide-store',
    ])
  })

  it('shows no page icon for routes outside the navigation map', () => {
    renderShell('/unknown')
    expect(screen.queryByTestId('page-header-icon')).toBeNull()
  })
})

describe('PageHeader icon', () => {
  it('prefers an explicit icon, hides with false and is absent without context', () => {
    const { rerender } = render(
      <PageIconContext.Provider value={Store}>
        <PageHeader title="A" icon={<svg data-testid="own" />} />
      </PageIconContext.Provider>,
    )
    expect(screen.getByTestId('own')).toBeDefined()
    rerender(
      <PageIconContext.Provider value={Store}>
        <PageHeader title="A" icon={false} />
      </PageIconContext.Provider>,
    )
    expect(screen.queryByTestId('page-header-icon')).toBeNull()
    rerender(<PageHeader title="A" description="Mô tả ngắn" />)
    expect(screen.queryByTestId('page-header-icon')).toBeNull()
    expect(screen.getByText('Mô tả ngắn').getAttribute('title')).toBe(
      'Mô tả ngắn',
    )
  })
})

describe('action icon inference', () => {
  it.each([
    ['Tạo phiếu', 'create'],
    ['Thêm mới', 'create'],
    ['Tiếp nhận', 'create'],
    ['Lập phiếu thu mới', 'create'],
    ['Sửa', 'edit'],
    ['Chỉnh sửa hồ sơ: DL-71', 'edit'],
    ['Lưu thay đổi', 'save'],
    ['  LƯU NHÁP ', 'save'],
    ['Cập nhật', 'save'],
    ['Xóa', 'delete'],
    ['Xóa bộ lọc', 'reset'],
    ['Bỏ lọc', 'reset'],
    ['Xuất PDF', 'export'],
    ['Tải xuống', 'export'],
    ['In phiếu', 'print'],
    ['Tải lại', 'refresh'],
    ['Thử tải lại', 'refresh'],
    ['Đối soát giao dịch hiện tại', 'refresh'],
    ['Lọc', 'filter'],
    ['Hủy', 'cancel'],
    ['Hủy phiếu', 'void'],
    ['Đóng', 'close'],
    ['Ngừng hợp tác vĩnh viễn', 'terminate'],
    ['Ghi sổ', 'post'],
    ['Giữ chỗ quỹ', 'post'],
    ['Xác nhận ngừng hợp tác', 'confirm'],
    ['Xác minh tiền thực nhận', 'confirm'],
    ['Áp dụng', 'confirm'],
    ['Xong', 'confirm'],
    ['Chi tiết', 'view'],
    ['Xem chi tiết', 'view'],
    ['Quay lại', 'back'],
    ['Về trang chủ', 'home'],
    ['Trang trước', 'previous'],
    ['Trang tiếp', 'following'],
    ['Tiếp tục', 'next'],
    ['Yêu cầu hoàn trực tuyến', 'send'],
    ['Khởi tạo thanh toán', 'pay'],
    ['Tiếp tục khởi tạo thanh toán', 'pay'],
    ['Đặt lại mật khẩu', 'password'],
    ['Đổi mật khẩu tài khoản', 'password'],
    ['Đăng nhập', 'login'],
    ['Đăng xuất', 'logout'],
  ])('maps “%s” to %s', (label, kind) => {
    expect(inferAction(label)).toBe(kind)
  })

  it.each([
    [''],
    ['   '],
    ['Phiếu xuất hàng'],
    ['Xuất hàng'],
    ['Inventory'],
    ['Hủy bỏ'],
    ['Tạochứng'],
    ['Đóng gói'],
    ['Sắp xếp'],
  ])('leaves “%s” without an icon', (label) => {
    expect(inferAction(label)).toBeNull()
  })

  it('reads plain text children only', () => {
    expect(textOf('Lưu')).toBe('Lưu')
    expect(textOf(3)).toBe('3')
    expect(textOf(['Lưu ', 'nháp'])).toBe('Lưu nháp')
    expect(textOf(<span>Lưu</span>)).toBeNull()
    expect(textOf(['Lưu', <span key="x" />])).toBeNull()
    expect(textOf(null)).toBeNull()
  })
})

describe('icon-bearing Button', () => {
  const actionOf = (name: string) =>
    screen
      .getByRole('button', { name })
      .querySelector('[data-action]')
      ?.getAttribute('data-action') ?? null

  it('infers the pictogram from its label and keeps the accessible name', () => {
    render(
      <>
        <Button>Lưu thay đổi</Button>
        <Button variant="outline">Hủy</Button>
        <Button>{'Xuất PDF'}</Button>
      </>,
    )
    expect(actionOf('Lưu thay đổi')).toBe('save')
    expect(actionOf('Hủy')).toBe('cancel')
    expect(actionOf('Xuất PDF')).toBe('export')
    const icon = screen.getByRole('button', { name: 'Hủy' }).firstElementChild
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })

  it('honours explicit action, opt-out and explicit icon', () => {
    render(
      <>
        <Button action="delete">Gỡ</Button>
        <Button action={false}>Lưu</Button>
        <Button icon={<svg data-testid="own" />}>Hủy</Button>
        <Button>Không rõ</Button>
        <Button>
          <span>Lưu</span>
        </Button>
      </>,
    )
    expect(actionOf('Gỡ')).toBe('delete')
    expect(
      screen.getAllByRole('button', { name: 'Lưu' })[0]?.querySelector('svg'),
    ).toBeNull()
    expect(screen.getByTestId('own')).toBeDefined()
    expect(actionOf('Hủy')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Không rõ' }).querySelector('svg'),
    ).toBeNull()
    expect(
      screen.getAllByRole('button', { name: 'Lưu' })[1]?.querySelector('svg'),
    ).toBeNull()
  })

  it('shows the spinner instead of the action icon while loading', () => {
    render(<Button isLoading>Ghi sổ</Button>)
    const button = screen.getByRole('button', { name: 'Ghi sổ' })
    expect(button.querySelector('[data-action]')).toBeNull()
    expect(svgNames(button)).toEqual(['lucide-loader-circle'])
    expect(button.getAttribute('aria-busy')).toBe('true')
  })
})

describe('Modal title icon', () => {
  it('infers the icon from the title verb, accepts one or hides it', () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} title="Chỉnh sửa hồ sơ: DL-71">
        <p>Nội dung</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const title = within(dialog).getByText('Chỉnh sửa hồ sơ: DL-71')
    expect(svgNames(title.parentElement as Element)).toEqual(['lucide-pencil'])
    rerender(
      <Modal isOpen onClose={() => {}} title="Thông tin" icon={false}>
        <p>Nội dung</p>
      </Modal>,
    )
    const plain = within(screen.getByRole('dialog')).getByText('Thông tin')
    expect(plain.parentElement?.querySelector('svg')).toBeNull()
    rerender(
      <Modal
        isOpen
        onClose={() => {}}
        title="Thông tin"
        icon={<svg data-testid="own" />}
      >
        <p>Nội dung</p>
      </Modal>,
    )
    expect(screen.getByTestId('own')).toBeDefined()
  })
})

describe('status pictograms', () => {
  it('pairs each status badge with a status icon and keeps the label', () => {
    render(
      <>
        <StatusBadge status="POSTED" />
        <StatusBadge status="CANCELLED" />
        <StatusBadge status="DRAFT" />
        <StatusBadge status="PENDING" />
        <StatusBadge status="SOMETHING_NEW" />
      </>,
    )
    const badge = (status: string) =>
      document.querySelector(`[data-status="${status}"]`) as Element
    expect(svgNames(badge('POSTED'))).toEqual(['lucide-circle-check'])
    expect(svgNames(badge('CANCELLED'))).toEqual(['lucide-ban'])
    expect(svgNames(badge('DRAFT'))).toEqual(['lucide-file-pen'])
    expect(svgNames(badge('PENDING'))).toEqual(['lucide-clock'])
    expect(svgNames(badge('SOMETHING_NEW'))).toEqual(['lucide-circle-minus'])
    expect(badge('POSTED').textContent).toContain('Đã ghi sổ')
  })

  it('gives tone badges a default icon, neutral a dot, and honours false', () => {
    render(
      <>
        <Badge variant="success">Khớp</Badge>
        <Badge variant="warning">Sắp hết</Badge>
        <Badge variant="neutral">Chỉ xem</Badge>
        <Badge variant="info" icon={false}>
          code
        </Badge>
      </>,
    )
    expect(svgNames(screen.getByText('Khớp'))).toEqual(['lucide-circle-check'])
    expect(svgNames(screen.getByText('Sắp hết'))).toEqual([
      'lucide-triangle-alert',
    ])
    expect(screen.getByText('Chỉ xem').querySelector('svg')).toBeNull()
    expect(screen.getByText('code').querySelector('svg')).toBeNull()
    expect(screen.getByText('code').querySelector('.rounded-full')).toBeTruthy()
  })

  it('maps filter options to icons only for statuses and "all"', () => {
    expect(statusIcon('LOCKED')).toBe(filterOptionIcon('LOCKED'))
    expect(filterOptionIcon('')).not.toBeNull()
    expect(filterOptionIcon('__all')).toBe(filterOptionIcon(''))
    expect(filterOptionIcon('POSTED')).toBe(statusIcon('POSTED'))
    expect(filterOptionIcon('STOCK_RECEIPT')).toBeNull()
    expect(filterOptionIcon('CONSUMED')).toBeNull()
    const { container } = render(
      <>
        <FilterIcon value="" />
        <FilterIcon value="ACTIVE" />
        <FilterIcon value="WARD" />
      </>,
    )
    expect(svgNames(container)).toEqual([
      'lucide-list-filter',
      'lucide-circle-check',
    ])
    for (const svg of container.querySelectorAll('svg'))
      expect(svg.getAttribute('aria-hidden')).toBe('true')
  })
})
