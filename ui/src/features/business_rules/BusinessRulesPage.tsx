import { useEffect, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { apiFetch, type ApiResponse } from '../../lib/api'
import { cachedApiFetch, invalidateCache } from '../../lib/cache'
import type { BusinessRules } from '../../lib/types'
import { useAuth } from '../authentication/useAuth'

export function BusinessRulesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('rules.manage')

  const [rules, setRules] = useState<BusinessRules | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [maxAgencies, setMaxAgencies] = useState('4')
  const [maxTypes, setMaxTypes] = useState('2')
  const [maxUnits, setMaxUnits] = useState('6')
  const [multiplier, setMultiplier] = useState('1.02')
  const [allowDebtExceed, setAllowDebtExceed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    cachedApiFetch<BusinessRules>('/business-rules')
      .then((res: ApiResponse<BusinessRules>) => {
        setRules(res.data)
        setEtag(res.etag)
        setMaxAgencies(String(res.data.maxAgenciesPerDistrict))
        setMaxTypes(String(res.data.maxAgencyTypesCount))
        setMaxUnits(String(res.data.maxUnitsCount))
        setMultiplier(res.data.priceMultiplier || '1.02')
        setAllowDebtExceed(res.data.allowDebtExceedLimit)
      })
      .catch((err: unknown) => {
        const e = err as { message?: string }
        setError(e.message || 'Không thể tải quy định hệ thống.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    setIsSubmitting(true)
    try {
      const res: ApiResponse<BusinessRules> = await apiFetch(
        '/business-rules',
        {
          method: 'PUT',
          ifMatch: etag || undefined,
          body: {
            maxAgenciesPerDistrict: Number(maxAgencies),
            maxAgencyTypesCount: Number(maxTypes),
            maxUnitsCount: Number(maxUnits),
            priceMultiplier: multiplier.trim(),
            allowDebtExceedLimit: allowDebtExceed,
          },
        },
      )
      invalidateCache('/business-rules')
      setRules(res.data)
      setEtag(res.etag)
      setSuccessMessage('Đã cập nhật quy định hệ thống thành công.')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Không thể cập nhật quy định hệ thống.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Thay đổi quy định</h1>
          <p className="page-desc">
            Cấu hình các tham số và giới hạn nghiệp vụ hoạt động của toàn hệ
            thống
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successMessage && <Alert type="success">{successMessage}</Alert>}

      {isLoading ? (
        <div className="page-loading">
          <Spinner label="Đang tải quy định hệ thống..." />
        </div>
      ) : (
        <div className="card settings-card">
          <form onSubmit={handleSubmit} className="settings-form" noValidate>
            <div className="form-group-section">
              <h2 className="section-title">Quy định về Đại lý & Quận (QĐ1)</h2>
              <div className="grid-2">
                <Input
                  label="Số đại lý tối đa trong mỗi quận"
                  type="number"
                  min="1"
                  value={maxAgencies}
                  onChange={(e) => setMaxAgencies(e.target.value)}
                  disabled={!canManage}
                  helperText="Số lượng đại lý đang hoạt động tối đa được phép tiếp nhận trong 1 quận"
                  required
                />
                <Input
                  label="Số loại đại lý tối đa"
                  type="number"
                  min="1"
                  value={maxTypes}
                  onChange={(e) => setMaxTypes(e.target.value)}
                  disabled={!canManage}
                  helperText="Giới hạn số loại đại lý được phép thiết lập trong hệ thống"
                  required
                />
              </div>
            </div>

            <div className="form-group-section">
              <h2 className="section-title">
                Quy định về Hàng hóa & Đơn vị tính (QĐ2)
              </h2>
              <div className="grid-2">
                <Input
                  label="Số đơn vị tính tối đa"
                  type="number"
                  min="1"
                  value={maxUnits}
                  onChange={(e) => setMaxUnits(e.target.value)}
                  disabled={!canManage}
                  helperText="Giới hạn số đơn vị tính được phép tạo"
                  required
                />
                <Input
                  label="Tỷ lệ tính đơn giá xuất hàng"
                  type="text"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  disabled={!canManage}
                  helperText="Hệ số nhân với đơn giá nhập (ví dụ: 1.02 tương ứng tăng 2%)"
                  required
                />
              </div>
            </div>

            <div className="form-group-section">
              <h2 className="section-title">
                Quy định về Xuất hàng & Công nợ (QĐ4 & QĐ5)
              </h2>
              <div className="checkbox-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allowDebtExceed}
                    onChange={(e) => setAllowDebtExceed(e.target.checked)}
                    disabled={!canManage}
                  />
                  <span>
                    Cho phép số tiền nợ của đại lý vượt quá giới hạn nợ tối đa
                    của loại đại lý đó khi xuất hàng
                  </span>
                </label>
              </div>
            </div>

            {canManage && (
              <div className="form-actions-bar">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (rules) {
                      setMaxAgencies(String(rules.maxAgenciesPerDistrict))
                      setMaxTypes(String(rules.maxAgencyTypesCount))
                      setMaxUnits(String(rules.maxUnitsCount))
                      setMultiplier(rules.priceMultiplier)
                      setAllowDebtExceed(rules.allowDebtExceedLimit)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  Khôi phục ban đầu
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                >
                  Lưu thay đổi quy định
                </Button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
