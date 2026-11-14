import { cn } from '@/lib/utils'
import { Loader2Icon } from 'lucide-react'
import { t } from '@/lib/i18n/core'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label={t('Đang tải')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
