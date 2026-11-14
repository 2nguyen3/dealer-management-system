import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../../components/shadcn/button'
import { t } from '@/lib/i18n/core'

export interface PasswordToggleProps {
  visible: boolean
  onToggle: () => void
  controls?: string
}

/** Ghost icon button that shows or hides a password field. */
export function PasswordToggle({
  visible,
  onToggle,
  controls,
}: PasswordToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="cursor-pointer text-muted-foreground hover:text-foreground"
      onClick={onToggle}
      aria-label={visible ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
      title={visible ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
      aria-controls={controls}
    >
      {visible ? (
        <EyeOff className="size-4" aria-hidden="true" />
      ) : (
        <Eye className="size-4" aria-hidden="true" />
      )}
    </Button>
  )
}
