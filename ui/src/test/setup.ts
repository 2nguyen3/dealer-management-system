import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// findBy*/waitFor default to 1 s; popover-positioned pickers and chart pages can
// exceed that when every worker renders jsdom in parallel (they pass alone).
configure({ asyncUtilTimeout: 3_000 })

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

// jsdom lacks matchMedia; shadcn's sidebar uses it to detect mobile layouts.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
