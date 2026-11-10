import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
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
    <div
      className={cn(
        'form-field grid min-w-0 gap-1.5',
        error && 'form-field--error',
      )}
    >
      {label && (
        <Label htmlFor={inputId} className="text-[13px] text-foreground/85">
          {label}{' '}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}
      <div className="relative">
        <ShadcnInput
          ref={ref}
          id={inputId}
          className={cn('bg-card', endAdornment && 'pr-10', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId || helperId || undefined}
          required={required}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-1 flex items-center">
            {endAdornment}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  )
})
