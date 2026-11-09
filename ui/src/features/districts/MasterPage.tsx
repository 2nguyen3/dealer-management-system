import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import type { FunctionCode } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'
import {
  businessDate,
  catalog,
  Intent,
  message,
  money,
  quantity,
  vietnamDate,
  type Row,
} from '../payment_receipts/contracts'
import { useSourcePage } from '../payment_receipts/useSourcePage'

interface Field {
  key: string
  label: string
  type?:
    | 'catalog'
    | 'money'
    | 'quantity'
    | 'date'
    | 'email'
    | 'password'
    | 'boolean'
    | 'status'
  optional?: boolean
  createOnly?: boolean
  choices?: string[]
}
export interface MasterConfig {
  path: string
  title: string
  manage: FunctionCode
  fields: Field[]
  columns: [string, string][]
  decode: (value: unknown) => Row
  statuses?: string[]
  filters?: [string, string][]
  deletePermission?: FunctionCode
  noDelete?: boolean
  terminate?: boolean
  passwordReset?: boolean
}

const valueLabels: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng sử dụng',
  LOCKED: 'Đã khóa',
  TERMINATED: 'Ngừng hợp tác',
  true: 'Có',
  false: 'Không',
}

export function MasterPage({ config }: { config: MasterConfig }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission(config.manage)
  const [filters, setFilters] = useState<Record<string, string>>({ q: '' })
  const list = useSourcePage(config.path, filters, config.decode)
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<{
    item: Row
    etag: string | null
  } | null>(null)
  const [detailError, setDetailError] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const intent = useRef(new Intent())
  useEffect(() => {
    if (!selected) return
    let current = true
    const controller = new AbortController()
    apiFetch<unknown>(`${config.path}/${selected}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const item = config.decode(response.data)
        if (current) {
          setDetailError('')
          setDetail({ item, etag: response.etag })
          setValues(
            Object.fromEntries(
              config.fields.map((field) => [
                field.key,
                String(item[field.key] ?? ''),
              ]),
            ),
          )
        }
      })
      .catch((failure: unknown) => {
        if (current) setDetailError(message(failure))
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [config, selected, version])

  const refresh = () => {
    invalidateCache(config.path)
    list.reload()
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !canManage || (!creating && !detail?.etag)) return
    setError('')
    setNotice('')
    try {
      const body: Row = {}
      for (const field of config.fields) {
        if (!creating && field.createOnly) continue
        const raw = values[field.key] ?? ''
        if (field.optional && raw === '') {
          body[field.key] = null
          continue
        }
        if (!raw.trim() && field.type !== 'password')
          throw new Error(`Cần nhập ${field.label}.`)
        body[field.key] =
          field.type === 'catalog'
            ? catalog(raw)
            : field.type === 'money'
              ? money(raw)
              : field.type === 'quantity'
                ? quantity(raw)
                : field.type === 'boolean'
                  ? raw === 'true'
                  : field.type === 'date'
                    ? businessDate(raw)
                    : field.type === 'password'
                      ? raw
                      : raw.trim()
        if (field.type === 'password' && raw === '')
          throw new Error('Mật khẩu không được rỗng.')
      }
      setBusy(true)
      await intent.current.send(
        creating ? config.path : `${config.path}/${selected}`,
        {
          method: creating ? 'POST' : 'PATCH',
          body,
          ...(!creating ? { ifMatch: detail!.etag! } : {}),
        },
        false,
      )
      setNotice('Máy chủ đã xác nhận thay đổi.')
      setCreating(false)
      setSelected('')
      setDetail(null)
      setValues({})
      refresh()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const action = async (name: 'delete' | 'terminate' | 'password-reset') => {
    if (busy || !canManage || !detail?.etag) return
    if (
      name === 'delete' &&
      !window.confirm(
        'Xóa bản ghi chưa được sử dụng? Máy chủ sẽ kiểm tra ràng buộc.',
      )
    )
      return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await intent.current.send(
        `${config.path}/${selected}${name === 'delete' ? '' : `/${name}`}`,
        {
          method: name === 'delete' ? 'DELETE' : 'POST',
          ifMatch: detail.etag,
          ...(name === 'terminate'
            ? { body: { reason: reason.trim() } }
            : name === 'password-reset'
              ? { body: { newPassword: password } }
              : {}),
        },
        name === 'terminate',
      )
      setNotice(
        name === 'password-reset'
          ? 'Đã đặt lại mật khẩu và thu hồi phiên. Tài khoản LOCKED không tự mở khóa.'
          : 'Máy chủ đã xác nhận thao tác.',
      )
      setSelected('')
      setDetail(null)
      setPassword('')
      refresh()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const disabled = busy || (!creating && !detail?.etag)
  const terminated = detail?.item.status === 'TERMINATED'
  const editableFields = config.fields.filter(
    (field) => creating || !field.createOnly,
  )
  const unchanged =
    !creating &&
    !!detail &&
    editableFields.every(
      (field) =>
        (values[field.key] ?? '') === String(detail.item[field.key] ?? ''),
    )
  const readOnlyColumns = config.columns.filter(
    ([key]) =>
      !canManage ||
      terminated ||
      !editableFields.some((field) => field.key === key),
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{config.title}</h1>
        {canManage && (
          <Button
            disabled={busy}
            onClick={() => {
              setCreating(true)
              setSelected('')
              setError('')
              setDetailError('')
              setValues(
                Object.fromEntries(
                  config.fields.map((field) => [
                    field.key,
                    field.type === 'date'
                      ? vietnamDate()
                      : field.type === 'boolean'
                        ? 'false'
                        : field.type === 'status'
                          ? 'ACTIVE'
                          : '',
                  ]),
                ),
              )
            }}
          >
            Thêm mới
          </Button>
        )}
      </div>
      {error && !creating && !selected && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      <div className="filter-bar">
        <Input
          label="Tìm kiếm"
          id="master-filter-search"
          value={filters.q ?? ''}
          onChange={(event) =>
            setFilters({ ...filters, q: event.target.value })
          }
        />
        {config.statuses && (
          <Select
            label="Trạng thái"
            id="master-filter-status"
            value={filters.status ?? ''}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
            options={['', ...config.statuses].map((value) => ({
              value,
              label: value ? (valueLabels[value] ?? value) : 'Tất cả',
            }))}
          />
        )}
        {config.filters?.map(([key, label]) => (
          <Input
            key={key}
            id={`master-filter-${key}`}
            label={label}
            value={filters[key] ?? ''}
            onChange={(event) =>
              setFilters({ ...filters, [key]: event.target.value })
            }
          />
        ))}
        <Button type="button" variant="outline" onClick={list.reload}>
          Tải lại
        </Button>
      </div>
      {list.error && <Alert type="error">{list.error}</Alert>}
      {list.loading ? (
        <Spinner />
      ) : (
        <div className="card">
          <Table caption={config.title}>
            <thead>
              <tr>
                {config.columns.map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={String(item.id)}>
                  {config.columns.map(([key]) => (
                    <td key={key}>
                      {key === 'status'
                        ? (valueLabels[String(item[key])] ??
                          String(item[key] ?? '-'))
                        : String(item[key] ?? '-')}
                    </td>
                  ))}
                  <td>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelected(String(item.id))
                        setDetail(null)
                        setDetailError('')
                        setError('')
                        setReason('')
                        setPassword('')
                      }}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!list.items.length && (
            <p className="empty-card">Không có kết quả.</p>
          )}
          <Pagination
            hasNext={list.hasMore}
            hasPrevious={list.hasPrevious}
            onNext={list.next}
            onPrevious={list.previous}
            totalShowing={list.items.length}
          />
        </div>
      )}
      <Modal
        isOpen={creating || !!selected}
        onClose={() => {
          if (busy) return
          setCreating(false)
          setSelected('')
          setDetailError('')
          setError('')
          setValues({})
          setPassword('')
        }}
        title={
          creating
            ? `Thêm ${config.title}`
            : `Chi tiết ${String(detail?.item.code ?? `#${selected}`)}`
        }
        maxWidth="lg"
      >
        {error && <Alert type="error">{error}</Alert>}
        {!creating && !detail ? (
          detailError ? (
            <div>
              <Alert type="error">{detailError}</Alert>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDetailError('')
                  setVersion((value) => value + 1)
                }}
              >
                Thử tải lại
              </Button>
            </div>
          ) : (
            <Spinner />
          )
        ) : (
          <>
            {!creating && readOnlyColumns.length > 0 && (
              <dl className="detail-grid">
                {readOnlyColumns.map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>
                      {key === 'status'
                        ? (valueLabels[String(detail?.item[key])] ??
                          String(detail?.item[key] ?? '-'))
                        : String(detail?.item[key] ?? '-')}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {canManage && !terminated && (
              <form onSubmit={submit}>
                {editableFields.map((field) =>
                  field.type === 'boolean' || field.type === 'status' ? (
                    <Select
                      key={field.key}
                      id={`master-field-${field.key}`}
                      label={field.label}
                      value={values[field.key] ?? ''}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          [field.key]: event.target.value,
                        })
                      }
                      options={(field.type === 'boolean'
                        ? ['false', 'true']
                        : (field.choices ?? ['ACTIVE', 'INACTIVE'])
                      ).map((value) => ({
                        value,
                        label: valueLabels[value] ?? value,
                      }))}
                      disabled={disabled}
                    />
                  ) : (
                    <Input
                      key={field.key}
                      id={`master-field-${field.key}`}
                      label={field.label}
                      type={
                        field.type === 'date' ||
                        field.type === 'email' ||
                        field.type === 'password'
                          ? field.type
                          : 'text'
                      }
                      value={values[field.key] ?? ''}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          [field.key]: event.target.value,
                        })
                      }
                      disabled={disabled}
                      required={!field.optional}
                    />
                  ),
                )}
                {!creating && !detail?.etag && (
                  <Alert type="warning">
                    Thiếu ETag, tải lại chi tiết trước khi sửa.
                  </Alert>
                )}
                <Button
                  type="submit"
                  disabled={disabled || unchanged}
                  isLoading={busy}
                >
                  {creating ? 'Tạo mới' : 'Lưu thay đổi'}
                </Button>
              </form>
            )}
            {!creating && (
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setDetail(null)
                    setDetailError('')
                    setVersion((value) => value + 1)
                  }}
                >
                  Tải lại chi tiết
                </Button>
                {canManage &&
                  detail &&
                  !config.noDelete &&
                  (!config.deletePermission ||
                    hasPermission(config.deletePermission)) && (
                    <Button
                      variant="danger"
                      disabled={disabled}
                      onClick={() => action('delete')}
                    >
                      Xóa
                    </Button>
                  )}
                {canManage && detail && config.terminate && !terminated && (
                  <div>
                    <Input
                      label="Lý do ngừng hợp tác"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <Button
                      disabled={disabled || !reason.trim()}
                      onClick={() => action('terminate')}
                    >
                      Ngừng hợp tác vĩnh viễn
                    </Button>
                  </div>
                )}
                {canManage && detail && config.passwordReset && (
                  <div>
                    <Input
                      label="Mật khẩu mới"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button
                      disabled={disabled || !password}
                      onClick={() => action('password-reset')}
                    >
                      Đặt lại mật khẩu
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
