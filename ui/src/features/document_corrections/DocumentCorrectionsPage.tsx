import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
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
import { errorMessage } from '../document_history/useDocumentRequests'
import { DocumentSnapshot } from '../stock_receipts/GoodsDocumentsPage'
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
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sửa sai và hủy chứng từ</h1>
          <p className="page-desc">
            Sửa lỗi ghi nhận bằng phiên bản thay thế. Hàng thực trả và tiền thực
            hoàn dùng nghiệp vụ riêng. Máy chủ kiểm tra mọi ràng buộc lịch sử.
          </p>
        </div>
      </div>
      <DocumentList
        key={version}
        posted
        actions={(row) => (
          <Button
            onClick={() => {
              setDetail(null)
              setError(null)
              setSelected(row)
            }}
            variant="outline"
          >
            Kiểm tra {row.code}
          </Button>
        )}
      />
      <Modal
        isOpen={!!selected && !mode}
        title="Kiểm tra chứng từ gốc và quyền thao tác"
        maxWidth="lg"
        onClose={() => setSelected(null)}
      >
        {error && <Alert type="error">{error}</Alert>}
        {!detail && !error && (
          <Spinner label="Đang lấy phiên bản và ETag hiện hành..." />
        )}
        {detail && (
          <>
            <DocumentSnapshot doc={detail.doc} />
            <p>
              Chỉ phiếu thu thủ công, điều chỉnh độc lập và loại chứng từ được
              hỗ trợ mới có thể sửa/hủy. Dữ liệu kiểm kê và bằng chứng tiền thực
              nhận luôn được bảo vệ.
            </p>
            <div className="modal-actions">
              {canChange(detail.doc, 'correct', hasPermission) && (
                <Button
                  disabled={!detail.etag}
                  onClick={() => setMode('correct')}
                >
                  Điều chỉnh
                </Button>
              )}
              {canChange(detail.doc, 'cancel', hasPermission) && (
                <Button
                  variant="danger"
                  disabled={!detail.etag}
                  onClick={() => setMode('cancel')}
                >
                  Hủy chứng từ
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setDetail(null)
                  setError(null)
                  setVersion((value) => value + 1)
                }}
              >
                Tải lại phiên bản
              </Button>
            </div>
          </>
        )}
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
