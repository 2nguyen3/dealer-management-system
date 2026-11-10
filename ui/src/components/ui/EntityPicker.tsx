import {
  useCallback,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
} from 'react'
import { apiFetch } from '../../lib/api'
import {
  describeItem,
  rowsOf,
  type PickerItem,
  type PickerResource,
} from './pickerItems'
import { Label } from '../shadcn/label'
import './EntityPicker.css'

const PAGE_SIZE = 20
const DEBOUNCE_MS = 250

export interface EntityPickerProps {
  resource: PickerResource
  label: string
  /** Selected id as a string; empty string means nothing selected. */
  value: string
  onChange: (id: string, item: PickerItem | null) => void
  /** Extra list filters, e.g. `{ status: 'ACTIVE' }`. */
  params?: Record<string, string>
  required?: boolean
  disabled?: boolean
  error?: string
  placeholder?: string
  /** Also submits the id through a hidden input with this name. */
  name?: string
  id?: string
}

/**
 * Searchable combobox for choosing a server record by code/name instead of
 * typing its database id. The selected value stays the exact server id.
 */
export function EntityPicker({
  resource,
  label,
  value,
  onChange,
  params,
  required,
  disabled,
  error,
  placeholder = 'Gõ mã hoặc tên để tìm…',
  name,
  id,
}: EntityPickerProps) {
  const autoId = useId()
  const inputId = id ?? `picker-${autoId}`
  const listId = `${inputId}-list`
  const errorId = `${inputId}-error`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PickerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(-1)
  const [selected, setSelected] = useState<PickerItem | null>(null)
  const paramKey = JSON.stringify(params ?? {})

  const [resolved, setResolved] = useState<PickerItem | null>(null)
  const current: PickerItem | null = !value
    ? null
    : selected?.id === value
      ? selected
      : (items.find((item) => item.id === value) ??
        (resolved?.id === value ? resolved : null))
  const needsLookup = Boolean(value) && current === null

  // Resolve a label for an id chosen elsewhere (draft edit, URL state).
  useEffect(() => {
    if (!needsLookup) return
    const controller = new AbortController()
    apiFetch<unknown>(`/${resource}/${encodeURIComponent(value)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return
        setResolved(
          describeItem(resource, res.data) ?? { id: value, label: `#${value}` },
        )
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResolved({ id: value, label: `#${value}` })
      })
    return () => controller.abort()
  }, [needsLookup, value, resource])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const search = new URLSearchParams(
        JSON.parse(paramKey) as Record<string, string>,
      )
      search.set('limit', String(PAGE_SIZE))
      if (query.trim()) search.set('q', query.trim())
      setLoading(true)
      setFailed(false)
      apiFetch<unknown>(`/${resource}?${search.toString()}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (controller.signal.aborted) return
          const next = rowsOf(res.data)
            .map((row) => describeItem(resource, row))
            .filter((item): item is PickerItem => item !== null)
          setItems(next)
          setActive(next.length ? 0 : -1)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setItems([])
          setFailed(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query, resource, paramKey])

  const choose = useCallback(
    (item: PickerItem | null) => {
      setSelected(item)
      setOpen(false)
      setQuery('')
      onChange(item?.id ?? '', item)
    },
    [onChange],
  )

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setActive((index) => Math.min(index + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      const item = items[active]
      if (item) choose(item)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  const activeId = open && items[active] ? `${listId}-${active}` : undefined

  return (
    <div
      className={`form-field entity-picker ${error ? 'form-field--error' : ''}`.trim()}
    >
      <Label htmlFor={inputId} className="form-label">
        {label} {required && <span className="form-required">*</span>}
      </Label>
      <div className="entity-picker__control">
        <input
          id={inputId}
          className="entity-picker__input"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-required={required || undefined}
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : (current?.label ?? '')}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setQuery('')
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        {value && !disabled && (
          <button
            type="button"
            className="entity-picker__clear"
            aria-label={`Bỏ chọn ${label}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(null)}
          >
            ×
          </button>
        )}
      </div>
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <ul id={listId} role="listbox" className="entity-picker__list">
          {loading && items.length === 0 && (
            <li className="entity-picker__hint">Đang tìm…</li>
          )}
          {!loading && failed && (
            <li className="entity-picker__hint">Không tải được danh sách.</li>
          )}
          {!loading && !failed && items.length === 0 && (
            <li className="entity-picker__hint">Không có kết quả phù hợp.</li>
          )}
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={item.id === value}
              className={`entity-picker__option ${index === active ? 'is-active' : ''}`.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(item)}
            >
              <span className="entity-picker__label">{item.label}</span>
              {item.detail && (
                <span className="entity-picker__detail">{item.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export type { PickerItem, PickerResource } from './pickerItems'
