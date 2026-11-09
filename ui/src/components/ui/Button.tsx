import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Button as ShadcnButton } from '../shadcn/button'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  icon?: ReactNode
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={
        variant === 'primary'
          ? 'default'
          : variant === 'danger'
            ? 'destructive'
            : variant
      }
      size={size === 'md' ? 'default' : size}
      className={className}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="btn-spinner" aria-hidden="true" />
      ) : icon ? (
        <span className="btn-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="btn-text">{children}</span>
    </ShadcnButton>
  )
}
