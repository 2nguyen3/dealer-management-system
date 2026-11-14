import { Select } from '../../components/ui/Select'
import { useCatalogOptions } from './useCatalogOptions'
import { t } from '@/lib/i18n/core'

export interface CatalogSelectProps {
  id: string
  label: string
  /** List path such as `/units`; loaded once with `limit=100`. */
  path: string
  value: string
  onChange: (value: string) => void
  /** Label of the empty choice (e.g. "Tất cả"); omit to require a choice. */
  emptyLabel?: string
  disabled?: boolean
  required?: boolean
}

/** Select of a small catalogue by name; the value is the exact server id. */
export function CatalogSelect({
  id,
  label,
  path,
  value,
  onChange,
  emptyLabel,
  disabled,
  required,
}: CatalogSelectProps) {
  const { options, error, loading } = useCatalogOptions(path)
  const known = !value || options.some((option) => option.value === value)
  return (
    <Select
      id={id}
      label={label}
      value={value}
      required={required}
      disabled={disabled}
      error={error || undefined}
      onChange={(event) => onChange(event.target.value)}
      options={[
        ...(emptyLabel !== undefined
          ? [{ value: '', label: emptyLabel }]
          : !value
            ? [{ value: '', label: loading ? t('Đang tải…') : t('Chọn…') }]
            : []),
        ...options,
        ...(known
          ? []
          : [{ value, label: loading ? t('Đang tải…') : `#${value}` }]),
      ]}
    />
  )
}
