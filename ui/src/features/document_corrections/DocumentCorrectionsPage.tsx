import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import { formatDate, formatVND } from '../../lib/formatters'
import type { Agency, DocumentLine } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

interface EditableDocument {
  id: string
  code: string
  kind: string
  agencyId?: string | null
  status: string
  createdAt: string
  currentRevision?: {
    id?: string
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
    } | null
    lines?: DocumentLine[]
  }
}

export function DocumentCorrectionsPage() {
  const { hasPermission } = useAuth()
  const canCorrect = hasPermission('documents.correct')
  const canCancel = hasPermission('documents.cancel')

  const [documents, setDocuments] = useState<EditableDocument[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [filterKind, setFilterKind] = useState('')
  const [filterAgency, setFilterAgency] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Modal State
  const [selectedDoc, setSelectedDoc] = useState<EditableDocument | null>(null)
  const [modalMode, setModalMode] = useState<'CANCEL' | 'CORRECT' | null>(null)
  const [reason, setReason] = useState('')
  const [newBusinessDate, setNewBusinessDate] = useState('')
  const [newNote, setNewNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const loadData = (bypassCache = false) => {
    if (bypassCache) {
      invalidateCache('/documents')
      setIsLoading(true)
    }

    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies').catch(() => ({
        data: [] as Agency[],
      })),
      bypassCache
        ? apiFetch<EditableDocument[] | { items: EditableDocument[] }>(
            '/documents',
          )
        : cachedApiFetch<EditableDocument[] | { items: EditableDocument[] }>(
            '/documents',
          ),
    ])
      .then(([aRes, dRes]) => {
        const aItems = Array.isArray(aRes.data)
          ? aRes.data
          : aRes.data.items || []
        const dItems = Array.isArray(dRes.data)
          ? dRes.data
          : 'items' in dRes.data
            ? dRes.data.items || []
            : []

        setAgencies(aItems)
        // Show posted documents as eligible candidates for corrections
        setDocuments(dItems.filter((d) => d.status === 'POSTED'))
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách chứng từ.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    let isMounted = true
    Promise.all([
      cachedApiFetch<Agency[] | { items: Agency[] }>('/agencies').catch(() => ({
        data: [] as Agency[],
      })),
      cachedApiFetch<EditableDocument[] | { items: EditableDocument[] }>(
        '/documents',
      ).catch(() => ({ data: [] as EditableDocument[] })),
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
        setDocuments(dItems.filter((d) => d.status === 'POSTED'))
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải danh sách chứng từ.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const getResourcePath = (kind: string, docId: string): string => {
    switch (kind) {
      case 'STOCK_RECEIPT':
        return `/stock-receipts/${docId}`
      case 'STOCK_ISSUE':
        return `/stock-issues/${docId}`
      case 'PAYMENT_RECEIPT':
        return `/payment-receipts/${docId}`
      case 'STOCK_ADJUSTMENT':
        return `/stock-adjustments/${docId}`
      case 'SALES_RETURN':
        return `/sales-returns/${docId}`
      case 'CREDIT_APPLICATION':
        return `/credit-applications/${docId}`
      default:
        return `/documents/${docId}`
    }
  }

  const getKindName = (kind: string) => {
    switch (kind) {
      case 'STOCK_RECEIPT':
        return 'Phiếu nhập kho (PN)'
      case 'STOCK_ISSUE':
        return 'Phiếu xuất kho (PX)'
      case 'PAYMENT_RECEIPT':
        return 'Phiếu thu tiền (PT)'
      case 'STOCK_ADJUSTMENT':
        return 'Điều chỉnh kho (DC)'
      case 'SALES_RETURN':
        return 'Phiếu trả hàng (TH)'
      case 'CREDIT_APPLICATION':
        return 'Bù trừ dư có (BT)'
      default:
        return kind
    }
  }

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterKind && doc.kind !== filterKind) {
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
        if (!matchCode && !matchAgency) return false
      }
      return true
    })
  }, [documents, filterKind, filterAgency, searchQuery])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredDocuments.slice(start, start + pageSize)
  }, [filteredDocuments, page, pageSize])

  const openActionModal = (
    doc: EditableDocument,
    mode: 'CANCEL' | 'CORRECT',
  ) => {
    setSelectedDoc(doc)
    setModalMode(mode)
    setReason('')
    setNewBusinessDate(
      doc.currentRevision?.businessDate ||
        new Date().toISOString().split('T')[0] ||
        '',
    )
    setNewNote(doc.currentRevision?.note || '')
    setModalError(null)
  }

  const handleModalSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedDoc || !modalMode) return
    if (!reason.trim()) {
      setModalError(
        modalMode === 'CANCEL'
          ? 'Vui lòng nhập lý do hủy chứng từ bắt buộc.'
          : 'Vui lòng nhập lý do điều chỉnh sửa đổi bắt buộc.',
      )
      return
    }

    setModalError(null)
    setIsSubmitting(true)

    const basePath = getResourcePath(selectedDoc.kind, selectedDoc.id)
    const endpoint =
      modalMode === 'CANCEL' ? `${basePath}/cancel` : `${basePath}/corrections`

    try {
      await apiFetch(endpoint, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body:
          modalMode === 'CANCEL'
            ? { reason: reason.trim() }
            : {
                businessDate: newBusinessDate,
                reason: reason.trim(),
                note: newNote.trim() || undefined,
              },
      })

      setSuccessNotice(
        modalMode === 'CANCEL'
          ? `Hủy chứng từ ${selectedDoc.code} thành công. Các nghiệp vụ sau đã được tái phát (Replay).`
          : `Điều chỉnh chứng từ ${selectedDoc.code} thành công. Phiên bản mới đã được ghi nhận.`,
      )
      setSelectedDoc(null)
      setModalMode(null)
      loadData(true)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setModalError(
        e.message ||
          (modalMode === 'CANCEL'
            ? 'Không thể hủy chứng từ.'
            : 'Không thể điều chỉnh chứng từ.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sửa sai và hủy chứng từ</h1>
          <p className="page-desc">
            Xử lý điều chỉnh hoặc hủy bỏ các chứng từ đã ghi sổ (Posted), tự
            động tính toán lại biến động kho và công nợ (Chronological Replay)
          </p>
        </div>
      </div>

      {successNotice && <Alert type="success">{successNotice}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      <div className="card filter-bar">
        <div className="filter-inputs">
          <Input
            placeholder="Tìm theo mã chứng từ, tên đại lý..."
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
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải danh sách chứng từ..." />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="card empty-card">
          <p>Không có chứng từ đã ghi sổ nào phù hợp để sửa sai hoặc hủy.</p>
        </div>
      ) : (
        <div className="card">
          <Table caption="Danh sách chứng từ có thể sửa sai hoặc hủy">
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
                  Thao tác sửa sai
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
                    <td>
                      <span className="badge badge--neutral">
                        {getKindName(doc.kind)}
                      </span>
                    </td>
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
                    <td>
                      <Badge variant="success">Đã ghi sổ</Badge>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.4rem',
                          justifyContent: 'center',
                        }}
                      >
                        {canCorrect && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openActionModal(doc, 'CORRECT')}
                          >
                            Điều chỉnh
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openActionModal(doc, 'CANCEL')}
                          >
                            Hủy chứng từ
                          </Button>
                        )}
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

      {/* Action Modal (Cancel or Correct) */}
      {selectedDoc && modalMode && (
        <Modal
          isOpen={true}
          title={
            modalMode === 'CANCEL'
              ? `Hủy chứng từ đã ghi sổ ${selectedDoc.code}`
              : `Điều chỉnh chứng từ đã ghi sổ ${selectedDoc.code}`
          }
          onClose={() => {
            setSelectedDoc(null)
            setModalMode(null)
          }}
          maxWidth="md"
        >
          <form onSubmit={handleModalSubmit}>
            {modalError && <Alert type="error">{modalError}</Alert>}

            {modalMode === 'CANCEL' ? (
              <div
                style={{
                  background: 'var(--color-bg-subtle, #fff3cd)',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1.25rem',
                  border: '1px solid #ffeeba',
                  fontSize: '0.875rem',
                }}
              >
                <strong style={{ color: '#856404' }}>
                  Cảnh báo an toàn nghiệp vụ:
                </strong>
                <p style={{ margin: '0.5rem 0 0 0', color: '#856404' }}>
                  Việc hủy chứng từ đã ghi sổ sẽ đảo ngược toàn bộ biến động tồn
                  kho và công nợ phát sinh. Hệ thống sẽ tự động tính toán lại
                  (Replay) các nghiệp vụ kế tiếp theo thứ tự thời gian.
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--color-bg-subtle, #d1ecf1)',
                  padding: '1rem',
                  borderRadius: '6px',
                  marginBottom: '1.25rem',
                  border: '1px solid #bee5eb',
                  fontSize: '0.875rem',
                }}
              >
                <strong style={{ color: '#0c5460' }}>
                  Cơ chế sửa sai (Version Replay):
                </strong>
                <p style={{ margin: '0.5rem 0 0 0', color: '#0c5460' }}>
                  Khi điều chỉnh, phiên bản hiện tại sẽ được đánh dấu lưu vết và
                  tạo ra một phiên bản mới (v
                  {(selectedDoc.currentRevision?.revisionNo || 1) + 1}) với đầy
                  đủ lịch sử kiểm toán.
                </p>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              <div>
                <span className="text-muted">Mã chứng từ:</span>
                <span
                  className="font-mono font-bold"
                  style={{ display: 'block' }}
                >
                  {selectedDoc.code}
                </span>
              </div>
              <div>
                <span className="text-muted">Loại nghiệp vụ:</span>
                <span style={{ display: 'block' }}>
                  {getKindName(selectedDoc.kind)}
                </span>
              </div>
              <div>
                <span className="text-muted">Ngày hiện tại:</span>
                <span style={{ display: 'block' }}>
                  {formatDate(selectedDoc.currentRevision?.businessDate)}
                </span>
              </div>
              <div>
                <span className="text-muted">Giá trị chứng từ:</span>
                <span style={{ display: 'block', fontWeight: 600 }}>
                  {formatVND(selectedDoc.currentRevision?.totalAmount || '0')}
                </span>
              </div>
            </div>

            {modalMode === 'CORRECT' && (
              <>
                <div className="form-group">
                  <label htmlFor="correct-date">Ngày nghiệp vụ mới (*)</label>
                  <Input
                    id="correct-date"
                    type="date"
                    value={newBusinessDate}
                    onChange={(e) => setNewBusinessDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="correct-note">Ghi chú bổ sung</label>
                  <Input
                    id="correct-note"
                    type="text"
                    placeholder="Nhập ghi chú điều chỉnh..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="action-reason">
                Lý do {modalMode === 'CANCEL' ? 'hủy bỏ' : 'điều chỉnh'} chứng
                từ (*)
              </label>
              <Input
                id="action-reason"
                type="text"
                placeholder={
                  modalMode === 'CANCEL'
                    ? 'Ví dụ: Xuất nhầm mã hàng, đối tác hủy đơn...'
                    : 'Ví dụ: Điều chỉnh ngày hạch toán theo biên bản đối soát...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <Button
                type="submit"
                variant={modalMode === 'CANCEL' ? 'danger' : 'primary'}
                isLoading={isSubmitting}
              >
                {modalMode === 'CANCEL'
                  ? 'Xác nhận hủy chứng từ'
                  : 'Xác nhận điều chỉnh'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedDoc(null)
                  setModalMode(null)
                }}
              >
                Hủy bỏ
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
