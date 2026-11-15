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

const answered: ChatbotReply = {
  answer: 'Đại lý Minh Phát đang nợ nhiều nhất.',
  model: 'test/model',
  tools: ['list_agencies'],
  tables: [
    {
      title: 'Đại lý',
      tool: 'list_agencies',
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
    },
  ],
}

const documents: ChatbotReply = {
  answer: 'Có 2 phiếu xuất của DL-8 trong tháng 10.',
  tools: ['list_agencies', 'list_stock_issues'],
  tables: [
    {
      title: 'Phiếu xuất hàng',
      tool: 'list_stock_issues',
      columns: [
        { key: 'documentCode', type: 'code' },
        { key: 'kind', type: 'kind' },
        { key: 'businessDate', type: 'date' },
        { key: 'status', type: 'status' },
        { key: 'documentAmount', type: 'money' },
      ],
      rows: [
        {
          documentCode: 'PX-12',
          kind: 'STOCK_ISSUE',
          businessDate: '2026-10-03',
          status: 'POSTED',
          documentAmount: '2500000',
        },
      ],
      totalRows: 1,
      truncated: false,
      asOf: '2026-11-15T02:00:00Z',
    },
  ],
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
  it('accepts answers with and without tables', () => {
    expect(parseChatbotReply(answered)).toEqual(answered)
    expect(parseChatbotReply(documents)).toEqual(documents)
    const plain = { answer: 'Bạn muốn xem kỳ nào?', tables: [], tools: [] }
    expect(parseChatbotReply(plain)).toEqual(plain)
  })

  it('rejects malformed or out-of-contract bodies', () => {
    expect(parseChatbotReply(null)).toBeNull()
    expect(parseChatbotReply({ ...answered, answer: '' })).toBeNull()
    expect(parseChatbotReply({ ...answered, tools: undefined })).toBeNull()
    expect(parseChatbotReply({ ...answered, model: 5 })).toBeNull()
    expect(
      parseChatbotReply({
        ...answered,
        tables: Array.from({ length: 4 }, () => answered.tables[0]),
      }),
    ).toBeNull()
    expect(
      parseChatbotReply({
        ...answered,
        tables: [{ ...answered.tables[0], rows: [{ debt: 1.5 }] }],
      }),
    ).toBeNull()
    expect(
      parseChatbotReply({
        ...answered,
        tables: [{ ...answered.tables[0], tool: 'List Agencies' }],
      }),
    ).toBeNull()
    expect(
      parseChatbotReply({
        ...answered,
        tables: [
          { ...answered.tables[0], columns: [{ key: 'x', type: 'blob' }] },
        ],
      }),
    ).toBeNull()
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

  it('formats document dates, kinds and statuses from the tool result', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: documents,
      status: 200,
      etag: null,
    })
    renderCompanion(['debt.read', 'stock.issue.prepare'])
    openPanel()
    ask('Phiếu xuất của DL-8 tháng 10?')
    await screen.findByText(documents.answer)
    expect(screen.getByText('Số chứng từ')).toBeDefined()
    expect(
      screen.getByText('Phiếu xuất hàng', { selector: 'td' }),
    ).toBeDefined()
    expect(screen.getByText('03/10/2026')).toBeDefined()
    expect(screen.getByText('Đã ghi sổ')).toBeDefined()
    expect(
      screen
        .getByRole('link', { name: /Mở dữ liệu nguồn/ })
        .getAttribute('href'),
    ).toBe('/stock-issues')
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

  it('shows a plain answer without a table', async () => {
    vi.spyOn(api, 'apiFetch').mockResolvedValue({
      data: { answer: 'Bạn muốn xem kỳ nào?', tables: [], tools: [] },
      status: 200,
      etag: null,
    })
    renderCompanion()
    openPanel()
    ask('Doanh số?')
    await screen.findByText('Bạn muốn xem kỳ nào?')
    expect(screen.queryByRole('table')).toBeNull()
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
