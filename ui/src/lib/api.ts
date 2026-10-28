import {
  getAccessToken,
  refreshSession,
  registerAuthenticatedAbortController,
} from '../features/authentication/session'
import type { ApiErrorPayload } from './types'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api/v1'
).replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly fieldErrors?: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.fieldErrors = fieldErrors
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  ifMatch?: string
  ifNoneMatch?: string
  idempotencyKey?: string
  requiresAuth?: boolean
}

export interface ApiResponse<T> {
  data: T
  status: number
  etag: string | null
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
  } = options

  const isAuthEndpoint = path.startsWith('/auth/')
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  }

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  if (ifMatch) {
    requestHeaders['If-Match'] = ifMatch
  }
  if (ifNoneMatch) {
    requestHeaders['If-None-Match'] = ifNoneMatch
  }
  if (idempotencyKey) {
    requestHeaders['Idempotency-Key'] = idempotencyKey
  }

  const token = getAccessToken()
  if (requiresAuth && token) {
    requestHeaders['Authorization'] = `Bearer ${token}`
  }

  let cleanupAbort: (() => void) | undefined
  let internalController: AbortController | undefined

  if (requiresAuth && !signal) {
    internalController = new AbortController()
    cleanupAbort = registerAuthenticatedAbortController(internalController)
  }

  const effectiveSignal = signal || internalController?.signal

  try {
    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
        signal: effectiveSignal,
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền.',
      )
    }

    // 401 Unauthorized handling: attempt silent token refresh for non-auth endpoints
    if (response.status === 401 && requiresAuth && !isAuthEndpoint) {
      const refreshed = await refreshSession(API_BASE_URL)
      if (refreshed?.accessToken) {
        requestHeaders['Authorization'] = `Bearer ${refreshed.accessToken}`
        try {
          response = await fetch(url, {
            method,
            headers: requestHeaders,
            body:
              body === undefined
                ? undefined
                : body instanceof FormData
                  ? body
                  : JSON.stringify(body),
            signal: effectiveSignal,
          })
        } catch (retryErr: unknown) {
          if (
            retryErr instanceof DOMException &&
            retryErr.name === 'AbortError'
          ) {
            throw retryErr
          }
          throw new ApiError(
            0,
            'NETWORK_ERROR',
            'Không thể kết nối đến máy chủ.',
          )
        }
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
      let errorPayload: ApiErrorPayload | null = null
      try {
        const json = (await response.json()) as ApiErrorPayload
        if (typeof json === 'object' && json !== null) {
          errorPayload = json
        }
      } catch {
        // Response was not JSON
      }

      const code = errorPayload?.code || `HTTP_${response.status}`
      const message =
        errorPayload?.message ||
        (response.status === 403
          ? 'Bạn không có quyền thực hiện thao tác này.'
          : response.status === 404
            ? 'Không tìm thấy dữ liệu yêu cầu.'
            : response.status === 412
              ? 'Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng tải lại.'
              : response.status === 429
                ? 'Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.'
                : response.status >= 500
                  ? 'Máy chủ gặp sự cố xử lý.'
                  : `Yêu cầu thất bại (HTTP ${response.status})`)

      throw new ApiError(
        response.status,
        code,
        message,
        errorPayload?.requestId,
        errorPayload?.fieldErrors,
      )
    }

    const data = (await response.json()) as T
    return {
      data,
      status: response.status,
      etag,
    }
  } finally {
    if (cleanupAbort) {
      cleanupAbort()
    }
  }
}
