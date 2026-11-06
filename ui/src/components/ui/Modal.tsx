import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog'
import { XIcon } from './Icons'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
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
        className={`modal-dialog modal-dialog--${maxWidth}`}
      >
        <DialogHeader className="modal-header">
          <DialogTitle className="modal-title">{title}</DialogTitle>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
          >
            <XIcon size={18} />
          </button>
        </DialogHeader>
        <div className="modal-body">{children}</div>
        {footer && (
          <DialogFooter className="modal-footer">{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
