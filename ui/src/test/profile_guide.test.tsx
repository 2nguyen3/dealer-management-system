import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HINTS_KEY, resetHintsForTests } from '../components/guide/preferences'
import { AuthContext } from '../features/authentication/useAuth'
import { ProfilePage } from '../features/profile/ProfilePage'
import { auth } from './goodsFixtures'

beforeEach(() => {
  localStorage.clear()
  resetHintsForTests()
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

function renderProfile() {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth()}>
        <ProfilePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  // Radix tabs activate on mouse down.
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Giao diện/ }))
}

describe('profile next-step hint switch', () => {
  it('is on by default and persists turning it off and on', () => {
    renderProfile()
    const toggle = screen.getByRole('switch', {
      name: /Hiện gợi ý bước tiếp theo/,
    })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(localStorage.getItem(HINTS_KEY)).toBe('off')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(localStorage.getItem(HINTS_KEY)).toBe('on')
  })

  it('reflects a stored "off" choice', () => {
    localStorage.setItem(HINTS_KEY, 'off')
    renderProfile()
    expect(
      screen
        .getByRole('switch', { name: /Hiện gợi ý bước tiếp theo/ })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })
})
