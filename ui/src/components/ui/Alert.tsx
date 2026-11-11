import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertDescription,
  AlertTitle,
  Alert as ShadcnAlert,
} from '../shadcn/alert'

export interface AlertProps {
  type?: 'error' | 'warning' | 'info' | 'success'
  title?: string
  children: ReactNode
  className?: string
}

const STYLES = {
  error:
    'border-destructive/30 bg-destructive/8 text-foreground [&>svg]:text-destructive',
  warning:
    'border-warning/30 bg-warning/8 text-foreground [&>svg]:text-warning',
  info: 'border-info/30 bg-info/8 text-foreground [&>svg]:text-info',
  success:
    'border-success/30 bg-success/8 text-foreground [&>svg]:text-success',
}

const ICONS = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
}

export function Alert({
  type = 'info',
  title,
  children,
  className = '',
}: AlertProps) {
  const Icon = ICONS[type]
  return (
    <ShadcnAlert
      className={cn(
        'alert animate-in fade-in-0 slide-in-from-top-1 duration-300',
        `alert--${type}`,
        STYLES[type],
        className,
      )}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="text-current opacity-90">
        {children}
      </AlertDescription>
    </ShadcnAlert>
  )
}
