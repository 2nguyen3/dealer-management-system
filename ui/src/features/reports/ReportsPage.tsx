import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FileTextIcon, TableIcon } from '../../components/ui/Icons'
import { Select } from '../../components/ui/Select'
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
      <div className="page-header reports-header">
        <div>
          <h1 className="page-title">Báo cáo kinh doanh</h1>
          <p className="page-desc">
            Tra cứu số liệu bán hàng, công nợ, tồn kho và thu tiền theo kỳ; xuất
            toàn bộ kết quả ra PDF hoặc XLSX.
          </p>
        </div>
        {!!available.length && (
          <div className="reports-export">
            <Button
              type="button"
              variant="primary"
              icon={<FileTextIcon size={16} />}
              disabled={
                !page ||
                dirty ||
                (exportStatus?.key === key && exportStatus.phase === 'loading')
              }
              onClick={() => void exportFile('pdf')}
            >
              Xuất PDF
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<TableIcon size={16} />}
              disabled={
                !page ||
                dirty ||
                (exportStatus?.key === key && exportStatus.phase === 'loading')
              }
              onClick={() => void exportFile('xlsx')}
            >
              Xuất XLSX
            </Button>
          </div>
        )}
      </div>
      {!available.length ? (
        <Alert type="info">
          Bạn không có quyền xem báo cáo. Cần reports.read và quyền đọc nghiệp
          vụ tương ứng.
        </Alert>
      ) : (
        <>
          <form className="card reports-filter" onSubmit={apply}>
            <div className="form-grid reports-grid">
              <Select
                id="report-kind"
                label="Loại báo cáo"
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
                options={available.map((kind) => ({
                  value: kind,
                  label: reports[kind].label,
                }))}
              />
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
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      filters: { ...draft.filters, [filter]: e.target.value },
                    })
                  }
                />
              ))}
              <Select
                id="report-sort"
                label="Sắp xếp"
                value={draft.sort}
                onChange={(e) => setDraft({ ...draft, sort: e.target.value })}
                options={reports[draft.kind].sorts.map((sort) => ({
                  value: sort,
                  label: `${sort.startsWith('-') ? 'Giảm: ' : 'Tăng: '}${labels[sort.replace(/^-/, '')]}`,
                }))}
              />
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
            <div className="reports-actions">
              <Button
                type="submit"
                disabled={loading && !dirty}
              >
                Xem báo cáo
              </Button>
            </div>
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
            <section
              className="card reports-result"
              aria-label={reports[query.kind].label}
            >
              <h2>{reports[query.kind].label}</h2>
              <p>
                Kỳ [{page.fromDate}, {page.toDate})
              </p>
              <p className="text-muted">
                Máy chủ tạo lúc:{' '}
                <time dateTime={page.generatedAt}>{page.generatedAt}</time>
              </p>
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
                          <td key={col}>
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <div className="page-actions">
                <span>{page.items.length} dòng trên trang</span>
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
              </div>
              {page.totals && (
                <section aria-label="Tổng toàn bộ kết quả đã lọc">
                  <h3>Tổng toàn bộ kết quả đã lọc</h3>
                  <dl className="form-grid">
                    {Object.entries(page.totals).map(([name, value]) => (
                      <div key={name}>
                        <dt>{labels[name]}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
