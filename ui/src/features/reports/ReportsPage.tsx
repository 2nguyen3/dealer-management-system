import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../authentication/useAuth'
import {
  labels,
  parseReport,
  reportPath,
  reports,
  rowRules,
  vietnamMonth,
  type ReportKind,
  type ReportPage,
  type ReportQuery,
} from './contracts'
import { downloadReport, type reportMedia } from './export'

export function ReportsPage() {
  const { user, allowedFunctions } = useAuth()
  const grantKey = [...allowedFunctions].sort().join(',')
  const grants = new Set<string>(allowedFunctions)
  const available = (Object.keys(reports) as ReportKind[]).filter(
    (kind) =>
      !!user &&
      grants.has('reports.read') &&
      grants.has(reports[kind].permission),
  )
  const initialMonth = vietnamMonth()
  const [draft, setDraft] = useState<ReportQuery>({
    kind: available[0] || 'sales',
    fromDate: `${initialMonth}-01`,
    toDate: initialMonth.endsWith('-12')
      ? `${Number(initialMonth.slice(0, 4)) + 1}-01-01`
      : `${initialMonth.slice(0, 5)}${String(Number(initialMonth.slice(5)) + 1).padStart(2, '0')}-01`,
    filters: {},
    sort: reports[available[0] || 'sales'].sorts[0]!,
    limit: '25',
  })
  const [query, setQuery] = useState<ReportQuery | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [history, setHistory] = useState<(string | null)[]>([])
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<{
    key: string
    page: ReportPage
  } | null>(null)
  const [failure, setFailure] = useState<{
    key: string
    message: string
  } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<{
    key: string
    message: string
    phase: 'loading' | 'success' | 'error'
  } | null>(null)
  const exportController = useRef<AbortController | null>(null)
  const permitted = !!query && available.includes(query.kind)
  const key = JSON.stringify([user?.id, grantKey, query, cursor, reload])
  const page = result?.key === key && permitted ? result.page : null
  const error = failure?.key === key ? failure.message : null
  const loading = !!query && permitted && !page && !error
  const dirty = JSON.stringify(draft) !== JSON.stringify(query)

  useEffect(() => {
    const controller = new AbortController()
    if (query && permitted) {
      apiFetch<unknown>(reportPath(query, cursor), {
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
                err instanceof Error ? err.message : 'Không thể tải báo cáo.',
            })
        })
    }
    return () => controller.abort()
  }, [key, query, cursor, permitted])

  useEffect(
    () => () => {
      exportController.current?.abort()
      exportController.current = null
    },
    [key],
  )

  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      reportPath(draft)
      if (!available.includes(draft.kind))
        throw new Error('Bạn không có quyền đọc báo cáo này.')
      exportController.current?.abort()
      setFormError(null)
      setCursor(null)
      setHistory([])
      setQuery(draft)
      setReload((n) => n + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Bộ lọc không hợp lệ.')
    }
  }

  async function exportFile(format: keyof typeof reportMedia) {
    if (!query || !permitted || dirty || exportController.current) return
    const controller = new AbortController()
    exportController.current = controller
    setExportStatus({
      key,
      message: 'Đang xuất toàn bộ kết quả đã lọc...',
      phase: 'loading',
    })
    try {
      await downloadReport(query, format, controller.signal)
      if (!controller.signal.aborted)
        setExportStatus({
          key,
          message: 'Đã tải tệp báo cáo toàn bộ kết quả đã lọc.',
          phase: 'success',
        })
    } catch (err) {
      if (!controller.signal.aborted)
        setExportStatus({
          key,
          message:
            err instanceof Error ? err.message : 'Không thể xuất báo cáo.',
          phase: 'error',
        })
    } finally {
      if (exportController.current === controller)
        exportController.current = null
    }
  }

  const columns = query ? Object.keys(rowRules[query.kind]) : []
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">AGENTRA / REPORTS</p>
          <h1 className="page-title">Báo cáo kinh doanh</h1>
          <p className="page-desc">
            Số liệu từ máy chủ. Không suy diễn từ danh sách đại lý, hàng hóa
            hoặc phiếu xuất.
          </p>
        </div>
      </div>
      {!available.length ? (
        <Alert type="info">
          Bạn không có quyền xem báo cáo. Cần reports.read và quyền đọc nghiệp
          vụ tương ứng.
        </Alert>
      ) : (
        <>
          <form className="card" onSubmit={apply}>
            <div className="form-grid">
              <label className="form-field">
                Loại báo cáo
                <select
                  className="input"
                  value={draft.kind}
                  onChange={(e) => {
                    const kind = e.target.value as ReportKind
                    setDraft({
                      ...draft,
                      kind,
                      filters: {},
                      sort: reports[kind].sorts[0]!,
                    })
                  }}
                >
                  {available.map((kind) => (
                    <option key={kind} value={kind}>
                      {reports[kind].label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                id="report-from"
                label="Từ ngày"
                type="date"
                required
                value={draft.fromDate}
                onChange={(e) =>
                  setDraft({ ...draft, fromDate: e.target.value })
                }
              />
              <Input
                id="report-to"
                label="Đến ngày (không gồm)"
                type="date"
                required
                value={draft.toDate}
                onChange={(e) => setDraft({ ...draft, toDate: e.target.value })}
              />
              {reports[draft.kind].filters.map((filter) => (
                <Input
                  key={filter}
                  id={`report-${filter}`}
                  label={labels[filter]}
                  inputMode="numeric"
                  value={draft.filters[filter] || ''}
                  helperText="Để trống để không lọc; dùng ID từ màn hình nghiệp vụ."
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      filters: { ...draft.filters, [filter]: e.target.value },
                    })
                  }
                />
              ))}
              <label className="form-field">
                Sắp xếp
                <select
                  className="input"
                  value={draft.sort}
                  onChange={(e) => setDraft({ ...draft, sort: e.target.value })}
                >
                  {reports[draft.kind].sorts.map((sort) => (
                    <option key={sort} value={sort}>
                      {sort.startsWith('-') ? 'Giảm: ' : 'Tăng: '}
                      {labels[sort.replace(/^-/, '')]}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                id="report-limit"
                label="Số dòng mỗi trang (1-100)"
                type="number"
                min="1"
                max="100"
                value={draft.limit}
                onChange={(e) => setDraft({ ...draft, limit: e.target.value })}
              />
            </div>
            <div className="page-actions">
              <Button type="submit" disabled={loading && !dirty}>
                Xem báo cáo
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !page ||
                  dirty ||
                  (exportStatus?.key === key &&
                    exportStatus.phase === 'loading')
                }
                onClick={() => void exportFile('pdf')}
              >
                Xuất PDF toàn bộ
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !page ||
                  dirty ||
                  (exportStatus?.key === key &&
                    exportStatus.phase === 'loading')
                }
                onClick={() => void exportFile('xlsx')}
              >
                Xuất XLSX toàn bộ
              </Button>
            </div>
            <p className="text-muted">
              Chỉ tải khi nhấn Xem báo cáo. Xuất dùng cùng kỳ và bộ lọc đã áp
              dụng, không giới hạn ở trang hiện tại.
            </p>
          </form>
          {formError && <Alert type="error">{formError}</Alert>}
          {exportStatus?.key === key && (
            <Alert type={exportStatus.phase === 'error' ? 'error' : 'info'}>
              {exportStatus.message}
            </Alert>
          )}
          {!query && (
            <p role="status">
              Chọn báo cáo và nhấn Xem báo cáo để tải dữ liệu.
            </p>
          )}
          {query && !permitted && (
            <Alert type="error">
              Quyền đọc báo cáo đã thay đổi. Chọn lại báo cáo được cấp quyền.
            </Alert>
          )}
          {loading && <Spinner label="Đang tải báo cáo..." />}
          {error && (
            <Alert type="error">
              {error}{' '}
              <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
                Thử lại
              </Button>
            </Alert>
          )}
          {page && query && (
            <section className="card" aria-label={reports[query.kind].label}>
              <h2>{reports[query.kind].label}</h2>
              <p>
                Kỳ [{page.fromDate}, {page.toDate})
              </p>
              <p className="text-muted">
                Máy chủ tạo lúc:{' '}
                <time dateTime={page.generatedAt}>{page.generatedAt}</time>
              </p>
              {query.kind === 'sales' && (
                <p>
                  Tỷ lệ do máy chủ tính theo doanh số gộp toàn doanh nghiệp,
                  không theo tổng trang hoặc tổng bộ lọc.
                </p>
              )}
              {query.kind === 'cash-and-credit' && (
                <p>
                  Dư có cuối kỳ là lịch sử tại cuối kỳ; phần đang dành và khả
                  dụng là số dư hiện tại. Tiền xác minh chưa ghi phiếu thu được
                  trình bày riêng.
                </p>
              )}
              {query.kind === 'inventory' && (
                <p>
                  Số lượng theo từng đơn vị mặt hàng; không cộng tổng khác đơn
                  vị.
                </p>
              )}
              {!page.items.length ? (
                <p role="status">
                  Không có dữ liệu trong kỳ và bộ lọc đã chọn.
                </p>
              ) : (
                <Table caption={reports[query.kind].label}>
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th scope="col" key={col}>
                          {labels[col]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((row) => (
                      <tr key={String(row.agencyId ?? row.productId)}>
                        {columns.map((col) => (
                          <td key={col} className="font-mono">
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              {page.totals && (
                <section aria-label="Tổng toàn bộ kết quả đã lọc">
                  <h3>Tổng toàn bộ kết quả đã lọc (không riêng trang)</h3>
                  <dl className="form-grid">
                    {Object.entries(page.totals).map(([name, value]) => (
                      <div key={name}>
                        <dt>{labels[name]}</dt>
                        <dd className="font-mono">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              <div className="page-actions">
                <Button
                  variant="outline"
                  disabled={!history.length}
                  onClick={() => {
                    setCursor(history[history.length - 1]!)
                    setHistory(history.slice(0, -1))
                  }}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  disabled={!page.pagination.hasMore}
                  onClick={() => {
                    setHistory([...history, cursor])
                    setCursor(page.pagination.nextCursor)
                  }}
                >
                  Trang tiếp
                </Button>
                <span>{page.items.length} dòng trên trang</span>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
