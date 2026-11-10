import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
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
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
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
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <button
            type="button"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
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
