import type { ReactNode } from 'react'
import { AlertCircleIcon, CheckCircleIcon } from './Icons'

export interface AlertProps {
  type?: 'error' | 'warning' | 'info' | 'success'
  title?: string
  children: ReactNode
  className?: string
}

export function Alert({
  type = 'info',
  title,
  children,
  className = '',
}: AlertProps) {
  return (
    <div
      className={`alert alert--${type} ${className}`.trim()}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <div className="alert-icon" aria-hidden="true">
        {type === 'success' ? (
          <CheckCircleIcon size={18} />
        ) : (
          <AlertCircleIcon size={18} />
        )}
      </div>
      <div className="alert-content">
        {title && <h3 className="alert-title">{title}</h3>}
        <div className="alert-message">{children}</div>
      </div>
    </div>
  )
}
