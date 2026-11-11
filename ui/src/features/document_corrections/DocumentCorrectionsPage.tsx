import { RefreshCw, ScanSearch, Undo2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../authentication/useAuth'
import { DocumentList } from '../document_history/DocumentList'
import {
  canChange,
  documentKinds,
  parseDocument,
  type DocumentDetail,
  type DocumentSummary,
} from '../document_history/documentContracts'
import { Hint } from '../document_history/DocumentParts'
import { errorMessage } from '../document_history/useDocumentRequests'
import { DocumentSnapshot } from '../stock_receipts/DocumentSnapshot'
import { CorrectionDialog } from './CorrectionDialog'

export function DocumentCorrectionsPage() {
  const { user, allowedFunctions, hasPermission } = useAuth()
  const scope = `${user?.id}:${allowedFunctions.join(',')}`
  return <CorrectionsScreen key={scope} hasPermission={hasPermission} />
}
function CorrectionsScreen({
  hasPermission,
}: {
  hasPermission: ReturnType<typeof useAuth>['hasPermission']
}) {
  const [selected, setSelected] = useState<DocumentSummary | null>(null)
  const [detail, setDetail] = useState<{
    doc: DocumentDetail
    etag: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'correct' | 'cancel' | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    apiFetch<unknown>(`${documentKinds[selected.kind].path}/${selected.id}`, {
      signal: controller.signal,
    })
      .then((result) => {
        const doc = parseDocument(result.data)
        if (!controller.signal.aborted) setDetail({ doc, etag: result.etag })
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure))
      })
    return () => controller.abort()
  }, [selected, version])
  function inspect(row: DocumentSummary) {
    setDetail(null)
    setError(null)
    setSelected(row)
  }
  const canCorrect = !!detail && canChange(detail.doc, 'correct', hasPermission)
  const canCancel = !!detail && canChange(detail.doc, 'cancel', hasPermission)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Chứng từ"
        title="Sửa sai và hủy chứng từ"
        description="Phiên bản mới có lý do cho chứng từ đã ghi sổ."
        className="mb-0"
      />
      <DocumentList
        version={version}
        posted
        onRowClick={inspect}
        actions={(row) => (
          <Button
            onClick={() => inspect(row)}
            variant="ghost"
            size="sm"
            icon={<ScanSearch className="size-4" />}
            aria-label={`Kiểm tra ${row.code}`}
          >
            Kiểm tra
          </Button>
        )}
      />
      <Modal
        isOpen={!!selected && !mode}
        title={detail ? `Chứng từ ${detail.doc.code}` : 'Kiểm tra chứng từ'}
        maxWidth="xl"
        onClose={() => setSelected(null)}
        footer={
          detail ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                className="mr-auto"
                icon={<RefreshCw className="size-4" />}
                onClick={() => {
                  setDetail(null)
                  setError(null)
                  setVersion((value) => value + 1)
                }}
              >
                Tải lại
              </Button>
              {canCancel && (
                <Button
                  variant="danger"
                  icon={<XCircle className="size-4" />}
                  disabled={!detail.etag}
                  onClick={() => setMode('cancel')}
                >
                  Hủy chứng từ
                </Button>
              )}
              {canCorrect && (
                <Button
                  icon={<Undo2 className="size-4" />}
                  disabled={!detail.etag}
                  onClick={() => setMode('correct')}
                >
                  Điều chỉnh
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {!detail && !error && (
            <div role="status" className="space-y-4">
              <span className="sr-only">Đang tải chứng từ...</span>
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}
          {detail && (
            <>
              <DocumentSnapshot doc={detail.doc} />
              {!canCorrect && !canCancel && (
                <Hint>
                  Không sửa/hủy được tại đây (từ kiểm kê, thu trực tuyến hoặc
                  thiếu quyền).
                </Hint>
              )}
            </>
          )}
        </div>
      </Modal>
      {mode && detail && (
        <CorrectionDialog
          doc={detail.doc}
          etag={detail.etag}
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={() => {
            setMode(null)
            setSelected(null)
            setVersion((value) => value + 1)
          }}
        />
      )}
    </div>
  )
}
