import { EntityPicker, type PickerItem } from '../../components/ui/EntityPicker'

export interface WardPickerProps {
  id?: string
  /** Visible label; defaults to "Phường/xã". */
  label?: string
  /** Selected ward id as a string; empty string means none. */
  value: string
  onChange: (id: string, item: PickerItem | null) => void
  required?: boolean
  disabled?: boolean
  error?: string
  /** Text shown while empty, e.g. "Tất cả phường/xã" for filters. */
  placeholder?: string
}

/**
 * Searchable combobox over the read-only catalogue of the 168 wards/communes
 * of Ho Chi Minh City. Search runs on the server (`GET /wards?q=`); the value
 * stays the exact server id.
 */
export function WardPicker({
  id,
  label = 'Phường/xã',
  value,
  onChange,
  required,
  disabled,
  error,
  placeholder = 'Gõ tên phường/xã để tìm…',
}: WardPickerProps) {
  return (
    <EntityPicker
      id={id}
      resource="wards"
      label={label}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      error={error}
      placeholder={placeholder}
    />
  )
}
