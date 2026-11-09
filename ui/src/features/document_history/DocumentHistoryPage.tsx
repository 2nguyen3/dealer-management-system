import { useEffect, useRef, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiDownload } from '../../lib/api'
import { useAuth } from '../authentication/useAuth'
import { DocumentList } from './DocumentList'
import {
  parseRevision,
  type DocumentSummary,
  type Revision,
} from './documentContracts'
import { errorMessage, useDocumentPage } from './useDocumentRequests'

export function DocumentHistoryPage() {
  const { user, allowedFunctions } = useAuth()
  return <HistoryScreen key={`${user?.id}:${allowedFunctions.join(',')}`} />
}
function HistoryScreen() {
  const [selected, setSelected] = useState<DocumentSummary | null>(null)
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch sử chứng từ</h1>
          <p className="page-desc">
            Phiên bản lịch sử bất biến và bản HTML/PDF do máy chủ cấp theo quyền
            đọc từng loại.
          </p>
        </div>
      </div>
      <DocumentList
        actions={(row) => (
          <Button variant="outline" onClick={() => setSelected(row)}>
            Phiên bản {row.code}
          </Button>
        )}
      />
      {selected && (
        <RevisionHistory doc={selected} onClose={() => setSelected(null)} />
      )}
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
  return (
    <Modal isOpen title={`Lịch sử ${doc.code}`} onClose={onClose} maxWidth="lg">
      {data.error && (
        <Alert type="error">
          {data.error}
          <Button onClick={data.reload}>Thử lại</Button>
        </Alert>
      )}
      {data.loading && <Spinner label="Đang tải phiên bản..." />}
      {data.page && (
        <>
          <Table caption="Phiên bản từ máy chủ">
            <thead>
              <tr>
                <th>Phiên bản</th>
                <th>Trạng thái</th>
                <th>Ngày nghiệp vụ</th>
                <th>Tổng tiền</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.page.items.map((item) => (
                <tr key={item.id}>
                  <td>v{item.revisionNo}</td>
                  <td>{item.state}</td>
                  <td>{item.businessDate}</td>
                  <td>{item.totalAmount}</td>
                  <td>{item.reason ?? '-'}</td>
                  <td>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRevision(item)
                        if (htmlUrl) {
                          URL.revokeObjectURL(htmlUrl)
                          urls.current.delete(htmlUrl)
                          setHtmlUrl(null)
                        }
                      }}
                    >
                      Xem v{item.revisionNo}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            hasNext={data.page.pagination.hasMore}
            hasPrevious={cursors.length > 1}
            totalShowing={data.page.items.length}
            onNext={() => {
              if (data.page?.pagination.nextCursor)
                setCursors([...cursors, data.page.pagination.nextCursor])
            }}
            onPrevious={() => setCursors(cursors.slice(0, -1))}
          />
        </>
      )}
      {revision && (
        <section>
          <h2>Ảnh chụp bất biến v{revision.revisionNo}</h2>
          <p>
            {revision.businessDate} / {revision.state} / {revision.totalAmount}{' '}
            VNĐ
          </p>
          <p>
            {revision.agencySnapshot?.name} | {revision.agencySnapshot?.address}
          </p>
          <p>{revision.note}</p>
          <Table caption="Dòng hàng lịch sử">
            <thead>
              <tr>
                <th>Mặt hàng tại thời điểm ghi nhận</th>
                <th>Số lượng</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {revision.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.productName} / {line.unitName}
                  </td>
                  <td>{line.quantity}</td>
                  <td>{line.unitPrice}</td>
                  <td>{line.lineAmount}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="modal-actions">
            <Button
              disabled={exportBusy}
              onClick={() => void snapshot(revision, 'text/html')}
            >
              Xem HTML máy chủ
            </Button>
            <Button
              isLoading={exportBusy}
              onClick={() => void snapshot(revision, 'application/pdf')}
            >
              Tải PDF máy chủ
            </Button>
          </div>
          {exportError && <Alert type="error">{exportError}</Alert>}
          {htmlUrl && (
            <iframe
              title={`Bản HTML ${doc.code}`}
              src={htmlUrl}
              sandbox=""
              style={{ width: '100%', height: '60vh' }}
            />
          )}
        </section>
      )}
      <p>
        Không có phiên bản giả khi tải lỗi, không dùng window.print và không lấy
        tên/giá hiện tại thay cho bản gốc.
      </p>
    </Modal>
  )
}
