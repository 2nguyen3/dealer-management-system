import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { apiFetch } from '../../lib/api'
import { invalidateCache } from '../../lib/cache'
import { useAuth } from '../authentication/useAuth'
import {
  catalog,
  decimal,
  Intent,
  message,
  record,
} from '../payment_receipts/contracts'

export function BusinessRulesPage() {
  const { hasPermission } = useAuth()
  const [capacity, setCapacity] = useState('')
  const [rate, setRate] = useState('')
  const [etag, setEtag] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const intent = useRef(new Intent())
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    apiFetch<unknown>('/business-rules', { signal: controller.signal })
      .then((response) => {
        const data = record(response.data)
        catalog(data.maxAgenciesPerDistrict)
        decimal(data.sellingPriceRate)
        if (current) {
          setCapacity(String(data.maxAgenciesPerDistrict))
          setRate(String(data.sellingPriceRate))
          setEtag(response.etag)
        }
      })
      .catch((failure: unknown) => {
        if (current) setError(message(failure))
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [version])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !etag || !hasPermission('rules.manage')) return
    setError('')
    setNotice('')
    try {
      if (
        !/^(0|[1-9][0-9]{0,2})(\.[0-9]{1,6})?$/.test(rate) ||
        !/[1-9]/.test(rate)
      )
        throw new Error(
          'Hệ số phải dương, tối đa 3 chữ số nguyên và 6 chữ số lẻ.',
        )
      const body = {
        maxAgenciesPerDistrict: catalog(capacity),
        sellingPriceRate: rate,
      }
      setBusy(true)
      const response = await intent.current.send<unknown>(
        '/business-rules',
        { method: 'PATCH', ifMatch: etag, body },
        false,
      )
      const data = record(response.data)
      catalog(data.maxAgenciesPerDistrict)
      decimal(data.sellingPriceRate)
      setEtag(response.etag)
      setCapacity(String(data.maxAgenciesPerDistrict))
      setRate(String(data.sellingPriceRate))
      for (const prefix of ['/business-rules', '/districts', '/products'])
        invalidateCache(prefix)
      setNotice(
        'Đã cập nhật quy định. Không thay đổi giá trong các snapshot chứng từ lịch sử.',
      )
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="page-container">
      <h1 className="page-title">Thay đổi quy định</h1>
      {error && <Alert type="error">{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}
      <form onSubmit={submit} className="card">
        <Input
          label="Số đại lý tối đa trong mỗi quận"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          disabled={!hasPermission('rules.manage') || busy}
        />
        <Input
          label="Hệ số giá bán (sellingPriceRate)"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
          disabled={!hasPermission('rules.manage') || busy}
        />
        {hasPermission('rules.manage') && (
          <Button type="submit" disabled={!etag || busy}>
            Lưu thay đổi quy định
          </Button>
        )}
        <Button
          onClick={() => {
            setError('')
            setEtag(null)
            setVersion((value) => value + 1)
          }}
        >
          Tải lại quy định
        </Button>
      </form>
    </div>
  )
}
