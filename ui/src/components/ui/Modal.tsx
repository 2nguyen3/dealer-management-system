import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ACTION_ICONS, inferAction } from './actionIcons'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog'
import { t } from '@/lib/i18n/core'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** Title icon; inferred from the title verb when omitted, `false` hides it. */
  icon?: ReactNode | false
  children: ReactNode
  footer?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

const WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
  const kind = icon === undefined ? inferAction(title) : null
  const KindIcon = kind ? ACTION_ICONS[kind] : null
  const titleIcon = KindIcon ? <KindIcon /> : icon || null
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          'modal-dialog flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0',
          WIDTHS[maxWidth],
        )}
      >
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-6 py-4">
          <DialogTitle className="flex min-w-0 items-center gap-2.5 text-base font-semibold">
            {titleIcon && (
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4"
              >
                {titleIcon}
              </span>
            )}
            <span className="min-w-0">{title}</span>
          </DialogTitle>
          <button
            type="button"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={onClose}
            aria-label={t('Đóng hộp thoại')}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </DialogHeader>
        <div className="modal-body min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <DialogFooter className="gap-2 border-t bg-muted/40 px-6 py-3">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
