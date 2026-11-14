import {
  ArrowDown,
  BookCheck,
  Download,
  ExternalLink,
  FilePen,
  GitBranch,
  Printer,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { SafeLink } from '../../components/guide/SafeLink'
import { apiDownload, apiFetch } from '../../lib/api'
import { formatDate, formatVND } from '../../lib/formatters'
import { kindLabel } from '../../lib/labels'
import { useAuth } from '../authentication/useAuth'
import { usePathAllowed } from '../guide/usePathAllowed'
import { DocumentSnapshot } from '../stock_receipts/DocumentSnapshot'
import { DocumentList } from './DocumentList'
import {
  documentLink,
  parseChain,
  parseDocument,
  type ChainItem,
  type DocumentDetail,
  type DocumentSummary,
} from './documentContracts'
import { InfoTip } from './DocumentParts'
import { errorMessage } from './useDocumentRequests'
import { t } from '@/lib/i18n/core'

export function DocumentHistoryPage() {
  const { user, allowedFunctions } = useAuth()
  return <HistoryScreen key={`${user?.id}:${allowedFunctions.join(',')}`} />
}
function HistoryScreen() {
  const [selected, setSelected] = useState<DocumentSummary | null>(null)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Chứng từ')}
        title={t('Lịch sử chứng từ')}
        description={t(
          'Chuỗi thay thế, bản in và PDF của phiếu nhập, phiếu xuất và phiếu thu.',
        )}
        className="mb-0"
      />
      <DocumentList
        onRowClick={(row) => setSelected(row)}
        actions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            icon={<GitBranch className="size-4" />}
            aria-label={t('Lịch sử {code}', { code: row.code })}
            onClick={() => setSelected(row)}
          >
            {t('Lịch sử')}
          </Button>
        )}
      />
      {selected && (
        <DocumentChain doc={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function chainIcon(item: ChainItem) {
  if (item.status === 'CANCELLED') return XCircle
  if (item.status === 'POSTED') return BookCheck
  return FilePen
}
const iconTone: Record<ChainItem['status'], string> = {
  POSTED: 'bg-success/12 text-success ring-success/30',
  CANCELLED: 'bg-destructive/12 text-destructive ring-destructive/30',
  DRAFT: 'bg-muted text-muted-foreground ring-border',
}

function TimelineSkeleton() {
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">{t('Đang tải chuỗi thay thế...')}</span>
      {[0, 1].map((item) => (
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

/**
 * Replacement chain of a document (original → replacement → …, from
 * `GET /documents/{id}/chain`), the content of the chosen step and its
 * print/PDF. Documents are read-only here; drafts are edited on their page.
 */
export function DocumentChain({
  doc,
  onClose,
}: {
  doc: Pick<DocumentSummary, 'id' | 'code' | 'kind'>
  onClose: () => void
}) {
  const pathAllowed = usePathAllowed()
  const [reload, setReload] = useState(0)
  const [chain, setChain] = useState<{
    key: string
    items: ChainItem[] | null
    error: string | null
  }>({ key: '', items: null, error: null })
  const chainKey = `${doc.id}:${reload}`
  const [chosen, setChosen] = useState(doc.id)
  const [detail, setDetail] = useState<{
    id: string
    doc: DocumentDetail | null
    error: string | null
  }>({ id: '', doc: null, error: null })
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const urls = useRef<Set<string>>(new Set())

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<unknown>(`/documents/${doc.id}/chain`, {
      signal: controller.signal,
    })
      .then((result) => {
        const items = parseChain(result.data)
        if (!controller.signal.aborted)
          setChain({ key: chainKey, items, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setChain({ key: chainKey, items: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [doc.id, chainKey])

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<unknown>(`/documents/${chosen}`, { signal: controller.signal })
      .then((result) => {
        const parsed = parseDocument(result.data)
        if (!controller.signal.aborted)
          setDetail({ id: chosen, doc: parsed, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setDetail({ id: chosen, doc: null, error: errorMessage(error) })
      })
    return () => controller.abort()
  }, [chosen, reload])

  useEffect(
    () => () => {
      active.current?.abort()
      for (const url of urls.current) URL.revokeObjectURL(url)
    },
    [],
  )

  function clearPreview() {
    if (htmlUrl) {
      URL.revokeObjectURL(htmlUrl)
      urls.current.delete(htmlUrl)
      setHtmlUrl(null)
    }
  }
  function choose(id: string) {
    if (id === chosen) return
    clearPreview()
    setExportError(null)
    setChosen(id)
  }
  async function print(
    target: DocumentDetail,
    media: 'text/html' | 'application/pdf',
  ) {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setExportBusy(true)
    setExportError(null)
    try {
      const result = await apiDownload(`/documents/${target.id}/print`, {
        headers: { Accept: media },
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(result.data)
      urls.current.add(url)
      if (media === 'text/html') {
        clearPreview()
        setHtmlUrl(url)
      } else {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${target.code}.pdf`
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

  const items = chain.key === chainKey ? chain.items : null
  const chainError = chain.key === chainKey ? chain.error : null
  const current = detail.id === chosen ? detail.doc : null
  const currentError = detail.id === chosen ? detail.error : null
  const pageLink = current ? documentLink(current.kind, current.id) : null
  return (
    <Modal
      isOpen
      title={t('Lịch sử {code}', { code: doc.code })}
      onClose={onClose}
      maxWidth="xl"
    >
      <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <section aria-label={t('Chuỗi thay thế')} className="min-w-0">
          <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-foreground">
            {t('Chuỗi thay thế')}
            <InfoTip label={t('Về chuỗi thay thế')}>
              {t(
                'Sửa có lý do hủy phiếu cũ và lập phiếu mới thay thế; chuỗi đi từ phiếu gốc tới phiếu đang có hiệu lực.',
              )}
            </InfoTip>
          </h3>
          {chainError && (
            <Alert type="error">
              <span className="flex flex-wrap items-center gap-3">
                {chainError}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReload((value) => value + 1)}
                >
                  {t('Thử lại')}
                </Button>
              </span>
            </Alert>
          )}
          {!items && !chainError && <TimelineSkeleton />}
          {items && (
            <ol className="relative space-y-1" aria-label={t('Các phiếu')}>
              {items.map((item, index) => {
                const Icon = chainIcon(item)
                const selected = item.id === chosen
                return (
                  <li key={item.id} className="relative flex gap-3 pb-4">
                    {index < items.length - 1 && (
                      <ArrowDown
                        className="absolute start-2 bottom-0 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-1',
                        iconTone[item.status],
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>
                    <div
                      className={cn(
                        'min-w-0 flex-1 rounded-lg border px-3 py-2 transition-colors',
                        selected
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-transparent hover:bg-muted/50',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {item.code}
                          </span>
                          <StatusBadge status={item.status} />
                        </span>
                        <Button
                          variant={selected ? 'secondary' : 'ghost'}
                          size="sm"
                          aria-label={t('Xem {code}', { code: item.code })}
                          aria-pressed={selected}
                          onClick={() => choose(item.id)}
                        >
                          {t('Xem')}
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {t('Ngày CT {businessDate} · {totalAmount}', {
                          businessDate: formatDate(item.businessDate),
                          totalAmount: formatVND(item.totalAmount),
                        })}
                      </p>
                      {index === 0 && items.length > 1 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('Phiếu gốc')}
                        </p>
                      )}
                      {item.cancelReason && (
                        <p className="mt-1 text-[13px] text-foreground">
                          {t('Lý do: {reason}', { reason: item.cancelReason })}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          {items && items.length === 1 && (
            <p className="text-xs text-muted-foreground">
              {t('Phiếu chưa từng được sửa có lý do.')}
            </p>
          )}
        </section>
        <section
          aria-label={t('Nội dung chứng từ')}
          className="min-w-0 space-y-4"
        >
          {currentError && <Alert type="error">{currentError}</Alert>}
          {!current && !currentError && (
            <div role="status" className="space-y-3">
              <span className="sr-only">{t('Đang tải chứng từ...')}</span>
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          )}
          {current && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {t('{kind} {code}', {
                    kind: kindLabel(current.kind),
                    code: current.code,
                  })}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {pageLink && pathAllowed(pageLink) && (
                    <SafeLink
                      to={pageLink}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      {t('Mở ở trang phiếu')}
                    </SafeLink>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Printer className="size-4" />}
                    disabled={exportBusy}
                    onClick={() => void print(current, 'text/html')}
                  >
                    {t('Xem bản in')}
                  </Button>
                  <Button
                    size="sm"
                    icon={<Download className="size-4" />}
                    isLoading={exportBusy}
                    onClick={() => void print(current, 'application/pdf')}
                  >
                    {t('Tải PDF')}
                  </Button>
                </div>
              </div>
              <DocumentSnapshot doc={current} onOpenDocument={choose} />
              {exportError && <Alert type="error">{exportError}</Alert>}
              {htmlUrl && (
                <iframe
                  title={t('Bản HTML {code}', { code: current.code })}
                  src={htmlUrl}
                  sandbox=""
                  // Paper preview: the printed document is always a light page.
                  className="h-[60vh] w-full rounded-lg border bg-white"
                />
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  )
}
