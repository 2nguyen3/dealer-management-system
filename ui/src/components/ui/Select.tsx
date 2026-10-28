import { forwardRef, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string | number
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
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
          <label htmlFor={selectId} className="form-label">
            {label} {required && <span className="form-required">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`select ${className}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId || helperId || undefined}
          required={required}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
