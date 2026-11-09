import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { ApiError, apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { useAuth } from '../authentication/useAuth'
import { exact, validId } from '../document_history/documentContracts'
import {
  errorMessage,
  useDocumentMutation,
  useDocumentPage,
} from '../document_history/useDocumentRequests'
import {
  canConfirmCount,
  parseCount,
  validInstant,
  type CountLine,
  type StockCount,
} from './countContracts'

export function StockCountsPage() {
  const { user, allowedFunctions } = useAuth()
  return <CountsScreen key={`${user?.id}:${allowedFunctions.join(',')}`} />
}
function CountsScreen() {
  const { hasPermission } = useAuth()
  const canCount = hasPermission('stock.count')
  const [draftFilters, setDraftFilters] = useState({ code: '', state: '' })
  const [filters, setFilters] = useState('')
  const [cursors, setCursors] = useState([''])
  const [version, setVersion] = useState(0)
  const query = new URLSearchParams(filters)
  query.set('limit', '25')
  query.set('sort', '-countedAt')
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!)
  const data = useDocumentPage(
    canCount ? `/stock-counts?${query}` : null,
    parseCount,
    version,
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    count: StockCount
    etag: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<
    'create' | 'header' | 'recount' | 'add' | 'line' | null
  >(null)
  const [countedAt, setCountedAt] = useState('')
  const [reason, setReason] = useState('')
  const [observations, setObservations] = useState<
    { productId: string; countedQuantity: string }[]
  >([])
  const [lineId, setLineId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const mutation = useDocumentMutation()
  useEffect(() => {
    if (!selected || !canCount) return
    const controller = new AbortController()
    apiFetch<unknown>(`/stock-counts/${selected}`, {
      signal: controller.signal,
    })
      .then((result) => {
        const count = parseCount(result.data)
        if (!controller.signal.aborted) setDetail({ count, etag: result.etag })
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure))
      })
    return () => controller.abort()
  }, [selected, version, canCount])
  function reload() {
    setDetail(null)
    setError(null)
    setCursors([''])
    setVersion((value) => value + 1)
  }
  function open(
    mode: 'create' | 'header' | 'recount' | 'add' | 'line',
    line?: CountLine,
  ) {
    setMode(mode)
    setFormError(null)
    setReason(mode === 'header' ? (detail?.count.reason ?? '') : '')
    setCountedAt(mode === 'header' ? (detail?.count.countedAt ?? '') : '')
    setLineId(line?.id ?? '')
    // Recount always needs newly entered observations, never a silent copy/rebase.
    setObservations(
      mode === 'recount'
        ? detail!.count.lines.map((item) => ({
            productId: item.productId,
            countedQuantity: '',
          }))
        : [
            {
              productId: line?.productId ?? '',
              countedQuantity: line?.countedQuantity ?? '',
            },
          ],
    )
  }
  async function save() {
    if (!canCount || !mode || mutation.busy) return
    setFormError(null)
    try {
      if (mode !== 'add' && mode !== 'line' && !validInstant(countedAt))
        throw new Error(
          'Nhập thời điểm ISO 8601 đầy đủ múi giờ, ví dụ 2026-10-30T09:00:00+07:00.',
        )
      const ids = new Set<string>()
      if (mode !== 'header')
        for (const line of observations) {
          if (
            !validId(line.productId) ||
            ids.has(line.productId) ||
            !exact.quantity.test(line.countedQuantity)
          )
            throw new Error(
              'Cần ID duy nhất và số đếm không âm, tối đa 3 chữ số lẻ.',
            )
          ids.add(line.productId)
        }
      if (mode === 'recount' && !reason.trim())
        throw new Error('Cần lý do đếm lại.')
      if (
        mode !== 'create' &&
        (!detail?.etag || detail.count.state !== 'DRAFT')
      )
        throw new Error('Cần ETag của biên bản nháp hiện hành.')
      let path = '/stock-counts'
      let body: unknown = {
        countedAt,
        reason: reason || null,
        lines: observations,
      }
      if (mode !== 'create') path += `/${detail!.count.id}`
      if (mode === 'header') body = { countedAt, reason: reason || null }
      if (mode === 'recount') {
        path += '/recount'
        body = { countedAt, reason: reason.trim(), lines: observations }
      }
      if (mode === 'add') {
        path += '/lines'
        body = observations[0]
      }
      if (mode === 'line') {
        path += `/lines/${lineId}`
        body = { countedQuantity: observations[0]!.countedQuantity }
      }
      await mutation.run(path, {
        method: mode === 'header' || mode === 'line' ? 'PATCH' : 'POST',
        body,
        ifMatch: mode === 'create' ? undefined : detail!.etag!,
      })
      setMode(null)
      setNotice('Máy chủ đã lưu quan sát kiểm kê.')
      invalidateCache('/stock-counts')
      reload()
    } catch (failure) {
      setFormError(errorMessage(failure))
      if (failure instanceof ApiError && [412, 428].includes(failure.status))
        setDetail((value) => (value ? { ...value, etag: null } : null))
    }
  }
  async function confirm() {
    if (
      !detail?.etag ||
      !canConfirmCount(
        detail.count,
        canCount,
        hasPermission('stock.adjustment.post'),
      ) ||
      mutation.busy
    )
      return
    try {
      await mutation.run(`/stock-counts/${detail.count.id}/confirm`, {
        ifMatch: detail.etag,
      })
      setNotice('Máy chủ đã xác nhận kiểm kê.')
      invalidateCache('/stock-counts')
      invalidateCache('/stock-adjustments')
      reload()
    } catch (failure) {
      setError(errorMessage(failure))
      if (failure instanceof ApiError && [412, 428].includes(failure.status))
        setDetail({ ...detail, etag: null })
    }
  }
  if (!canCount) return <Alert type="error">Không có quyền stock.count.</Alert>
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kiểm kê kho hàng</h1>
          <p className="page-desc">
            Giữ nguyên số sổ kho đã chụp. Đếm lại cần quan sát mới; biên bản xác
            nhận không sửa/xóa.
          </p>
        </div>
        <Button onClick={() => open('create')}>Lập kiểm kê</Button>
      </div>
      {notice && <Alert type="success">{notice}</Alert>}
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault()
          const params = new URLSearchParams()
          if (draftFilters.code) params.set('code', draftFilters.code)
          if (draftFilters.state) params.set('state', draftFilters.state)
          setFilters(params.toString())
          setCursors([''])
        }}
      >
        <Input
          label="Mã kiểm kê"
          value={draftFilters.code}
          onChange={(event) =>
            setDraftFilters({ ...draftFilters, code: event.target.value })
          }
        />
        <Select
          label="Trạng thái kiểm kê"
          value={draftFilters.state}
          onChange={(event) =>
            setDraftFilters({ ...draftFilters, state: event.target.value })
          }
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'DRAFT', label: 'DRAFT' },
            { value: 'CONFIRMED', label: 'CONFIRMED' },
          ]}
        />
        <Button type="submit">Áp dụng bộ lọc</Button>
      </form>
      {data.error && (
        <Alert type="error">
          {data.error}
          <Button onClick={data.reload}>Thử lại</Button>
        </Alert>
      )}
      {data.loading && <Spinner label="Đang tải kiểm kê..." />}
      {data.page && (
        <>
          <Table caption="Danh sách kiểm kê">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Thời điểm đếm</th>
                <th>Trạng thái</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.page.items.map((count) => (
                <tr key={count.id}>
                  <td>{count.code}</td>
                  <td>{count.countedAt}</td>
                  <td>{count.state}</td>
                  <td>{count.reason ?? '-'}</td>
                  <td>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDetail(null)
                        setError(null)
                        setSelected(count.id)
                      }}
                    >
                      Chi tiết {count.code}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            totalShowing={data.page.items.length}
            hasNext={data.page.pagination.hasMore}
            hasPrevious={cursors.length > 1}
            onNext={() => {
              if (data.page?.pagination.nextCursor)
                setCursors([...cursors, data.page.pagination.nextCursor])
            }}
            onPrevious={() => setCursors(cursors.slice(0, -1))}
          />
        </>
      )}
      <Modal
        isOpen={!!selected && !mode}
        title="Biên bản kiểm kê"
        maxWidth="lg"
        onClose={() => {
          if (!mutation.busy) setSelected(null)
        }}
      >
        {error && <Alert type="error">{error}</Alert>}
        {!detail && !error && <Spinner label="Đang lấy biên bản và ETag..." />}
        {detail && (
          <>
            <p>
              {detail.count.code} / {detail.count.state} /{' '}
              {detail.count.countedAt}
            </p>
            <p>
              Phiếu điều chỉnh liên kết:{' '}
              {detail.count.adjustmentDocumentId ?? '-'}
            </p>
            <Table caption="Quan sát và sổ kho đã chụp">
              <thead>
                <tr>
                  <th>Mặt hàng</th>
                  <th>Sổ kho</th>
                  <th>Thực đếm</th>
                  <th>Chênh lệch máy chủ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {detail.count.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {line.productCode} - {line.productName} / {line.unitName}
                    </td>
                    <td>{line.bookQuantity}</td>
                    <td>{line.countedQuantity}</td>
                    <td>{line.difference}</td>
                    <td>
                      {detail.count.state === 'DRAFT' && (
                        <Button
                          variant="outline"
                          disabled={!detail.etag || mutation.busy}
                          onClick={() => open('line', line)}
                        >
                          Sửa số đếm {line.id}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {detail.count.state === 'DRAFT' && (
              <>
                <p>
                  Xác nhận có chênh lệch cần stock.adjustment.post. Biến động
                  xen giữa có thể làm ảnh chụp cũ dù số tồn không đổi.
                </p>
                <div className="modal-actions">
                  <Button
                    disabled={!detail.etag || mutation.busy}
                    onClick={() => open('header')}
                  >
                    Sửa thông tin kiểm kê
                  </Button>
                  <Button
                    disabled={!detail.etag || mutation.busy}
                    onClick={() => open('add')}
                  >
                    Thêm quan sát
                  </Button>
                  <Button
                    disabled={!detail.etag || mutation.busy}
                    onClick={() => open('recount')}
                  >
                    Đếm lại toàn bộ
                  </Button>
                  <Button
                    disabled={
                      !detail.etag ||
                      !canConfirmCount(
                        detail.count,
                        canCount,
                        hasPermission('stock.adjustment.post'),
                      )
                    }
                    isLoading={mutation.busy}
                    onClick={() => void confirm()}
                  >
                    Xác nhận kiểm kê
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        <Button variant="outline" disabled={mutation.busy} onClick={reload}>
          Tải lại biên bản
        </Button>
      </Modal>
      <Modal
        isOpen={!!mode}
        title={
          mode === 'recount'
            ? 'Quan sát mới cho toàn bộ mặt hàng'
            : 'Ghi kiểm kê'
        }
        maxWidth="lg"
        onClose={() => {
          if (!mutation.busy) setMode(null)
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {formError && <Alert type="error">{formError}</Alert>}
          <fieldset disabled={mutation.busy}>
            {mode !== 'add' && mode !== 'line' && (
              <>
                <Input
                  label="Thời điểm đếm (ISO 8601, có múi giờ)"
                  value={countedAt}
                  onChange={(event) => setCountedAt(event.target.value)}
                />
                <Input
                  label="Lý do kiểm kê"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </>
            )}
            {mode !== 'header' &&
              observations.map((line, index) => (
                <div className="grid-2" key={index}>
                  <Input
                    label={`ID mặt hàng ${index + 1}`}
                    readOnly={mode === 'line' || mode === 'recount'}
                    value={line.productId}
                    onChange={(event) =>
                      setObservations(
                        observations.map((item, position) =>
                          position === index
                            ? { ...item, productId: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    label={`Số đếm thực tế ${index + 1}`}
                    inputMode="decimal"
                    value={line.countedQuantity}
                    onChange={(event) =>
                      setObservations(
                        observations.map((item, position) =>
                          position === index
                            ? { ...item, countedQuantity: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            {mode === 'create' && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setObservations([
                    ...observations,
                    { productId: '', countedQuantity: '' },
                  ])
                }
              >
                Thêm mặt hàng
              </Button>
            )}
          </fieldset>
          <div className="modal-actions">
            <Button type="submit" isLoading={mutation.busy}>
              Lưu quan sát
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.busy}
              onClick={() => setMode(null)}
            >
              Đóng
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
