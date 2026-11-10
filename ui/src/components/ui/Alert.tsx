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
  error: 'border-red-200 bg-red-50 text-red-800 [&>svg]:text-red-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600',
  info: 'border-sky-200 bg-sky-50 text-sky-900 [&>svg]:text-sky-600',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-600',
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
      className={cn('alert', `alert--${type}`, STYLES[type], className)}
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
