import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import {
  parseReport,
  reportPath,
  type ReportPage,
  type ReportQuery,
} from '../reports/contracts'
import { parseDashboard, type Dashboard } from './contracts'
import { t } from '@/lib/i18n/core'

export interface ReportState {
  page: ReportPage | null
  error: string | null
  loading: boolean
  retry: () => void
}

/**
 * Loads one report page for a dashboard visual. `query === null` disables the
 * request (no permission). Each visual owns its own error so one failing
 * report never blanks the rest of the dashboard.
 */
export function useReport(
  query: ReportQuery | null,
  /** Identity/permission/refresh scope; any change refetches. */
  scope: string,
): ReportState {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    key: string
    page: ReportPage
  } | null>(null)
  const [failure, setFailure] = useState<{
    key: string
    message: string
  } | null>(null)
  let path: string | null = null
  let invalid: string | null = null
  if (query) {
    try {
      path = reportPath(query)
    } catch (err) {
      invalid = err instanceof Error ? err.message : t('Bộ lọc không hợp lệ.')
    }
  }
  const key = JSON.stringify([path, scope, attempt])
  const page = path && result?.key === key ? result.page : null
  const error = invalid ?? (failure?.key === key ? failure.message : null)

  useEffect(() => {
    if (!path || !query) return
    const controller = new AbortController()
    apiFetch<unknown>(path, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            page: parseReport(data, query.kind, query.fromDate, query.toDate),
          })
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setFailure({
            key,
            message:
              err instanceof Error ? err.message : t('Không thể tải báo cáo.'),
          })
      })
    return () => controller.abort()
    // `query` is fully represented by `path` inside `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return {
    page,
    error,
    loading: !!path && !page && !error,
    retry: () => setAttempt((n) => n + 1),
  }
}

export interface SnapshotState {
  data: Dashboard | null
  error: string | null
  loading: boolean
}

/** The authoritative `/dashboard` month snapshot (KPIs and trend). */
export function useSnapshot(
  selectedMonth: string,
  enabled: boolean,
  scope: string,
): SnapshotState {
  const [result, setResult] = useState<{ key: string; data: Dashboard } | null>(
    null,
  )
  const [failure, setFailure] = useState<{
    key: string
    message: string
  } | null>(null)
  const key = JSON.stringify([scope, selectedMonth])
  const data = enabled && result?.key === key ? result.data : null
  const error = enabled && failure?.key === key ? failure.message : null

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    apiFetch<unknown>(`/dashboard?month=${encodeURIComponent(selectedMonth)}`, {
      signal: controller.signal,
    })
      .then(({ data: value }) => {
        if (!controller.signal.aborted)
          setResult({ key, data: parseDashboard(value, selectedMonth) })
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setFailure({
            key,
            message:
              err instanceof Error
                ? err.message
                : t('Không thể tải bảng điều khiển.'),
          })
      })
    return () => controller.abort()
  }, [key, enabled, selectedMonth])

  return { data, error, loading: enabled && !data && !error }
}
