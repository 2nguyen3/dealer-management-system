import { describeError, ERROR_TEXTS, type ErrorText } from './errors'
import { t } from './i18n/core'
import {
  getAccessToken,
  getSessionGeneration,
  refreshSession,
  registerAuthenticatedAbortController,
} from '../features/authentication/session'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api/v1'
).replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly fieldErrors?: Record<string, string>
  readonly retryAfter?: string
  /** Translated guidance for a known code (see `src/lib/errors.ts`). */
  readonly hint?: string
  /** Page that resolves a known code, if any. */
  readonly action?: ErrorText['action']

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    fieldErrors?: Record<string, string>,
    retryAfter?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.fieldErrors = fieldErrors
    this.retryAfter = retryAfter
    const known = describeError(code)
    if (known?.hint) this.hint = known.hint
    if (known?.action) this.action = known.action
  }
}

/**
 * User-facing text for a known error code: the message followed by its hint.
 * Unknown codes keep the server's own message (see `apiFetch`).
 */
export function errorCodeMessage(code: string): string | null {
  const known = describeError(code)
  if (!known) return null
  return known.hint ? `${known.message} ${known.hint}` : known.message
}

/** Vietnamese source texts per code, kept for callers that build an ApiError. */
export const ERROR_CODE_MESSAGES: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(ERROR_TEXTS as Record<string, ErrorText>).map(
      ([code, text]) => [
        code,
        text.hint ? `${text.message} ${text.hint}` : text.message,
      ],
    ),
  )

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  ifMatch?: string
  ifNoneMatch?: string
  idempotencyKey?: string
  requiresAuth?: boolean
  responseType?: 'json' | 'blob'
  validate?: (data: unknown) => boolean
}

export interface ApiResponse<T> {
  data: T
  status: number
  etag: string | null
  contentType?: string | null
}

export async function checkApiHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}`)
  }
  const body: unknown = await response.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('status' in body) ||
    body.status !== 'ok'
  ) {
    throw new Error('Unexpected API health response')
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    signal,
    ifMatch,
    ifNoneMatch,
    idempotencyKey,
    requiresAuth = true,
    responseType = 'json',
    validate,
  } = options

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const isAuthEndpoint = normalizedPath.startsWith('/auth/')
  const generation = getSessionGeneration()
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Accept'))
    requestHeaders.set('Accept', 'application/json')

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (ifMatch) {
    requestHeaders.set('If-Match', ifMatch)
  }
  if (ifNoneMatch) {
    requestHeaders.set('If-None-Match', ifNoneMatch)
  }
  if (idempotencyKey) {
    requestHeaders.set('Idempotency-Key', idempotencyKey)
  }

  const token = getAccessToken()
  if (requiresAuth && token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  const controller = new AbortController()
  const cleanupAbort = requiresAuth
    ? registerAuthenticatedAbortController(controller)
    : undefined
  const effectiveSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal
  const assertCurrent = () => {
    effectiveSignal.throwIfAborted()
    if (requiresAuth && generation !== getSessionGeneration()) {
      throw new DOMException('Session changed', 'AbortError')
    }
  }
  const send = async () => {
    assertCurrent()
    try {
      const result = await fetch(url, {
        method,
        headers: requestHeaders,
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
        signal: effectiveSignal,
        cache: 'no-store',
      })
      assertCurrent()
      return result
    } catch (error) {
      assertCurrent()
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        t('Không thể kết nối đến máy chủ.'),
      )
    }
  }

  try {
    let response = await send()

    // Mutations are never replayed: 401 alone does not prove pre-auth rejection.
    if (
      response.status === 401 &&
      method === 'GET' &&
      requiresAuth &&
      !isAuthEndpoint
    ) {
      const refreshed =
        getAccessToken() !== token
          ? { accessToken: getAccessToken() }
          : await refreshSession(API_BASE_URL)
      assertCurrent()
      if (refreshed?.accessToken) {
        requestHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`)
        response = await send()
      }
    }

    const etag = response.headers.get('ETag')

    // Handle 204 No Content
    if (response.status === 204) {
      return {
        data: undefined as unknown as T,
        status: response.status,
        etag,
      }
    }

    if (!response.ok) {
      let errorPayload: Record<string, unknown> = {}
      try {
        const json: unknown = await response.json()
        if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
          errorPayload = json as Record<string, unknown>
        }
      } catch {
        // Response was not JSON
      }

      assertCurrent()
      const code =
        typeof errorPayload.code === 'string' &&
        /^[A-Z][A-Z0-9_]{0,100}$/.test(errorPayload.code)
          ? errorPayload.code
          : `HTTP_${response.status}`
      const message =
        (response.status < 500 ? errorCodeMessage(code) : null) ||
        (response.status < 500 &&
        typeof errorPayload.message === 'string' &&
        errorPayload.message.length <= 1000 &&
        errorPayload.message.trim()
          ? errorPayload.message
          : null) ||
        (response.status === 403
          ? t('Bạn không có quyền thực hiện thao tác này.')
          : response.status === 404
            ? t('Không tìm thấy dữ liệu yêu cầu.')
            : response.status === 412
              ? t(
                  'Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng tải lại.',
                )
              : response.status === 429
                ? t('Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.')
                : response.status >= 500
                  ? t('Máy chủ gặp sự cố xử lý.')
                  : t('Yêu cầu thất bại (HTTP {status})', {
                      status: response.status,
                    }))

      const fields: Record<string, string> = Object.create(null) as Record<
        string,
        string
      >
      if (Array.isArray(errorPayload.fieldErrors)) {
        for (const field of errorPayload.fieldErrors as unknown[]) {
          if (typeof field !== 'object' || field === null) continue
          const item = field as Record<string, unknown>
          if (
            typeof item.field === 'string' &&
            typeof item.message === 'string' &&
            item.message.length <= 1000
          ) {
            fields[item.field] = item.message
          }
        }
      }
      throw new ApiError(
        response.status,
        code,
        message,
        typeof errorPayload.requestId === 'string' &&
          /^[\w.-]{1,200}$/.test(errorPayload.requestId)
          ? errorPayload.requestId
          : undefined,
        Object.keys(fields).length ? fields : undefined,
        response.headers.get('Retry-After') || undefined,
      )
    }

    let data: unknown
    try {
      data =
        responseType === 'blob' ? await response.blob() : await response.json()
    } catch {
      assertCurrent()
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        t('Phản hồi máy chủ không hợp lệ.'),
      )
    }
    assertCurrent()
    if (validate && !validate(data)) {
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        t('Phản hồi máy chủ không hợp lệ.'),
      )
    }
    return {
      data: data as T,
      status: response.status,
      etag,
      contentType: response.headers.get('Content-Type'),
    }
  } finally {
    if (cleanupAbort) {
      cleanupAbort()
    }
  }
}

export async function apiDownload(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<Blob>> {
  const accept = new Headers(options.headers).get('Accept')
  if (
    !accept ||
    ![
      'application/pdf',
      'text/html',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(accept)
  ) {
    throw new ApiError(0, 'INVALID_ACCEPT', t('Cần chọn định dạng tải xuống.'))
  }
  const response = await apiFetch<Blob>(path, {
    ...options,
    responseType: 'blob',
  })
  if (
    response.status === 204 ||
    response.contentType?.split(';')[0]?.trim().toLowerCase() !== accept
  ) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      t('Định dạng tải xuống không hợp lệ.'),
    )
  }
  return response
}
