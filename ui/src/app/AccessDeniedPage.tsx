import { Link } from 'react-router'
import { Button } from '../components/ui/Button'
import { ShieldIcon } from '../components/ui/Icons'

export function AccessDeniedPage() {
  return (
    <div className="state-page">
      <div className="state-card">
        <div className="state-icon state-icon--danger" aria-hidden="true">
          <ShieldIcon size={48} />
        </div>
        <h1 className="state-title">Không có quyền truy cập</h1>
        <p className="state-desc">
          Tài khoản của bạn không có quyền truy cập vào chức năng này. Vui lòng
          liên hệ người quản trị nếu bạn cần được cấp quyền.
        </p>
        <div className="state-actions">
          <Link to="/">
            <Button variant="primary">Về trang chủ</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
