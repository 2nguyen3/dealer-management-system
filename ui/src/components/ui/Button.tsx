import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button as ShadcnButton } from '../shadcn/button'
import {
  ACTION_ICONS,
  inferAction,
  textOf,
  type ActionKind,
} from './actionIcons'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  /** Explicit leading icon; wins over `action`. */
  icon?: ReactNode
  /**
   * Shared action pictogram (see `ACTION_ICONS`). By default it is inferred
   * from a plain-text label ("Lưu", "Hủy", "Xuất PDF"…); `false` opts out.
   */
  action?: ActionKind | false
}

const VARIANTS = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
  outline: 'outline',
} as const

function resolveIcon(
  icon: ReactNode,
  action: ActionKind | false | undefined,
  children: ReactNode,
): ReactNode {
  if (icon) return icon
  if (action === false) return null
  const label = action ? null : textOf(children)
  const kind = action || (label === null ? null : inferAction(label))
  if (!kind) return null
  const Icon = ACTION_ICONS[kind]
  return <Icon className="size-4" data-action={kind} />
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  action,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const leading = resolveIcon(icon, action, children)
  return (
    <ShadcnButton
      variant={VARIANTS[variant]}
      size={size === 'md' ? 'default' : size}
      className={cn('cursor-pointer', className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : leading ? (
        <span className="inline-flex" aria-hidden="true">
          {leading}
        </span>
      ) : null}
      {children}
    </ShadcnButton>
  )
}
