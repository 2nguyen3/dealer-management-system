import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import {
  BuildingIcon,
  DollarSignIcon,
  PackageIcon,
  RefreshCwIcon,
} from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch } from '../../lib/cache'
import { formatVND } from '../../lib/formatters'
import type { Agency, Product, StockIssue } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  queryType?: 'AGENCY_DEBT' | 'INVENTORY' | 'SALES'
  data?: unknown
  candidates?: Array<{ code: string; name: string; districtName?: string }>
}

export function ChatbotPage() {
  const { user } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Xin chào ${user?.fullName || 'bạn'}! Tôi là Trợ lý ảo Agentra DMS. Tôi có thể giúp bạn tra cứu nhanh thông tin công nợ đại lý, tồn kho mặt hàng và doanh số bán hàng.`,
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ])

  const [inputText, setInputText] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Master collections for intelligent client-side fallback
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [issues, setIssues] = useState<StockIssue[]>([])

  useEffect(() => {
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies').catch(() => ({
        data: [] as Agency[],
      })),
      cachedApiFetch<Product[] | { items: Product[] }>('/products').catch(
        () => ({ data: [] as Product[] }),
      ),
      cachedApiFetch<StockIssue[] | { items: StockIssue[] }>(
        '/stock-issues',
      ).catch(() => ({ data: [] as StockIssue[] })),
    ]).then(([aRes, pRes, iRes]) => {
      setAgencies(Array.isArray(aRes.data) ? aRes.data : aRes.data.items || [])
      setProducts(Array.isArray(pRes.data) ? pRes.data : pRes.data.items || [])
      setIssues(Array.isArray(iRes.data) ? iRes.data : iRes.data.items || [])
    })
  }, [])

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isThinking])

  const handleSend = async (
    customQuery?: string,
    chosenAgencyCode?: string,
  ) => {
    const question = (customQuery || inputText).trim()
    if (!question) return

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!customQuery) setInputText('')
    setIsThinking(true)

    // Infer query type from keywords
    let queryType: 'AGENCY_DEBT' | 'INVENTORY' | 'SALES' = 'AGENCY_DEBT'
    const lower = question.toLowerCase()
    if (
      lower.includes('tồn') ||
      lower.includes('kho') ||
      lower.includes('hàng')
    ) {
      queryType = 'INVENTORY'
    } else if (lower.includes('doanh số') || lower.includes('bán')) {
      queryType = 'SALES'
    }

    try {
      // 1. Try real backend endpoint first
      const res = await apiFetch<{
        status?: string
        answer?: string
        queryType?: 'AGENCY_DEBT' | 'INVENTORY' | 'SALES'
        data?: unknown
        candidates?: Array<{ code: string; name: string }>
        clarificationMessage?: string
      }>('/chatbot/queries', {
        method: 'POST',
        body: {
          questionText: question,
          queryType,
          agencyCode: chosenAgencyCode,
        },
      })

      if (
        res.status === 200 &&
        res.data?.status === 'ANSWERED' &&
        res.data.answer
      ) {
        const assistantMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: res.data.answer,
          timestamp: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          queryType: res.data.queryType,
          data: res.data.data,
        }
        setMessages((prev) => [...prev, assistantMsg])
        return
      } else if (
        res.status === 200 &&
        res.data?.status === 'NEEDS_AGENCY_SELECTION'
      ) {
        const assistantMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: 'Tìm thấy nhiều đại lý có tên tương tự. Vui lòng chọn đại lý chính xác bên dưới:',
          timestamp: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          candidates: res.data.candidates || [],
        }
        setMessages((prev) => [...prev, assistantMsg])
        return
      } else if (res.status === 200 && res.data?.clarificationMessage) {
        const assistantMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: res.data.clarificationMessage,
          timestamp: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }
        setMessages((prev) => [...prev, assistantMsg])
        return
      } else {
        throw new Error('Not live')
      }
    } catch {
      // 2. Fallback: Intelligent client-side processing using master data
      let answerText = ''
      let queryData: unknown = undefined
      let candidates: Array<{ code: string; name: string }> | undefined =
        undefined

      let currentAgencies = agencies
      if (currentAgencies.length === 0) {
        try {
          const aRes = await cachedApiFetch<Agency[] | { items: Agency[] }>(
            '/agencies',
          )
          currentAgencies = Array.isArray(aRes.data)
            ? aRes.data
            : aRes.data.items || []
        } catch {
          // ignore
        }
      }

      if (queryType === 'AGENCY_DEBT') {
        // Find matching agency
        const matched = currentAgencies.filter((a) => {
          if (chosenAgencyCode && a.code === chosenAgencyCode) return true
          return (
            lower.includes(a.name.toLowerCase()) ||
            lower.includes(a.code.toLowerCase())
          )
        })

        if (matched.length === 1 && matched[0]) {
          const a = matched[0]
          answerText = `Đại lý ${a.name} (${a.code}): Dư nợ hiện tại là ${formatVND(a.currentDebt)}. Hạn mức nợ tối đa là ${formatVND(a.maxDebt || '—')}. Trạng thái: ${a.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hợp tác'}.`
          queryData = a
        } else if (matched.length > 1) {
          answerText = `Tìm thấy ${matched.length} đại lý phù hợp với tìm kiếm của bạn:`
          candidates = matched.map((a) => ({ code: a.code, name: a.name }))
        } else {
          // General debt summary
          const topDebt = [...currentAgencies]
            .sort((a, b) =>
              Number(
                BigInt(b.currentDebt || '0') - BigInt(a.currentDebt || '0'),
              ),
            )
            .slice(0, 3)
          answerText = `Hiện có tổng cộng ${currentAgencies.length} đại lý trong hệ thống. Top 3 đại lý có dư nợ cao nhất hiện tại gồm: ${topDebt.map((a) => `${a.name} (${formatVND(a.currentDebt)})`).join(', ')}.`
        }
      } else if (queryType === 'INVENTORY') {
        // Find matching product
        const matchedProd = products.filter(
          (p) =>
            lower.includes(p.name.toLowerCase()) ||
            lower.includes(p.code.toLowerCase()),
        )

        if (matchedProd.length === 1 && matchedProd[0]) {
          const p = matchedProd[0]
          answerText = `Mặt hàng ${p.name} (${p.code}): Tồn kho hiện tại là ${p.currentStock} ${p.unitName || 'Cái'}. Đơn giá bán: ${formatVND(p.sellingPrice || p.currentSellingPrice || '0')}.`
          queryData = p
        } else {
          const lowStock = products.filter(
            (p) => Number(p.currentStock || '0') <= 20,
          )
          answerText = `Hệ thống đang quản lý ${products.length} mặt hàng. Hiện có ${lowStock.length} mặt hàng có lượng tồn dưới ngưỡng tối thiểu (≤ 20).`
        }
      } else {
        // Sales query
        const totalSales = issues
          .filter((i) => i.status === 'POSTED')
          .reduce((acc, i) => acc + BigInt(i.totalAmount || '0'), 0n)
        answerText = `Tổng doanh số bán hàng ghi nhận từ các phiếu xuất đã hoàn tất là ${formatVND(totalSales.toString())} với ${issues.length} phiếu xuất.`
      }

      const fallbackMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: answerText,
        timestamp: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        queryType,
        data: queryData,
        candidates,
      }
      setMessages((prev) => [...prev, fallbackMsg])
    } finally {
      setIsThinking(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  return (
    <div
      className="page-container"
      style={{ maxWidth: '900px', margin: '0 auto' }}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">Trợ lý ảo thông minh</h1>
          <p className="page-desc">
            Hỏi đáp bằng ngôn ngữ tự nhiên để tra cứu tức thì dư nợ đại lý, số
            lượng tồn kho và tình hình bán hàng
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setMessages([
              {
                id: 'welcome-reset',
                sender: 'assistant',
                text: 'Đã làm mới cuộc hội thoại. Tôi có thể giúp gì cho bạn?',
                timestamp: new Date().toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              },
            ])
          }}
        >
          <RefreshCwIcon size={14} /> Đoạn chat mới
        </Button>
      </div>

      {/* Suggestion Chips */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => handleSend('Đại lý Minh Phát đang nợ bao nhiêu?')}
        >
          <BuildingIcon size={14} /> Dư nợ Minh Phát
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() =>
            handleSend('Kiểm tra các mặt hàng sắp hết hàng trong kho')
          }
        >
          <PackageIcon size={14} /> Mặt hàng sắp hết tồn
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => handleSend('Tổng doanh số bán hàng là bao nhiêu?')}
        >
          <DollarSignIcon size={14} /> Tổng doanh số hệ thống
        </button>
      </div>

      {/* Chat Window Card */}
      <div
        className="card"
        style={{
          height: '520px',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Messages Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '0.85rem 1.15rem',
                  borderRadius:
                    m.sender === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  background:
                    m.sender === 'user'
                      ? 'var(--color-primary, #0d6efd)'
                      : 'var(--color-bg-subtle, #f0f2f5)',
                  color: m.sender === 'user' ? '#fff' : 'inherit',
                  fontSize: '0.925rem',
                  lineHeight: '1.5',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                <div>{m.text}</div>

                {/* Candidate Selection Buttons if applicable */}
                {m.candidates && m.candidates.length > 0 && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    {m.candidates.map((cand) => (
                      <Button
                        key={cand.code}
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          handleSend(`Tra cứu dư nợ ${cand.name}`, cand.code)
                        }
                      >
                        {cand.code} - {cand.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--color-text-muted, #888)',
                  marginTop: '0.25rem',
                  padding: '0 0.25rem',
                }}
              >
                {m.sender === 'user' ? 'Bạn' : 'Trợ lý'} • {m.timestamp}
              </span>
            </div>
          ))}

          {isThinking && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Badge variant="neutral">
                <Spinner size="sm" /> Trợ lý đang suy nghĩ và tra cứu dữ liệu...
              </Badge>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.85rem 1.25rem',
            background: 'var(--color-bg-subtle, #f8f9fa)',
            borderTop: '1px solid var(--color-border, #dee2e6)',
          }}
        >
          <Input
            placeholder="Đặt câu hỏi về công nợ, tồn kho hoặc doanh số..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isThinking}
            style={{ flex: 1 }}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!inputText.trim() || isThinking}
          >
            Gửi câu hỏi
          </Button>
        </form>
      </div>
    </div>
  )
}
