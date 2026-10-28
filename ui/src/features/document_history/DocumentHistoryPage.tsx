import { useEffect, useMemo, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PrinterIcon } from '../../components/ui/Icons'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch, type ApiResponse } from '../../lib/api'
import { cachedApiFetch } from '../../lib/cache'
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  formatVND,
} from '../../lib/formatters'
import type { Agency, DocumentLine, DocumentRevision } from '../../lib/types'

interface HistoryDocument {
  id: string
  code: string
  kind: string
  agencyId?: string | null
  originDocumentId?: string | null
  status: string
  createdAt: string
  updatedAt?: string
  currentRevision?: {
    id?: string
    documentId?: string
    revisionNo: number
    state: string
    businessDate: string
    totalAmount: string
    reason?: string | null
    note?: string | null
    agencySnapshot?: {
      name?: string
      address?: string
      phone?: string
      email?: string
    } | null
    lines?: DocumentLine[]
  }
}

export function DocumentHistoryPage() {
  const [documents, setDocuments] = useState<HistoryDocument[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [filterKind, setFilterKind] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAgency, setFilterAgency] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Revisions Modal
  const [selectedDoc, setSelectedDoc] = useState<HistoryDocument | null>(null)
  const [revisions, setRevisions] = useState<DocumentRevision[]>([])
  const [isRevisionsLoading, setIsRevisionsLoading] = useState(false)
  const [revisionsError, setRevisionsError] = useState<string | null>(null)

  // Print Preview Modal
  const [printDoc, setPrintDoc] = useState<{
    doc: HistoryDocument
    revision: DocumentRevision | null
  } | null>(null)

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies').catch(() => ({
        data: [] as Agency[],
      })),
      cachedApiFetch<HistoryDocument[] | { items: HistoryDocument[] }>(
        '/documents',
      ).catch(() => ({ data: [] as HistoryDocument[] })),
    ])
      .then(([aRes, dRes]) => {
        if (!isMounted) return
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const dItems = Array.isArray(dRes.data)
          ? dRes.data
          : 'items' in dRes.data
            ? dRes.data.items || []
            : []

        setAgencies(aItems)
        setDocuments(dItems)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải lịch sử chứng từ.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case 'STOCK_RECEIPT':
        return <Badge variant="info">Nhập hàng (PN)</Badge>
      case 'STOCK_ISSUE':
        return <Badge variant="info">Xuất hàng (PX)</Badge>
      case 'PAYMENT_RECEIPT':
        return <Badge variant="success">Thu tiền (PT)</Badge>
      case 'STOCK_ADJUSTMENT':
        return <Badge variant="warning">Điều chỉnh (DC)</Badge>
      case 'SALES_RETURN':
        return <Badge variant="danger">Trả hàng (TH)</Badge>
      case 'CREDIT_APPLICATION':
        return <Badge variant="neutral">Bù trừ (BT)</Badge>
      case 'REFUND':
        return <Badge variant="neutral">Hoàn tiền (HT)</Badge>
      default:
        return <Badge variant="neutral">{kind}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'POSTED':
        return <Badge variant="success">Đã ghi sổ</Badge>
      case 'READY':
        return <Badge variant="info">Chờ duyệt</Badge>
      case 'DRAFT':
        return <Badge variant="warning">Bản nháp</Badge>
      case 'CANCELLED':
      case 'CANCELED':
        return <Badge variant="neutral">Đã hủy</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterKind && doc.kind !== filterKind) {
        return false
      }
      if (filterStatus && doc.status !== filterStatus) {
        return false
      }
      if (filterAgency && String(doc.agencyId) !== filterAgency) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = doc.code?.toLowerCase().includes(q)
        const matchAgency = doc.currentRevision?.agencySnapshot?.name
          ?.toLowerCase()
          .includes(q)
        const matchNote = doc.currentRevision?.note?.toLowerCase().includes(q)
        if (!matchCode && !matchAgency && !matchNote) return false
      }
      return true
    })
  }, [documents, filterKind, filterStatus, filterAgency, searchQuery])

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredDocuments.slice(start, start + pageSize)
  }, [filteredDocuments, page, pageSize])

  const openRevisions = (doc: HistoryDocument) => {
    setSelectedDoc(doc)
    setRevisions([])
    setRevisionsError(null)
    setIsRevisionsLoading(true)

    apiFetch<DocumentRevision[] | { items: DocumentRevision[] }>(
      `/documents/${doc.id}/revisions`,
    )
      .then(
        (
          res: ApiResponse<DocumentRevision[] | { items: DocumentRevision[] }>,
        ) => {
          const items = Array.isArray(res.data)
            ? res.data
            : 'items' in res.data
              ? res.data.items || []
              : []
          setRevisions(items)
        },
      )
      .catch((err: unknown) => {
        const e = err as { message?: string }
        // If revisions route is not loaded on backend, show current revision as baseline
        if (doc.currentRevision) {
          setRevisions([
            {
              id: doc.currentRevision.id || `${doc.id}-rev-1`,
              documentId: doc.id,
              revisionNo: doc.currentRevision.revisionNo || 1,
              state: doc.currentRevision.state,
              businessDate: doc.currentRevision.businessDate,
              totalAmount: doc.currentRevision.totalAmount,
              note: doc.currentRevision.note || undefined,
              reason: doc.currentRevision.reason || undefined,
              createdAt: doc.createdAt,
              lines: doc.currentRevision.lines,
            },
          ])
        } else {
          setRevisionsError(
            e.message || 'Không thể tải danh sách phiên bản chứng từ.',
          )
        }
      })
      .finally(() => {
        setIsRevisionsLoading(false)
      })
  }

  const openPrint = (doc: HistoryDocument, rev?: DocumentRevision) => {
    setPrintDoc({
      doc,
      revision: rev || null,
    })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch sử chứng từ</h1>
          <p className="page-desc">
            Tra cứu liên loại chứng từ kho, bán hàng, thanh toán và kiểm tra
            lịch sử các phiên bản sửa đổi (Revisions)
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="card filter-bar">
        <div className="filter-inputs">
          <Input
            placeholder="Tìm theo mã chứng từ, tên đối tác, ghi chú..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
          />
          <Select
            value={filterKind}
            onChange={(e) => {
              setFilterKind(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả loại chứng từ' },
              { value: 'STOCK_RECEIPT', label: 'Phiếu nhập kho (PN)' },
              { value: 'STOCK_ISSUE', label: 'Phiếu xuất kho (PX)' },
              { value: 'PAYMENT_RECEIPT', label: 'Phiếu thu tiền (PT)' },
              { value: 'STOCK_ADJUSTMENT', label: 'Điều chỉnh kho (DC)' },
              { value: 'SALES_RETURN', label: 'Phiếu trả hàng (TH)' },
              { value: 'CREDIT_APPLICATION', label: 'Bù trừ dư có (BT)' },
              { value: 'REFUND', label: 'Phiếu hoàn tiền (HT)' },
            ]}
          />
          <Select
            value={filterAgency}
            onChange={(e) => {
              setFilterAgency(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả đại lý' },
              ...agencies.map((a) => ({
                value: a.id,
                label: `${a.code} - ${a.name}`,
              })),
            ]}
          />
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'POSTED', label: 'Đã ghi sổ' },
              { value: 'READY', label: 'Chờ duyệt' },
              { value: 'DRAFT', label: 'Bản nháp' },
              { value: 'CANCELLED', label: 'Đã hủy' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải lịch sử chứng từ..." />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="card empty-card">
          <p>Không tìm thấy chứng từ nào phù hợp với điều kiện tra cứu.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách lịch sử chứng từ">
            <thead>
              <tr>
                <th scope="col">Mã chứng từ</th>
                <th scope="col">Loại chứng từ</th>
                <th scope="col">Đối tác / Đại lý</th>
                <th scope="col">Ngày nghiệp vụ</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Tổng tiền
                </th>
                <th scope="col">Phiên bản</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((doc) => {
                const rev = doc.currentRevision
                const agencyName =
                  rev?.agencySnapshot?.name ||
                  (doc.agencyId ? `Đại lý #${doc.agencyId}` : '—')
                return (
                  <tr key={doc.id}>
                    <td className="font-mono font-bold">{doc.code}</td>
                    <td>{getKindBadge(doc.kind)}</td>
                    <td>
                      <strong>{agencyName}</strong>
                    </td>
                    <td>
                      {rev?.businessDate ? formatDate(rev.businessDate) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {rev?.totalAmount ? formatVND(rev.totalAmount) : '0 ₫'}
                    </td>
                    <td>
                      <span className="badge badge--neutral">
                        v{rev?.revisionNo || 1}
                      </span>
                    </td>
                    <td>{getStatusBadge(doc.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.35rem',
                          justifyContent: 'center',
                        }}
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openRevisions(doc)}
                        >
                          Phiên bản
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPrint(doc)}
                        >
                          <PrinterIcon size={14} /> In
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>

          <Pagination
            limit={pageSize}
            onLimitChange={(size: number) => {
              setPageSize(size)
              setPage(1)
            }}
            totalShowing={paginatedItems.length}
            hasPrevious={page > 1}
            hasNext={page * pageSize < filteredDocuments.length}
            onPrevious={() => setPage((pr) => Math.max(1, pr - 1))}
            onNext={() => setPage((pr) => pr + 1)}
          />
        </div>
      )}

      {/* Revisions History Modal */}
      {selectedDoc && (
        <Modal
          isOpen={true}
          title={`Lịch sử các phiên bản sửa đổi của chứng từ ${selectedDoc.code}`}
          onClose={() => setSelectedDoc(null)}
          maxWidth="lg"
        >
          {revisionsError && <Alert type="error">{revisionsError}</Alert>}

          {isRevisionsLoading ? (
            <div className="modal-loading">
              <Spinner label="Đang tải lịch sử phiên bản..." />
            </div>
          ) : revisions.length === 0 ? (
            <p style={{ padding: '1rem', textAlign: 'center' }}>
              Chưa có phiên bản nào được ghi nhận cho chứng từ này.
            </p>
          ) : (
            <div>
              <div
                style={{
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  Loại chứng từ: <strong>{selectedDoc.kind}</strong> | Tổng số
                  phiên bản: <strong>{revisions.length}</strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPrint(selectedDoc)}
                >
                  <PrinterIcon size={14} /> In phiên bản hiện hành
                </Button>
              </div>

              <Table caption="Danh sách phiên bản">
                <thead>
                  <tr>
                    <th>Phiên bản</th>
                    <th>Trạng thái</th>
                    <th>Ngày nghiệp vụ</th>
                    <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                    <th>Lý do / Ghi chú</th>
                    <th>Thời điểm tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((r) => (
                    <tr key={r.id || r.revisionNo}>
                      <td className="font-mono font-bold">v{r.revisionNo}</td>
                      <td>{getStatusBadge(r.state)}</td>
                      <td>{formatDate(r.businessDate)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatVND(r.totalAmount)}
                      </td>
                      <td>{r.reason || r.note || '—'}</td>
                      <td>{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Show lines of latest revision if present */}
              {selectedDoc.currentRevision?.lines &&
                selectedDoc.currentRevision.lines.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                      Chi tiết mặt hàng trong phiên bản hiện hành (v
                      {selectedDoc.currentRevision.revisionNo})
                    </h3>
                    <Table caption="Dòng mặt hàng">
                      <thead>
                        <tr>
                          <th>Mặt hàng</th>
                          <th style={{ textAlign: 'right' }}>Số lượng</th>
                          <th style={{ textAlign: 'right' }}>Đơn giá</th>
                          <th style={{ textAlign: 'right' }}>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDoc.currentRevision.lines.map((line, idx) => (
                          <tr key={line.id || idx}>
                            <td>
                              <strong>
                                {line.productName ||
                                  `Sản phẩm #${line.productId}`}
                              </strong>
                              {line.productCode && (
                                <span
                                  className="font-mono text-muted"
                                  style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  {line.productCode}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {formatQuantity(line.quantity)}{' '}
                              {line.unitName || ''}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {formatVND(line.unitPrice)}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 600,
                              }}
                            >
                              {formatVND(line.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <Button
                  variant="secondary"
                  onClick={() => setSelectedDoc(null)}
                >
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Print Voucher Modal */}
      {printDoc && (
        <Modal
          isOpen={true}
          title={`Bản in chứng từ ${printDoc.doc.code}`}
          onClose={() => setPrintDoc(null)}
          maxWidth="lg"
        >
          <div className="print-voucher-container" style={{ padding: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '2px solid #333',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                  AGENTRA DISTRIBUTION MANAGEMENT SYSTEM
                </h2>
                <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                  Hệ thống Quản lý Phân phối Đại lý Toàn quốc
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 className="font-mono" style={{ margin: 0 }}>
                  {printDoc.doc.code}
                </h3>
                <span className="badge badge--neutral">
                  v{printDoc.doc.currentRevision?.revisionNo || 1}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
              <h1 style={{ fontSize: '1.5rem', textTransform: 'uppercase' }}>
                {printDoc.doc.kind === 'STOCK_RECEIPT'
                  ? 'PHIẾU NHẬP KHO HÀNG HÓA'
                  : printDoc.doc.kind === 'STOCK_ISSUE'
                    ? 'PHIẾU XUẤT KHO KIÊM BÁN HÀNG'
                    : printDoc.doc.kind === 'PAYMENT_RECEIPT'
                      ? 'PHIẾU THU TIỀN ĐẠI LÝ'
                      : printDoc.doc.kind === 'SALES_RETURN'
                        ? 'PHIẾU NHẬN HÀNG TRẢ LẠI'
                        : printDoc.doc.kind === 'CREDIT_APPLICATION'
                          ? 'PHIẾU BÙ TRỪ DƯ CÓ CÔNG NỢ'
                          : printDoc.doc.kind === 'REFUND'
                            ? 'PHIẾU HOÀN TIỀN ĐẠI LÝ'
                            : 'CHỨNG TỪ NGHIỆP VỤ'}
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                Ngày nghiệp vụ:{' '}
                {formatDate(
                  printDoc.doc.currentRevision?.businessDate ||
                    printDoc.doc.createdAt,
                )}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <div>
                <div>
                  <strong>Đại lý / Đối tác:</strong>{' '}
                  {printDoc.doc.currentRevision?.agencySnapshot?.name ||
                    (printDoc.doc.agencyId
                      ? `Đại lý #${printDoc.doc.agencyId}`
                      : '—')}
                </div>
                <div>
                  <strong>Địa chỉ:</strong>{' '}
                  {printDoc.doc.currentRevision?.agencySnapshot?.address || '—'}
                </div>
                <div>
                  <strong>Điện thoại:</strong>{' '}
                  {printDoc.doc.currentRevision?.agencySnapshot?.phone || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <strong>Trạng thái chứng từ:</strong>{' '}
                  {printDoc.doc.status === 'POSTED'
                    ? 'ĐÃ GHI SỔ KHO & CÔNG NỢ'
                    : printDoc.doc.status}
                </div>
                <div>
                  <strong>Thời gian lập:</strong>{' '}
                  {formatDateTime(printDoc.doc.createdAt)}
                </div>
              </div>
            </div>

            {/* Lines in voucher if available */}
            {printDoc.doc.currentRevision?.lines &&
              printDoc.doc.currentRevision.lines.length > 0 && (
                <Table caption="Bảng kê chi tiết">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã hàng</th>
                      <th>Tên mặt hàng</th>
                      <th>ĐVT</th>
                      <th style={{ textAlign: 'right' }}>Số lượng</th>
                      <th style={{ textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printDoc.doc.currentRevision.lines.map((l, i) => (
                      <tr key={l.id || i}>
                        <td>{i + 1}</td>
                        <td className="font-mono">{l.productCode || '—'}</td>
                        <td>{l.productName || `Mặt hàng #${l.productId}`}</td>
                        <td>{l.unitName || 'Cái'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {formatQuantity(l.quantity)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatVND(l.unitPrice)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatVND(l.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '1rem',
                fontSize: '1.1rem',
              }}
            >
              <div>
                <strong>Tổng cộng thanh toán: </strong>
                <span className="font-bold font-mono text-primary">
                  {formatVND(printDoc.doc.currentRevision?.totalAmount || '0')}
                </span>
              </div>
            </div>

            {/* Signature section */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                textAlign: 'center',
                marginTop: '3rem',
                paddingTop: '1rem',
              }}
            >
              <div>
                <strong>Người lập phiếu</strong>
                <p style={{ marginTop: '3rem', color: '#888' }}>
                  (Ký và họ tên)
                </p>
              </div>
              <div>
                <strong>Thủ kho</strong>
                <p style={{ marginTop: '3rem', color: '#888' }}>
                  (Ký và họ tên)
                </p>
              </div>
              <div>
                <strong>Kế toán trưởng</strong>
                <p style={{ marginTop: '3rem', color: '#888' }}>
                  (Ký và họ tên)
                </p>
              </div>
              <div>
                <strong>Đại diện đại lý</strong>
                <p style={{ marginTop: '3rem', color: '#888' }}>
                  (Ký và họ tên)
                </p>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '2rem' }}>
              <Button
                variant="primary"
                onClick={() => {
                  window.print()
                }}
              >
                <PrinterIcon size={16} /> In phiếu này
              </Button>
              <Button variant="secondary" onClick={() => setPrintDoc(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
