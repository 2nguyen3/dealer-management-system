import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorNotice } from '../components/guide/ErrorNotice'
import { LockedButton } from '../components/guide/LockedButton'
import { NextActionCallout } from '../components/guide/NextActionCallout'
import {
  GUIDE_TOASTER,
  NEXT_STEP_DURATION,
  notifyNextStep,
  registerGuideNavigator,
} from '../components/guide/notifyNextStep'
import {
  HINTS_KEY,
  hintsEnabled,
  resetHintsForTests,
  setHintsEnabled,
  useHintsEnabled,
} from '../components/guide/preferences'
import { SafeLink } from '../components/guide/SafeLink'
import { WorkflowSteps } from '../components/guide/WorkflowSteps'
import { routePermissions } from '../app/navigation'
import { GuideButton } from '../features/guide/GuideButton'
import { GUIDES, guideFor } from '../features/guide/guides'
import { ApiError } from '../lib/api'
import { ERROR_TEXTS } from '../lib/errors'
import { resetI18nForTests } from '../lib/i18n/core'

const { success } = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock('sonner', async (original) => {
  const actual = await original<typeof import('sonner')>()
  return { ...actual, toast: Object.assign(actual.toast, { success }) }
})

beforeEach(() => {
  success.mockReset()
  localStorage.clear()
  resetHintsForTests()
  registerGuideNavigator(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  resetI18nForTests()
})

describe('WorkflowSteps', () => {
  it('renders each step with written state, role and current marker', () => {
    render(
      <WorkflowSteps
        label="Quy trình phiếu xuất"
        steps={[
          { key: 'a', label: 'Lập nháp', state: 'done', role: 'Kinh doanh' },
          { key: 'b', label: 'Nộp phiếu', state: 'current' },
          { key: 'c', label: 'Xác nhận', state: 'blocked', hint: 'Chờ tiền' },
          { key: 'd', label: 'Ghi sổ', state: 'todo' },
          { key: 'e', label: 'Bỏ qua', state: 'skipped' },
        ]}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Quy trình phiếu xuất' })
    const items = nav.querySelectorAll('li')
    expect(items).toHaveLength(5)
    expect([...items].map((item) => item.getAttribute('data-state'))).toEqual([
      'done',
      'current',
      'blocked',
      'todo',
      'skipped',
    ])
    expect(items[1]?.getAttribute('aria-current')).toBe('step')
    expect(items[0]?.getAttribute('aria-current')).toBeNull()
    expect(screen.getByText('Đã xong · Kinh doanh')).toBeDefined()
    expect(screen.getByText('Đang bị chặn')).toBeDefined()
    expect(screen.getByText('Không áp dụng')).toBeDefined()
    // Every step is keyboard focusable.
    expect(nav.querySelectorAll('[tabindex="0"]')).toHaveLength(5)
  })

  it('renders nothing without steps', () => {
    const { container } = render(<WorkflowSteps label="x" steps={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('NextActionCallout', () => {
  it('renders nothing for a null action', () => {
    const { container } = render(<NextActionCallout action={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('links to the next page with a default "Mở" label (outside a router)', () => {
    render(
      <NextActionCallout
        action={{
          title: 'Xác nhận khoản trả ngay',
          description: 'Kế toán xác nhận',
          to: '/upfront-payments?issue=1&new=1',
        }}
      />,
    )
    const box = screen.getByTestId('next-action')
    expect(box.getAttribute('aria-label')).toBe('Việc cần làm tiếp')
    const link = screen.getByRole('link', { name: 'Mở' })
    expect(link.getAttribute('href')).toBe('/upfront-payments?issue=1&new=1')
  })

  it('runs an in-page action when there is no link', () => {
    const onAction = vi.fn()
    render(
      <NextActionCallout
        action={{ title: 'Ghi sổ', actionLabel: 'Ghi sổ ngay', onAction }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ghi sổ ngay' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('names the waiting role and hides the shortcut without permission', () => {
    render(
      <NextActionCallout
        action={{
          title: 'Chờ xác nhận',
          to: '/upfront-payments',
          waitingFor: 'Kế toán',
          tone: 'warning',
        }}
      />,
    )
    expect(screen.getByText('Chờ Kế toán thực hiện.')).toBeDefined()
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('LockedButton', () => {
  it('is a normal enabled button without a reason', () => {
    const onClick = vi.fn()
    render(<LockedButton onClick={onClick}>Ghi sổ</LockedButton>)
    const button = screen.getByRole('button', { name: 'Ghi sổ' })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables the button and exposes the reason to assistive technology', () => {
    const onClick = vi.fn()
    render(
      <LockedButton lockedReason="Chưa có xác nhận trả ngay" onClick={onClick}>
        Ghi sổ
      </LockedButton>,
    )
    const button = screen.getByRole('button', { name: 'Ghi sổ' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    const describedBy = button.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)?.textContent).toBe(
      'Chưa có xác nhận trả ngay',
    )
    expect(
      document
        .querySelector('[data-locked-reason]')
        ?.getAttribute('data-locked-reason'),
    ).toBe('Chưa có xác nhận trả ngay')
  })

  it('treats an empty reason as unlocked but keeps an explicit disabled', () => {
    render(
      <LockedButton lockedReason="" disabled>
        Nộp
      </LockedButton>,
    )
    expect(
      (screen.getByRole('button', { name: 'Nộp' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(document.querySelector('[data-locked-reason]')).toBeNull()
  })
})

describe('next-step hints and toasts', () => {
  it('defaults hints on and persists the switch', () => {
    expect(hintsEnabled()).toBe(true)
    setHintsEnabled(false)
    expect(localStorage.getItem(HINTS_KEY)).toBe('off')
    expect(hintsEnabled()).toBe(false)
    setHintsEnabled(true)
    expect(hintsEnabled()).toBe(true)
  })

  it('keeps the choice in memory and defaults on when storage fails', () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    expect(hintsEnabled()).toBe(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setHintsEnabled(false)
    expect(hintsEnabled()).toBe(false)
    getItem.mockRestore()
  })

  it('re-renders subscribers when the switch changes', () => {
    function Probe() {
      return <span>{useHintsEnabled() ? 'bật' : 'tắt'}</span>
    }
    render(<Probe />)
    expect(screen.getByText('bật')).toBeDefined()
    setHintsEnabled(false)
    return waitFor(() => expect(screen.getByText('tắt')).toBeDefined())
  })

  it('shows a bottom-right toast with an "Mở" action that navigates', () => {
    const navigate = vi.fn()
    registerGuideNavigator(navigate)
    expect(
      notifyNextStep({
        done: 'Đã nộp PX-1.',
        next: 'Kế toán xác nhận',
        to: '/upfront-payments',
      }),
    ).toBe(true)
    expect(success).toHaveBeenCalledTimes(1)
    const [title, options] = success.mock.calls[0]!
    expect(title).toBe('Đã nộp PX-1.')
    expect(options).toMatchObject({
      toasterId: GUIDE_TOASTER,
      duration: NEXT_STEP_DURATION,
      description: 'Kế toán xác nhận',
      action: { label: 'Mở' },
    })
    options.action.onClick()
    expect(navigate).toHaveBeenCalledWith('/upfront-payments')
  })

  it('omits the action when the user may not open the target', () => {
    registerGuideNavigator(vi.fn(), () => false)
    notifyNextStep({ done: 'Đã lưu.', to: '/permissions' })
    const options = success.mock.calls[0]![1]
    expect(options.action).toBeUndefined()
    expect(options.description).toBeUndefined()
  })

  it('shows nothing when hints are off or the text is blank', () => {
    expect(notifyNextStep({ done: '   ' })).toBe(false)
    setHintsEnabled(false)
    expect(notifyNextStep({ done: 'Đã lưu.' })).toBe(false)
    expect(success).not.toHaveBeenCalled()
  })
})

describe('SafeLink and ErrorNotice', () => {
  it('uses the router inside one and a plain anchor outside', () => {
    function Where() {
      return <span data-testid="where">{useLocation().pathname}</span>
    }
    render(
      <MemoryRouter initialEntries={['/a']}>
        <SafeLink to="/b">Đi</SafeLink>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Đi' }))
    expect(screen.getByTestId('where').textContent).toBe('/b')
    render(<SafeLink to="/c">Ngoài</SafeLink>)
    expect(
      screen.getByRole('link', { name: 'Ngoài' }).getAttribute('href'),
    ).toBe('/c')
  })

  it('adds the resolving shortcut for a known API error and an override target', () => {
    const error = new ApiError(409, 'UPFRONT_REQUIRED', 'Chưa xác nhận')
    render(<ErrorNotice error={error} to="/upfront-payments?issue=7&new=1" />)
    expect(screen.getByText('Chưa xác nhận')).toBeDefined()
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/upfront-payments?issue=7&new=1')
  })

  it('shows plain errors without a link and nothing for empty text', () => {
    render(<ErrorNotice error={new Error('Mất kết nối')} />)
    expect(screen.getByText('Mất kết nối')).toBeDefined()
    expect(screen.queryByRole('link')).toBeNull()
    const { container } = render(<ErrorNotice error={null} message="" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('route guides', () => {
  // Every routed page of App.tsx; /document-history has no extra permission.
  const routes = [
    ...Object.keys(routePermissions),
    '/',
    '/profile',
    '/chatbot',
    '/document-history',
  ]
  beforeEach(() => {
    // Radix measures tooltip/sheet content; jsdom lacks ResizeObserver.
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

  it('has a complete guide for every route', () => {
    for (const path of routes) {
      const guide = GUIDES.get(path)
      expect(guide, path).toBeDefined()
      expect(guide!.purpose.trim(), path).not.toBe('')
      expect(guide!.roles.length, path).toBeGreaterThan(0)
      expect(guide!.steps.length, path).toBeGreaterThan(0)
      for (const code of guide!.errors ?? [])
        expect(ERROR_TEXTS[code], `${path} ${code}`).toBeDefined()
      for (const related of guide!.related ?? [])
        expect(routes, `${path} → ${related}`).toContain(related)
    }
  })

  it('resolves nested paths to the parent guide and unknown paths to null', () => {
    expect(guideFor('/stock-issues')?.path).toBe('/stock-issues')
    expect(guideFor('/stock-issues/123')?.path).toBe('/stock-issues')
    expect(guideFor('/no-such-page')).toBeNull()
    // The home guide never swallows unrelated paths.
    expect(guideFor('/x/y')).toBeNull()
  })

  it('opens the route guide in a side sheet from the book button', async () => {
    render(
      <MemoryRouter>
        <GuideButton path="/stock-issues" title="Phiếu xuất" />
      </MemoryRouter>,
    )
    const button = screen.getByTestId('guide-button')
    expect(button.getAttribute('aria-label')).toBe('Hướng dẫn: Phiếu xuất')
    expect(screen.queryByTestId('guide-sheet')).toBeNull()
    fireEvent.click(button)
    const sheet = await screen.findByTestId('guide-sheet')
    expect(sheet.textContent).toContain('Trang này để làm gì')
    expect(sheet.textContent).toContain('Từng bước chi tiết')
    expect(sheet.textContent).toContain('UPFRONT_REQUIRED')
  })

  it('says so when a page has no guide', async () => {
    render(
      <MemoryRouter>
        <GuideButton path="/nowhere" title="Trang lạ" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('guide-button'))
    const sheet = await screen.findByTestId('guide-sheet')
    expect(sheet.textContent).toContain('Trang này chưa có hướng dẫn.')
    expect(sheet.textContent).not.toContain('Từng bước chi tiết')
  })
})
