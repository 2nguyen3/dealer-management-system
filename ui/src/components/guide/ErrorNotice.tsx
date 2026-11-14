import { ArrowRight } from 'lucide-react'
import { SafeLink } from './SafeLink'
import { Alert } from '@/components/ui/Alert'
import { ApiError } from '@/lib/api'

/**
 * Error alert that, for a known API error code with a resolving page, adds a
 * shortcut link (e.g. UPFRONT_REQUIRED → Xác nhận trả ngay).
 */
export function ErrorNotice({
  error,
  message,
  to,
}: {
  /** The caught error; its `action` (ApiError) provides the link. */
  error: unknown
  /** Text to show; defaults to the error message. */
  message?: string | null
  /** Overrides the action target (e.g. a deep link with the document id). */
  to?: string
}) {
  const text =
    message ?? (error instanceof Error ? error.message : String(error ?? ''))
  if (!text) return null
  const action = error instanceof ApiError ? error.action : undefined
  return (
    <Alert type="error">
      <span>{text}</span>
      {action && (
        <SafeLink
          to={to ?? action.to}
          className="mt-1 inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </SafeLink>
      )}
    </Alert>
  )
}
