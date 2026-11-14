import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { UpfrontState } from './workflows'

const KNOWN = new Set(['VERIFIED', 'CONSUMED', 'RECEIVED_SEPARATELY'])

/**
 * State of the upfront confirmation linked to an issue's current revision.
 * `NONE` without a confirmation id; `UNKNOWN` while loading or on failure
 * (the UI then predicts nothing and the server decides).
 */
export function useUpfrontState(
  confirmationId: string | null | undefined,
  version = 0,
): UpfrontState {
  const [state, setState] = useState<{ key: string; value: UpfrontState }>({
    key: '',
    value: 'UNKNOWN',
  })
  const key = `${confirmationId ?? ''}:${version}`
  useEffect(() => {
    if (!confirmationId) return
    const controller = new AbortController()
    apiFetch<unknown>(
      `/upfront-confirmations/${encodeURIComponent(confirmationId)}`,
      { signal: controller.signal },
    )
      .then((response) => {
        const data = response.data
        const value =
          typeof data === 'object' &&
          data !== null &&
          'state' in data &&
          typeof data.state === 'string' &&
          KNOWN.has(data.state)
            ? (data.state as UpfrontState)
            : 'UNKNOWN'
        if (!controller.signal.aborted) setState({ key, value })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, value: 'UNKNOWN' })
      })
    return () => controller.abort()
  }, [confirmationId, key])
  if (!confirmationId) return 'NONE'
  return state.key === key ? state.value : 'UNKNOWN'
}
