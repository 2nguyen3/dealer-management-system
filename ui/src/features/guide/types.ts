import type { ErrorCode } from '@/lib/errors'

/**
 * Route guide content. Every text is a Vietnamese message ID wrapped in
 * `msg()` so it is extracted and translated; render it through `t()`.
 * Never put business data (agency/product names, document codes) here.
 */
export interface GuideStep {
  /** Short step name, e.g. msg('Nộp phiếu'). */
  label: string
  /** Who performs it, e.g. msg('Kinh doanh'). */
  role?: string
}

export interface GuideContent {
  /** Route path, exactly as in `routePermissions` (or '/', '/profile', '/chatbot'). */
  path: string
  /** "Trang này để làm gì" — one or two sentences. */
  purpose: string
  /** "Ai làm" — one line per role, naming the permission in plain words. */
  roles: readonly string[]
  /** "Sơ đồ các bước" for workflow pages; omitted for read-only pages. */
  flow?: readonly GuideStep[]
  /** "Từng bước chi tiết" — ordered instructions. */
  steps: readonly string[]
  /** "Quy định nghiệp vụ liên quan". */
  rules?: readonly string[]
  /** "Lỗi thường gặp" — codes from `src/lib/errors.ts`. */
  errors?: readonly ErrorCode[]
  /** Extra tips / FAQ lines. */
  tips?: readonly string[]
  /** "Liên kết trang liên quan" — other route paths. */
  related?: readonly string[]
}
