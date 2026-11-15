import { ApiError, apiFetch } from '@/lib/api'
import {
  parseChatbotReply,
  type ChatbotMessageRequest,
  type ChatbotReply,
} from './contract'

/** Sends one assistant turn; rejects with ApiError on HTTP or contract errors. */
export async function sendChatbotMessage(
  request: ChatbotMessageRequest,
  signal?: AbortSignal,
): Promise<ChatbotReply> {
  const response = await apiFetch<unknown>('/chatbot/messages', {
    method: 'POST',
    body: request,
    signal,
  })
  const reply = parseChatbotReply(response.data)
  if (!reply)
    throw new ApiError(0, 'INVALID_RESPONSE', 'Unexpected assistant response')
  return reply
}

/**
 * The backend has not deployed the route (404/405/501) or reports the
 * assistant disabled/provider down (503 CHATBOT_UNAVAILABLE).
 */
export function isAssistantUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ([404, 405, 501].includes(error.status) ||
      error.code === 'CHATBOT_UNAVAILABLE' ||
      (error.status === 503 && error.code !== 'DATABASE_UNAVAILABLE'))
  )
}
