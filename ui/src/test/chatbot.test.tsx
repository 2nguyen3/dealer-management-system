import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { isAssistantUnavailable } from '../features/chatbot/api'
import { AssistantCompanion } from '../features/chatbot/AssistantCompanion'
import {
  parseChatbotReply,
  type ChatbotReply,
  type SemanticQuery,
} from '../features/chatbot/contract'
import {
  ASSISTANT_KEY,
  assistantPlacement,
  resetAssistantPlacementForTests,
  setAssistantPlacement,
} from '../features/chatbot/preferences'
import { conversationTurns } from '../features/chatbot/useAssistantChat'
import * as api from '../lib/api'
import type { FunctionCode } from '../lib/types'

const query: SemanticQuery = { metric: 'DEBT', filters: [], limit: 20 }

const answered: ChatbotReply = {
  status: 'ANSWERED',
  answer: 'Đại lý Minh Phát đang nợ nhiều nhất.',
  model: 'test/model',
  tables: [
    {
      title: 'Dư nợ đại lý',
      understood: { ...query, sort: '-debt', limit: 5 },
      columns: [
        { key: 'agencyCode', type: 'code' },
        { key: 'agencyName', type: 'text' },
        { key: 'debt', type: 'money' },
      ],
      rows: [
        { agencyCode: 'DL-101', agencyName: 'Minh Phát', debt: '1500000' },
      ],
      totalRows: 30,
      truncated: true,
      asOf: '2026-11-15T02:00:00Z',
      source: { operationId: 'listAgencies', query: { sort: '-debt' } },
    },
  ],
}

const selection: ChatbotReply = {
  status: 'NEEDS_SELECTION',
  answer: 'Có 2 đại lý tên Minh Phát.',
  entity: 'agency',
  candidates: [
    { code: 'DL-101', name: 'Minh Phát', detail: 'Phường Sài Gòn' },
    { code: 'DL-102', name: 'Minh Phát', detail: 'Phường Bàn Cờ' },
  ],
  totalMatches: 2,
  pendingQuery: query,
}

function auth(codes: FunctionCode[]): AuthContextValue {
  return {
    user: {
      id: '7',
      fullName: 'Nguyễn Văn An',
      email: 'an@agentra.vn',
      groupId: 2,
      groupCode: 'SALES',
      groupName: 'Kinh doanh',
      status: 'ACTIVE',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    },
    allowedFunctions: codes,
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((code) => codes.includes(code))
        : codes.includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }
}

function renderCompanion(codes: FunctionCode[] = ['debt.read', 'sales.read']) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={auth(codes)}>
        <AssistantCompanion />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý Agentra' }))
  return screen.getByRole('dialog')
}

function ask(text: string) {
  fireEvent.change(screen.getByLabelText('Câu hỏi cho trợ lý'), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.setItem('agentra-assistant-greeted', '1')
  resetAssistantPlacementForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('chatbot contract', () => {
  it('accepts every reply status of the contract', () => {
    expect(parseChatbotReply(answered)).toEqual(answered)
    expect(parseChatbotReply(selection)).toEqual(selection)
    expect(
      parseChatbotReply({
        status: 'NEEDS_INFO',
        answer: 'Khoảng thời gian nào?',
        missing: ['period'],
      }),
    ).not.toBeNull()
    expect(
      parseChatbotReply({
        status: 'REFUSED',
        answer: 'Không hỗ trợ.',
        reason: 'UNSUPPORTED_QUERY',
      }),
    ).not.toBeNull()
  })

  it('rejects malformed or out-of-contract bodies', () => {
    expect(parseChatbotReply(null)).toBeNull()
    expect(parseChatbotReply({ status: 'ANSWERED', answer: '' })).toBeNull()
    expect(parseChatbotReply({ ...answered, tables: [] })).toBeNull()
    expect(
      parseChatbotReply({
        ...answered,
        tables: [{ ...answered.tables[0], rows: [{ debt: 1.5 }] }],
      }),
    ).toBeNull()
    expect(
      parseChatbotReply({
        ...selection,
        candidates: [selection.candidates[0]],
      }),
    ).toBeNull()
    expect(
      parseChatbotReply({
        ...selection,
        pendingQuery: { ...query, limit: 51 },
      }),
    ).toBeNull()
    expect(
      parseChatbotReply({ status: 'REFUSED', answer: 'x', reason: 'NOPE' }),
    ).toBeNull()
    expect(parseChatbotReply({ status: 'OTHER', answer: 'x' })).toBeNull()
  })

  it('treats a missing route or disabled service as unavailable', () => {
    expect(isAssistantUnavailable(new api.ApiError(404, 'HTTP_404', 'x'))).toBe(
      true,
    )
    expect(
      isAssistantUnavailable(new api.ApiError(503, 'CHATBOT_UNAVAILABLE', 'x')),
    ).toBe(true)
    expect(
      isAssistantUnavailable(new api.ApiError(429, 'RATE_LIMIT_EXCEEDED', 'x')),
    ).toBe(false)
    expect(isAssistantUnavailable(new Error('x'))).toBe(false)
  })

  it('sends only user questions and assistant answers, newest 20', () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      id: index,
      kind: 'user' as const,
      text: `q${index}`,
    }))
    const turns = conversationTurns([
      ...items,
      { id: 99, kind: 'error', unavailable: true, message: 'down' },
      { id: 100, kind: 'reply', reply: answered },
    ])
    expect(turns).toHaveLength(20)
    expect(turns.at(-1)).toEqual({
      role: 'assistant',
      content: answered.answer,
    })
    expect(turns.some((turn) => turn.content === 'down')).toBe(false)
  })
})

describe('assistant placement', () => {
  it('persists visibility and side, ignoring broken storage values', () => {
    setAssistantPlacement({ side: 'start', bottom: 120 })
    expect(JSON.parse(localStorage.getItem(ASSISTANT_KEY)!)).toMatchObject({
      side: 'start',
      bottom: 120,
    })
    localStorage.setItem(ASSISTANT_KEY, '{not json')
    resetAssistantPlacementForTests()
    expect(assistantPlacement()).toEqual({
      hidden: false,
      side: 'end',
      bottom: 24,
    })
  })
})

describe('AssistantCompanion', () => {
  it('is not shown without a metric permission or when hidden', () => {
    const { unmount } = renderCompanion(['users.manage'])
    expect(screen.queryByTestId('assistant-companion')).toBeNull()
    unmount()
    setAssistantPlacement({ hidden: true })
    renderCompanion()
    expect(screen.queryByTestId('assistant-companion')).toBeNull()
  })

  it('opens a panel with permission-based suggestions and no request', async () => {
    const fetch = vi.spyOn(api, 'apiFetch')
    renderCompanion(['debt.read'])
    const dialog = openPanel()
    expect(dialog.textContent).toContain('Chào An!')
    expect(screen.getByText('Đại lý nào đang nợ nhiều nhất?')).toBeDefined()
    expect(
      screen.queryByText('Top 5 đại lý có doanh số cao nhất tháng này'),
    ).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('posts the conversation and renders the answer table from the tool result', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValue({ data: answered, status: 200, etag: null })
    renderCompanion(['debt.read', 'agency.read'])
    openPanel()
    ask('Ai nợ nhiều nhất?')
    await screen.findByText(answered.answer)
    expect(fetch).toHaveBeenCalledWith(
      '/chatbot/messages',
      expect.objectContaining({
        method: 'POST',
        body: {
          messages: [{ role: 'user', content: 'Ai nợ nhiều nhất?' }],
          locale: 'vi',
        },
      }),
    )
    expect(screen.getByText('DL-101')).toBeDefined()
    expect(screen.getByText('Dư nợ hiện tại')).toBeDefined()
    expect(screen.getByText(/1\.500\.000/)).toBeDefined()
    expect(screen.getByText(/1\/30 dòng/)).toBeDefined()
    expect(
      screen
        .getByRole('link', { name: /Mở dữ liệu nguồn/ })
        .getAttribute('href'),
    ).toBe('/agencies')
  })

  it('hides the source link when the user cannot open that page', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: answered,
      status: 200,
      etag: null,
    })
    renderCompanion(['debt.read'])
    openPanel()
    ask('Ai nợ nhiều nhất?')
    await screen.findByText(answered.answer)
    expect(screen.queryByRole('link', { name: /Mở dữ liệu nguồn/ })).toBeNull()
  })

  it('resumes the pending query by code without a new question', async () => {
    const fetch = vi
      .spyOn(api, 'apiFetch')
      .mockResolvedValueOnce({ data: selection, status: 200, etag: null })
      .mockResolvedValueOnce({ data: answered, status: 200, etag: null })
    renderCompanion()
    openPanel()
    ask('Minh Phát nợ bao nhiêu?')
    fireEvent.click(await screen.findByRole('button', { name: /DL-102/ }))
    await screen.findByText(answered.answer)
    expect(fetch).toHaveBeenLastCalledWith(
      '/chatbot/messages',
      expect.objectContaining({
        body: {
          messages: [
            { role: 'user', content: 'Minh Phát nợ bao nhiêu?' },
            { role: 'assistant', content: selection.answer },
          ],
          locale: 'vi',
          resume: { query, select: { entity: 'agency', code: 'DL-102' } },
        },
      }),
    )
    expect(
      screen.getByRole('button', { name: /DL-101/ }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('reports an undeployed backend instead of inventing an answer', async () => {
    vi.spyOn(api, 'apiFetch').mockRejectedValue(
      new api.ApiError(404, 'HTTP_404', 'Not found'),
    )
    renderCompanion()
    openPanel()
    ask('Tồn kho còn bao nhiêu?')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Dịch vụ trợ lý chưa sẵn sàng')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows missing fields and refusals from the contract', async () => {
    vi.spyOn(api, 'apiFetch')
      .mockResolvedValueOnce({
        data: {
          status: 'NEEDS_INFO',
          answer: 'Bạn muốn xem kỳ nào?',
          missing: ['period'],
        },
        status: 200,
        etag: null,
      })
      .mockResolvedValueOnce({
        data: {
          status: 'REFUSED',
          answer: 'Mình không xóa phiếu được.',
          reason: 'FORBIDDEN_METRIC',
        },
        status: 200,
        etag: null,
      })
    renderCompanion()
    openPanel()
    ask('Doanh số?')
    await screen.findByText('Khoảng thời gian')
    ask('Xóa phiếu')
    await screen.findByText('Bạn chưa được cấp quyền xem loại số liệu này.')
  })

  it('marks an answer that arrives while closed as unread', async () => {
    let resolve: (value: api.ApiResponse<unknown>) => void = () => {}
    vi.spyOn(api, 'apiFetch').mockReturnValue(
      new Promise<api.ApiResponse<unknown>>((done) => {
        resolve = done
      }),
    )
    renderCompanion()
    openPanel()
    ask('Ai nợ nhiều nhất?')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    await act(async () => {
      resolve({ data: answered, status: 200, etag: null })
    })
    await waitFor(() =>
      expect(screen.getByText('Có câu trả lời mới')).toBeDefined(),
    )
    expect(screen.getByRole('status').textContent).toContain('Có kết quả rồi')
  })

  it('hides itself from the menu', async () => {
    renderCompanion()
    openPanel()
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Tùy chọn trợ lý' }),
      {
        button: 0,
        ctrlKey: false,
      },
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: /Ẩn trợ lý/ }))
    await waitFor(() =>
      expect(screen.queryByTestId('assistant-companion')).toBeNull(),
    )
    expect(assistantPlacement().hidden).toBe(true)
  })
})
