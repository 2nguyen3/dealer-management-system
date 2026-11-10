import {
  BookCheck,
  Download,
  FileClock,
  FileCheck2,
  GitCommitVertical,
  History,
  Printer,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Card } from '../../components/shadcn/card'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Table } from '../../components/ui/Table'
import { apiDownload } from '../../lib/api'
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  formatVND,
} from '../../lib/formatters'
import { useAuth } from '../authentication/useAuth'
import { DocumentList } from './DocumentList'
import {
  parseRevision,
  type DocumentSummary,
  type Revision,
} from './documentContracts'
import { Fact, FactGrid, Hint } from './DocumentParts'
import { errorMessage, useDocumentPage } from './useDocumentRequests'

export function DocumentHistoryPage() {
  const { user, allowedFunctions } = useAuth()
  return <HistoryScreen key={`${user?.id}:${allowedFunctions.join(',')}`} />
}
function HistoryScreen() {
  const [selected, setSelected] = useState<DocumentSummary | null>(null)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Chứng từ"
        title="Lịch sử chứng từ"
        description="Xem lại các phiên bản của chứng từ, mở bản in hoặc tải PDF."
        className="mb-0"
      />
      <DocumentList
        onRowClick={(row) => setSelected(row)}
        actions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            icon={<History className="size-4" />}
            aria-label={`Phiên bản ${row.code}`}
            onClick={() => setSelected(row)}
          >
            Phiên bản
          </Button>
        )}
      />
      {selected && (
        <RevisionHistory doc={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

/** Icon for a revision event: creation, readiness or posting. */
function revisionIcon(item: Revision) {
  if (item.state === 'POSTED') return BookCheck
  if (item.state === 'READY') return FileCheck2
  return item.revisionNo === 1 ? FileClock : GitCommitVertical
}

const iconTone: Record<Revision['state'], string> = {
  POSTED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  READY: 'bg-sky-50 text-sky-700 ring-sky-200',
  DRAFT: 'bg-muted text-muted-foreground ring-border',
}

function TimelineSkeleton() {
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">Đang tải phiên bản...</span>
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex gap-3" aria-hidden="true">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RevisionHistory({
  doc,
  onClose,
}: {
  doc: DocumentSummary
  onClose: () => void
}) {
  const [cursors, setCursors] = useState([''])
  const query = new URLSearchParams({ limit: '25', sort: '-revisionNo' })
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!)
  const data = useDocumentPage(
    `/documents/${doc.id}/revisions?${query}`,
    parseRevision,
  )
  const [revision, setRevision] = useState<Revision | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const urls = useRef<Set<string>>(new Set())
  useEffect(
    () => () => {
      active.current?.abort()
      for (const url of urls.current) URL.revokeObjectURL(url)
    },
    [],
  )
  async function snapshot(
    item: Revision,
    media: 'text/html' | 'application/pdf',
  ) {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setExportBusy(true)
    setExportError(null)
    try {
      const result = await apiDownload(
        `/documents/${doc.id}/print?revisionNo=${item.revisionNo}`,
        { headers: { Accept: media }, signal: controller.signal },
      )
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(result.data)
      urls.current.add(url)
      if (media === 'text/html') {
        if (htmlUrl) {
          URL.revokeObjectURL(htmlUrl)
          urls.current.delete(htmlUrl)
        }
        setHtmlUrl(url)
      } else {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${doc.code}-v${item.revisionNo}.pdf`
        anchor.click()
        // Keep URLs until dialog cleanup so the browser can finish consuming them.
      }
    } catch (failure) {
      if (!controller.signal.aborted) setExportError(errorMessage(failure))
    } finally {
      if (!controller.signal.aborted) setExportBusy(false)
      active.current = null
    }
  }
  function view(item: Revision) {
    setRevision(item)
    if (htmlUrl) {
      URL.revokeObjectURL(htmlUrl)
      urls.current.delete(htmlUrl)
      setHtmlUrl(null)
    }
  }
  return (
    <Modal isOpen title={`Lịch sử ${doc.code}`} onClose={onClose} maxWidth="xl">
      <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <section aria-label="Dòng thời gian phiên bản" className="min-w-0">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Dòng thời gian
          </h3>
          {data.error && (
            <Alert type="error">
              <span className="flex flex-wrap items-center gap-3">
                {data.error}
                <Button variant="outline" size="sm" onClick={data.reload}>
                  Thử lại
                </Button>
              </span>
            </Alert>
          )}
          {data.loading && <TimelineSkeleton />}
          {data.page && (
            <>
              {!data.page.items.length && (
                <p className="text-sm text-muted-foreground">
                  Chưa có phiên bản.
                </p>
              )}
              <ol className="relative space-y-1">
                {data.page.items.map((item, index, items) => {
                  const Icon = revisionIcon(item)
                  const current = revision?.id === item.id
                  return (
                    <li key={item.id} className="relative flex gap-3 pb-4">
                      {index < items.length - 1 && (
                        <span
                          className="absolute top-9 bottom-0 left-4 w-px bg-border"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={cn(
                          'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-1',
                          iconTone[item.state],
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="size-4" />
                      </span>
                      <div
                        className={cn(
                          'min-w-0 flex-1 rounded-lg border px-3 py-2 transition-colors',
                          current
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-transparent hover:bg-muted/50',
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              v{item.revisionNo}
                            </span>
                            <StatusBadge status={item.state} />
                          </span>
                          <Button
                            variant={current ? 'secondary' : 'ghost'}
                            size="sm"
                            aria-label={`Xem v${item.revisionNo}`}
                            aria-pressed={current}
                            onClick={() => view(item)}
                          >
                            Xem
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          Ngày CT {formatDate(item.businessDate)} ·{' '}
                          {formatVND(item.totalAmount)}
                        </p>
                        {item.reason && (
                          <p className="mt-1 text-[13px] text-foreground">
                            {item.reason}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          <time dateTime={item.createdAt}>
                            Tạo lúc {formatDateTime(item.createdAt)}
                          </time>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
              {(data.page.pagination.hasMore || cursors.length > 1) && (
                <div className="-mx-4 lg:mx-0">
                  <Pagination
                    hasNext={data.page.pagination.hasMore}
                    hasPrevious={cursors.length > 1}
                    totalShowing={data.page.items.length}
                    onNext={() => {
                      if (data.page?.pagination.nextCursor)
                        setCursors([
                          ...cursors,
                          data.page.pagination.nextCursor,
                        ])
                    }}
                    onPrevious={() => setCursors(cursors.slice(0, -1))}
                  />
                </div>
              )}
            </>
          )}
        </section>
        <section aria-label="Nội dung phiên bản" className="min-w-0 space-y-4">
          {revision ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Nội dung phiên bản v{revision.revisionNo}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Printer className="size-4" />}
                    disabled={exportBusy}
                    onClick={() => void snapshot(revision, 'text/html')}
                  >
                    Xem bản in
                  </Button>
                  <Button
                    size="sm"
                    icon={<Download className="size-4" />}
                    isLoading={exportBusy}
                    onClick={() => void snapshot(revision, 'application/pdf')}
                  >
                    Tải PDF
                  </Button>
                </div>
              </div>
              <Card className="gap-0 p-4 shadow-xs">
                <FactGrid className="lg:grid-cols-3">
                  <Fact label="Trạng thái">
                    <StatusBadge status={revision.state} />
                  </Fact>
                  <Fact label="Ngày chứng từ">
                    <span className="tabular-nums">
                      {formatDate(revision.businessDate)}
                    </span>
                  </Fact>
                  <Fact label="Tổng tiền">
                    <span className="font-semibold tabular-nums">
                      {formatVND(revision.totalAmount)}
                    </span>
                  </Fact>
                  {revision.agencySnapshot && (
                    <Fact label="Đại lý" full>
                      <span className="font-medium">
                        {revision.agencySnapshot.name}
                      </span>
                      {revision.agencySnapshot.address && (
                        <span className="block text-xs text-muted-foreground">
                          {revision.agencySnapshot.address}
                        </span>
                      )}
                    </Fact>
                  )}
                  {revision.note && (
                    <Fact label="Ghi chú" full>
                      {revision.note}
                    </Fact>
                  )}
                </FactGrid>
              </Card>
              <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                <div className="overflow-x-auto">
                  <Table
                    caption="Dòng hàng của phiên bản"
                    className="min-w-[520px]"
                  >
                    <thead>
                      <tr>
                        <th>Mặt hàng</th>
                        <th className="cell-number">Số lượng</th>
                        <th>Đơn vị</th>
                        <th className="cell-number">Đơn giá</th>
                        <th className="cell-number">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revision.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="font-medium text-foreground">
                            {line.productName}
                          </td>
                          <td className="cell-number">
                            {formatQuantity(line.quantity)}
                          </td>
                          <td className="text-muted-foreground">
                            {line.unitName}
                          </td>
                          <td className="cell-number">
                            {formatVND(line.unitPrice)}
                          </td>
                          <td className="cell-number font-medium">
                            {formatVND(line.lineAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card>
              {exportError && <Alert type="error">{exportError}</Alert>}
              {htmlUrl && (
                <iframe
                  title={`Bản HTML ${doc.code}`}
                  src={htmlUrl}
                  sandbox=""
                  className="h-[60vh] w-full rounded-lg border bg-white"
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={<History className="size-6" />}
              title="Chọn một phiên bản"
              description="Bấm “Xem” trên dòng thời gian để xem nội dung, bản in hoặc tải PDF của phiên bản đó."
            />
          )}
        </section>
      </div>
      <Hint className="mt-4">
        Mỗi phiên bản giữ nguyên tên hàng, giá và thông tin đại lý tại thời điểm
        lập.
      </Hint>
    </Modal>
  )
}
