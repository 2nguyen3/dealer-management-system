import { useCallback, useEffect, useRef, useState } from 'react'
import { getLocale, t } from '@/lib/i18n/core'
import { isAssistantUnavailable, sendChatbotMessage } from './api'
import {
  MAX_TURN_LENGTH,
  MAX_TURNS,
  type ChatbotReply,
  type ChatTurn,
} from './contract'

export type ChatItem =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'reply'; reply: ChatbotReply }
  | { id: number; kind: 'error'; unavailable: boolean; message: string }

/** What the last request ended with, for the companion's expression. */
export type ChatOutcome = 'ANSWERED' | 'ERROR' | 'UNAVAILABLE'

/** Conversation turns for the request: user text and assistant answers only. */
export function conversationTurns(items: readonly ChatItem[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (const item of items) {
    if (item.kind === 'user')
      turns.push({
        role: 'user',
        content: item.text.slice(0, MAX_TURN_LENGTH),
      })
    else if (item.kind === 'reply')
      turns.push({
        role: 'assistant',
        content: item.reply.answer.slice(0, MAX_TURN_LENGTH),
      })
  }
  return turns.slice(-MAX_TURNS)
}

/**
 * Stateless conversation with the assistant (the server keeps no history).
 * One request at a time; unmounting or starting over aborts it.
 */
export function useAssistantChat(onSettled?: (outcome: ChatOutcome) => void) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [pending, setPending] = useState(false)
  const itemsRef = useRef<ChatItem[]>([])
  const controller = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  const settled = useRef(onSettled)

  useEffect(() => {
    settled.current = onSettled
  }, [onSettled])

  useEffect(() => () => controller.current?.abort(), [])

  const update = useCallback((next: ChatItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  const run = useCallback(
    async (userText: string) => {
      if (controller.current) return
      const userItem: ChatItem = {
        id: nextId.current++,
        kind: 'user',
        text: userText,
      }
      const history = [...itemsRef.current, userItem]
      update(history)
      const abort = new AbortController()
      controller.current = abort
      setPending(true)
      try {
        const reply = await sendChatbotMessage(
          { messages: conversationTurns(history), locale: getLocale() },
          abort.signal,
        )
        update([
          ...itemsRef.current,
          { id: nextId.current++, kind: 'reply', reply },
        ])
        settled.current?.('ANSWERED')
      } catch (error) {
        if (abort.signal.aborted) return
        const unavailable = isAssistantUnavailable(error)
        update([
          ...itemsRef.current,
          {
            id: nextId.current++,
            kind: 'error',
            unavailable,
            message: unavailable
              ? t(
                  'Dịch vụ trợ lý chưa sẵn sàng trên máy chủ. Trong lúc chờ, hãy xem Báo cáo kinh doanh hoặc Bảng điều khiển.',
                )
              : error instanceof Error && error.message
                ? error.message
                : t('Không thể kết nối đến máy chủ.'),
          },
        ])
        settled.current?.(unavailable ? 'UNAVAILABLE' : 'ERROR')
      } finally {
        if (controller.current === abort) {
          controller.current = null
          setPending(false)
        }
      }
    },
    [update],
  )

  const send = useCallback(
    (text: string) => {
      const question = text.trim().slice(0, MAX_TURN_LENGTH)
      if (question) void run(question)
    },
    [run],
  )

  const reset = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setPending(false)
    update([])
  }, [update])

  return { items, pending, send, reset }
}
