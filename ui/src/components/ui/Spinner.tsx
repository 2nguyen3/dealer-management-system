import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n/core'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const SIZES = { sm: 'size-4', md: 'size-6', lg: 'size-8' }

export function Spinner({
  size = 'md',
  label = t('Đang tải...'),
}: SpinnerProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-6 text-muted-foreground"
      role="status"
    >
      <Loader2 className={cn('animate-spin', SIZES[size])} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
