import { forwardRef, type SelectHTMLAttributes } from 'react'
import { Label } from '../shadcn/label'
import { NativeSelect, NativeSelectOption } from '../shadcn/native-select'

export interface SelectOption {
  value: string | number
  label: string
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'size'
> {
  label?: string
  options: SelectOption[]
  error?: string
  helperText?: string
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      options,
      error,
      helperText,
      id,
      className = '',
      required,
      placeholder,
      ...props
    },
    ref,
  ) {
    const selectId =
      id ||
      (label
        ? `select-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        : undefined)
    const errorId = selectId && error ? `${selectId}-error` : undefined
    const helperId = selectId && helperText ? `${selectId}-helper` : undefined

    return (
      <div className={`form-field ${error ? 'form-field--error' : ''}`.trim()}>
        {label && (
          <Label htmlFor={selectId} className="form-label">
            {label} {required && <span className="form-required">*</span>}
          </Label>
        )}
        <NativeSelect
          ref={ref}
          id={selectId}
          className={className}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId || helperId || undefined}
          required={required}
          {...props}
        >
          {placeholder && (
            <NativeSelectOption value="" disabled>
              {placeholder}
            </NativeSelectOption>
          )}
          {options.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {error && (
          <p id={errorId} className="form-error" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="form-helper">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)
