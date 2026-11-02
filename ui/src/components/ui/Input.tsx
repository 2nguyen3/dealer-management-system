import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  endAdornment?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    id,
    className = '',
    required,
    endAdornment,
    ...props
  },
  ref,
) {
  const inputId =
    id ||
    (label
      ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      : undefined)
  const errorId = inputId && error ? `${inputId}-error` : undefined
  const helperId = inputId && helperText ? `${inputId}-helper` : undefined

  return (
    <div className={`form-field ${error ? 'form-field--error' : ''}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label} {required && <span className="form-required">*</span>}
        </label>
      )}
      <div className="input-wrapper">
        <input
          ref={ref}
          id={inputId}
          className={`input ${className}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId || helperId || undefined}
          required={required}
          {...props}
        />
        {endAdornment && <div className="input-adornment">{endAdornment}</div>}
      </div>
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
})
