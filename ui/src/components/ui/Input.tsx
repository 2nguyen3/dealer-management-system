import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Input as ShadcnInput } from '../shadcn/input'
import { Label } from '../shadcn/label'

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
        <Label htmlFor={inputId} className="form-label">
          {label} {required && <span className="form-required">*</span>}
        </Label>
      )}
      <div className="input-wrapper">
        <ShadcnInput
          ref={ref}
          id={inputId}
          className={className}
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
