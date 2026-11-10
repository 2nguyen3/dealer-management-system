import { format, isValid, parse } from 'date-fns'
import { vi } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '../shadcn/button'
import { Calendar } from '../shadcn/calendar'
import { Label } from '../shadcn/label'
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover'

export interface DateFieldProps {
  label?: string
  /** Business date `YYYY-MM-DD`, or '' when empty. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  id?: string
  min?: string
  max?: string
  clearable?: boolean
  className?: string
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(parsed) ? parsed : undefined
}

/** Date picker that displays dd/MM/yyyy but keeps the ISO business date. */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  required,
  disabled,
  error,
  id,
  min,
  max,
  clearable = !required,
  className,
}: DateFieldProps) {
  const autoId = useId()
  const fieldId = id ?? `date-${autoId}`
  const [open, setOpen] = useState(false)
  const selected = toDate(value)
  const minDate = toDate(min)
  const maxDate = toDate(max)
  const errorId = error ? `${fieldId}-error` : undefined
  const display = selected ? format(selected, 'dd/MM/yyyy') : placeholder

  return (
    <div className={cn('form-field grid min-w-0 gap-1.5', className)}>
      {label && (
        <Label htmlFor={fieldId} className="text-[13px] text-foreground/85">
          {label}{' '}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={fieldId}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={errorId}
              aria-label={label ? `${label}: ${display}` : display}
              className={cn(
                'w-full justify-start bg-card px-3 font-normal tabular-nums',
                !selected && 'text-muted-foreground',
                clearable && selected && 'pr-9',
              )}
            >
              <CalendarIcon className="size-4 opacity-60" aria-hidden="true" />
              {display}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={vi}
              selected={selected}
              defaultMonth={selected ?? maxDate}
              captionLayout="dropdown"
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
              onSelect={(date) => {
                onChange(date ? format(date, 'yyyy-MM-dd') : '')
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
        {clearable && selected && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-1 my-auto flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Xóa ${label ?? 'ngày'}`}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
