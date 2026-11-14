import {
  HandCoins,
  CalendarRange,
  FileBarChart2,
  Package,
  RefreshCw,
  TrendingUp,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { notifyNextStep } from '../../components/guide/notifyNextStep'
import { WorkflowSteps } from '../../components/guide/WorkflowSteps'
import { t } from '../../lib/i18n/core'
import { reportSteps } from '../guide/workflows'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../components/blocks/PageHeader'
import { nextSort } from '../../components/data/sorting'
import { Badge } from '@/components/shadcn/badge'
import { Skeleton } from '@/components/shadcn/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/shadcn/tabs'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { apiFetch } from '../../lib/api'
import { formatDateTime } from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import { InfoTip } from '../dashboard/charts'
import {
  parseReport,
  reportPath,
  reports,
  vietnamMonth,
  type ReportKind,
  type ReportPage,
  type ReportQuery,
} from './contracts'
import { exportHint, periodLabel } from './display'
import { downloadReport, type reportMedia } from './export'
import { ExportMenu } from './ExportMenu'
import { defaultQuery } from './periods'
import { ReportFilters } from './ReportFilters'
import { ReportTable } from './ReportTable'
import { ReportCharts, ReportKpis } from './ReportVisuals'

/** Applied state of one report tab. */
interface Applied {
  query: ReportQuery
  cursor: string | null
  history: (string | null)[]
  reload: number
}

const tabLabels: Record<ReportKind, string> = {
  sales: t('Doanh số đại lý'),
  debt: t('Công nợ'),
  inventory: t('Xuất nhập tồn'),
  'product-sales': t('Doanh số mặt hàng'),
  collections: t('Thu tiền'),
}

const tabIcons: Record<ReportKind, LucideIcon> = {
  sales: TrendingUp,
  debt: Wallet,
  inventory: Warehouse,
  'product-sales': Package,
  collections: HandCoins,
}

const notes: Partial<Record<ReportKind, string>> = {
  collections: t(
    'Mỗi dòng là một ngày có phiếu thu đã ghi sổ; phiếu đã hủy không được tính.',
  ),
  debt: t(
    'Nợ âm nghĩa là đại lý đang trả trước (thanh toán trực tuyến đến sau khi nợ đã được trả).',
  ),
  inventory: t('Số lượng tính theo đơn vị của từng mặt hàng.'),
}

function LoadingReport() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{t('Đang tải báo cáo...')}</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

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
  const [month] = useState(() => vietnamMonth())
  const [active, setActive] = useState<ReportKind>(available[0] || 'sales')
  const kind = available.includes(active) ? active : available[0] || 'sales'
  const [drafts, setDrafts] = useState<
    Partial<Record<ReportKind, ReportQuery>>
  >({})
  const [applied, setApplied] = useState<Partial<Record<ReportKind, Applied>>>(
    {},
  )
  const [resets, setResets] = useState(0)
  const draft = drafts[kind] ?? defaultQuery(kind, month)
  const current = applied[kind] ?? null
  const query = current?.query ?? null
  const cursor = current?.cursor ?? null
  const [result, setResult] = useState<{
    key: string
    page: ReportPage
  } | null>(null)
  const [failure, setFailure] = useState<{
    key: string
    message: string
  } | null>(null)
  const [formError, setFormError] = useState<{
    kind: ReportKind
    message: string
  } | null>(null)
  const [exportStatus, setExportStatus] = useState<{
    key: string
    message: string
    phase: 'loading' | 'success' | 'error'
  } | null>(null)
  const exportController = useRef<AbortController | null>(null)
  const permitted = !!query && available.includes(query.kind)
  const key = JSON.stringify([
    user?.id,
    grantKey,
    query,
    cursor,
    current?.reload,
  ])
  const page = result?.key === key && permitted ? result.page : null
  const error = failure?.key === key ? failure.message : null
  const loading = !!query && permitted && !page && !error
  const dirty = JSON.stringify(draft) !== JSON.stringify(query)
  const exporting =
    exportStatus?.key === key && exportStatus.phase === 'loading'
  const exportReason = exportHint(!!page, dirty, exporting)
  const defaults = defaultQuery(kind, month)

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
                err instanceof Error
                  ? err.message
                  : t('Không thể tải báo cáo.'),
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

  function update(next: Partial<Applied>) {
    if (!current) return
    setApplied({ ...applied, [kind]: { ...current, ...next } })
  }

  function apply() {
    try {
      reportPath(draft)
      if (!available.includes(draft.kind))
        throw new Error(t('Bạn không có quyền đọc báo cáo này.'))
      exportController.current?.abort()
      setFormError(null)
      setApplied({
        ...applied,
        [kind]: {
          query: draft,
          cursor: null,
          history: [],
          reload: (current?.reload ?? 0) + 1,
        },
      })
    } catch (err) {
      setFormError({
        kind,
        message: err instanceof Error ? err.message : t('Bộ lọc không hợp lệ.'),
      })
    }
  }

  /** Header click: new server order for the applied query, from page one. */
  function sortBy(field: string, firstDirection?: 'asc' | 'desc') {
    if (!current) return
    const next =
      nextSort(current.query.sort, field, firstDirection) || defaults.sort
    if (!reports[kind].sorts.includes(next)) return
    exportController.current?.abort()
    setDrafts({ ...drafts, [kind]: { ...draft, sort: next } })
    setApplied({
      ...applied,
      [kind]: {
        query: { ...current.query, sort: next },
        cursor: null,
        history: [],
        reload: current.reload + 1,
      },
    })
  }

  function reset() {
    setDrafts({ ...drafts, [kind]: defaults })
    setFormError(null)
    setResets((n) => n + 1)
  }

  async function exportFile(format: keyof typeof reportMedia) {
    if (!query || !permitted || dirty || exportController.current) return
    const controller = new AbortController()
    exportController.current = controller
    setExportStatus({
      key,
      message: t('Đang xuất toàn bộ kết quả đã lọc...'),
      phase: 'loading',
    })
    try {
      await downloadReport(query, format, controller.signal)
      if (!controller.signal.aborted)
        setExportStatus({
          key,
          message: t('Đã tải tệp báo cáo toàn bộ kết quả đã lọc.'),
          phase: 'success',
        })
      if (!controller.signal.aborted)
        notifyNextStep({
          done: t('Đã tải tệp báo cáo.'),
          next: t(
            'Tệp gồm toàn bộ kết quả theo bộ lọc đang áp dụng, không chỉ trang đang xem.',
          ),
        })
    } catch (err) {
      if (!controller.signal.aborted)
        setExportStatus({
          key,
          message:
            err instanceof Error ? err.message : t('Không thể xuất báo cáo.'),
          phase: 'error',
        })
    } finally {
      if (exportController.current === controller)
        exportController.current = null
    }
  }

  const panel = (
    <div className="space-y-6">
      <WorkflowSteps
        label={t('Các bước lập báo cáo')}
        steps={reportSteps(
          !!query,
          dirty,
          exportStatus?.key === key && exportStatus.phase === 'success',
        )}
      />
      <ReportFilters
        key={`${kind}-${resets}`}
        draft={draft}
        month={month}
        onChange={(next) => setDrafts({ ...drafts, [kind]: next })}
        onApply={apply}
        onReset={reset}
        canReset={JSON.stringify(draft) !== JSON.stringify(defaults)}
        applyDisabled={loading && !dirty}
      />
      {formError?.kind === kind && (
        <Alert type="error">{formError.message}</Alert>
      )}
      {exportStatus?.key === key && (
        <Alert
          type={
            exportStatus.phase === 'error'
              ? 'error'
              : exportStatus.phase === 'success'
                ? 'success'
                : 'info'
          }
        >
          {exportStatus.message}
        </Alert>
      )}
      {!query && (
        <div role="status">
          <EmptyState
            icon={<FileBarChart2 className="size-6" />}
            title={t('Chưa có dữ liệu báo cáo')}
            description={t('Chọn bộ lọc và nhấn Áp dụng để tải dữ liệu.')}
          />
        </div>
      )}
      {loading && <LoadingReport />}
      {error && (
        <Alert type="error" title={t('Không thể tải báo cáo')}>
          <span className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="size-3.5" />}
              onClick={() => update({ reload: (current?.reload ?? 0) + 1 })}
            >
              {t('Thử lại')}
            </Button>
          </span>
        </Alert>
      )}
      {page && query && (
        <section className="space-y-6" aria-label={reports[query.kind].label}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight">
                {reports[query.kind].label}
                {notes[query.kind] && (
                  <InfoTip label={t('Ghi chú báo cáo')}>
                    {notes[query.kind]}
                  </InfoTip>
                )}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarRange className="size-3.5" aria-hidden="true" />
                <span>
                  {t('Kỳ báo cáo: {periodLabel}', {
                    periodLabel: periodLabel(page.fromDate, page.toDate),
                  })}
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('Lập lúc')}{' '}
              <time dateTime={page.generatedAt}>
                {formatDateTime(page.generatedAt)}
              </time>
            </p>
          </div>
          {!page.items.length ? (
            <div role="status">
              <EmptyState
                title={t('Không có dữ liệu')}
                description={t('Không có dữ liệu trong kỳ và bộ lọc đã chọn.')}
              />
            </div>
          ) : (
            <>
              <ReportKpis kind={query.kind} page={page} />
              <ReportCharts kind={query.kind} page={page} />
              <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{t('Chi tiết')}</h3>
                  <Badge variant="secondary" className="tabular-nums">
                    {t('{count} dòng', { count: page.items.length })}
                  </Badge>
                </div>
                <ReportTable
                  kind={query.kind}
                  page={page}
                  sort={query.sort}
                  onSort={sortBy}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!current?.history.length}
                    onClick={() => {
                      const history = current?.history ?? []
                      update({
                        cursor: history[history.length - 1]!,
                        history: history.slice(0, -1),
                      })
                    }}
                  >
                    {t('Trang trước')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!page.pagination.hasMore}
                    onClick={() =>
                      update({
                        history: [...(current?.history ?? []), cursor],
                        cursor: page.pagination.nextCursor,
                      })
                    }
                  >
                    {t('Trang tiếp')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Phân tích')}
        title={t('Báo cáo kinh doanh')}
        actions={
          available.length ? (
            <ExportMenu
              reason={exportReason}
              onExport={(format) => void exportFile(format)}
            />
          ) : undefined
        }
      />
      {!available.length ? (
        <Alert type="info">
          {t(
            'Bạn không có quyền xem báo cáo. Liên hệ quản trị viên để được cấp quyền.',
          )}
        </Alert>
      ) : (
        <Tabs
          value={kind}
          onValueChange={(value) => setActive(value as ReportKind)}
          className="gap-4"
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList aria-label={t('Loại báo cáo')}>
              {available.map((item) => {
                const Icon = tabIcons[item]
                return (
                  <TabsTrigger key={item} value={item} className="px-3">
                    <Icon aria-hidden="true" />
                    {tabLabels[item]}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>
          {available.map((item) => (
            <TabsContent key={item} value={item}>
              {item === kind && panel}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
