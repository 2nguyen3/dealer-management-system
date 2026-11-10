import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
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
      <div
        className={cn(
          'form-field grid min-w-0 gap-1.5',
          error && 'form-field--error',
        )}
      >
        {label && (
          <Label htmlFor={selectId} className="text-[13px] text-foreground/85">
            {label}{' '}
            {required && (
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </Label>
        )}
        <NativeSelect
          ref={ref}
          id={selectId}
          className={cn('w-full bg-card', className)}
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
  },
)
