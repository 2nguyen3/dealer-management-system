import { useEffect, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { apiFetch } from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import {
  decimal,
  id,
  message,
  record,
  type Row,
} from '../payment_receipts/contracts'

export function Balance({ agencyId }: { agencyId: string }) {
  const [state, setState] = useState<{
    agency: string
    data?: Row
    error?: string
  }>({ agency: '' })
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    apiFetch<unknown>(`/agencies/${id(agencyId)}/balance`, {
      signal: controller.signal,
    })
      .then((response) => {
        const data = record(response.data)
        for (const field of [
          'currentDebt',
          'currentCredit',
          'reservedCredit',
          'availableCredit',
          'maxDebt',
          'remainingCreditLimit',
        ])
          decimal(data[field])
        if (current) setState({ agency: agencyId, data })
      })
      .catch((error: unknown) => {
        if (current) setState({ agency: agencyId, error: message(error) })
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [agencyId])
  if (state.agency !== agencyId) return <p>Đang tải số dư...</p>
  if (state.error) return <Alert type="error">{state.error}</Alert>
  return (
    <dl className="detail-grid">
      {[
        ['currentDebt', 'Dư nợ hiện tại'],
        ['currentCredit', 'Dư có hiện tại'],
        ['reservedCredit', 'Dư có giữ chỗ'],
        ['availableCredit', 'Dư có khả dụng'],
        ['remainingCreditLimit', 'Hạn mức còn lại'],
      ].map(([field, label]) => (
        <div key={field}>
          <dt>{label}</dt>
          <dd>{formatVND(String(state.data?.[field!]))}</dd>
        </div>
      ))}
    </dl>
  )
}
