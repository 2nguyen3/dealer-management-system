import { Calculator, MapPin, RefreshCw, Save } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { PageHeader } from '../../components/blocks/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { apiFetch } from '../../lib/api'
import { formatQuantity } from '../../lib/formatters'
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
        'Đã cập nhật quy định. Giá trên các chứng từ đã lập không thay đổi.',
      )
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }
  const canManage = hasPermission('rules.manage')
  const loading = !etag && !error
  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Thay đổi quy định"
        description="Quy định chung áp dụng cho việc tiếp nhận đại lý và tính giá bán."
      />
      {(error || notice) && (
        <div className="space-y-3">
          {error && <Alert type="error">{error}</Alert>}
          {notice && <Alert type="success">{notice}</Alert>}
        </div>
      )}
      <form
        onSubmit={submit}
        className="max-w-3xl overflow-hidden rounded-xl border bg-card shadow-xs"
        aria-busy={loading || undefined}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Quy định đang áp dụng</h2>
            <p className="text-sm text-muted-foreground">
              Thay đổi chỉ ảnh hưởng tới các chứng từ lập sau khi lưu.
            </p>
          </div>
          {!canManage && <Badge variant="neutral">Chỉ xem</Badge>}
        </div>
        <div className="divide-y">
          <RuleRow
            icon={<MapPin className="size-5" />}
            title="Tiếp nhận đại lý"
            description="Giới hạn số đại lý đang hoạt động trong cùng một quận."
          >
            <Input
              id="rule-capacity"
              label="Số đại lý tối đa trong mỗi quận"
              inputMode="numeric"
              className="tabular-nums"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              disabled={!canManage || busy}
              helperText="Áp dụng khi tiếp nhận đại lý mới."
            />
          </RuleRow>
          <RuleRow
            icon={<Calculator className="size-5" />}
            title="Tính giá bán"
            description="Giá bán của mặt hàng được tính từ giá nhập nhân với hệ số."
          >
            <Input
              id="rule-rate"
              label="Hệ số giá bán"
              inputMode="decimal"
              className="tabular-nums"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              disabled={!canManage || busy}
              helperText={
                rate && /^\d+(\.\d+)?$/.test(rate)
                  ? `Giá bán = giá nhập × ${formatQuantity(rate)}. Dùng dấu chấm cho phần thập phân.`
                  : 'Giá bán = giá nhập × hệ số. Dùng dấu chấm cho phần thập phân.'
              }
            />
          </RuleRow>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            icon={<RefreshCw className="size-4" />}
            onClick={() => {
              setError('')
              setEtag(null)
              setVersion((value) => value + 1)
            }}
          >
            Tải lại quy định
          </Button>
          {canManage && (
            <Button
              type="submit"
              disabled={!etag || busy}
              isLoading={busy}
              icon={<Save className="size-4" />}
            >
              Lưu thay đổi quy định
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function RuleRow({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-start">
      <div className="flex gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
