import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ChatbotPage } from '../features/chatbot/ChatbotPage'
import * as api from '../lib/api'
import * as cache from '../lib/cache'

it('shows unavailable without fabricated chat, forms, prefetch or requests', () => {
  const read = vi.spyOn(api, 'apiFetch')
  const cached = vi.spyOn(cache, 'cachedApiFetch')
  const fetch = vi.spyOn(globalThis, 'fetch')
  render(<ChatbotPage />)
  expect(screen.getByText('Chưa khả dụng')).toBeDefined()
  expect(screen.getByText(/Dịch vụ chatbot chưa được triển khai/)).toBeDefined()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
  expect(read).not.toHaveBeenCalled()
  expect(cached).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})
