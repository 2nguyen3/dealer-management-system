import { Link } from 'react-router'
import { Button } from '../components/ui/Button'
import { AlertCircleIcon } from '../components/ui/Icons'
import { t } from '@/lib/i18n/core'

export function NotFoundPage() {
  return (
    <div className="state-page">
      <div className="state-card">
        <div className="state-icon state-icon--neutral" aria-hidden="true">
          <AlertCircleIcon size={48} />
        </div>
        <h1 className="state-title">{t('Trang không tồn tại')}</h1>
        <p className="state-desc">
          {t('Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.')}
        </p>
        <div className="state-actions">
          <Link to="/">
            <Button variant="primary">{t('Về trang chủ')}</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
