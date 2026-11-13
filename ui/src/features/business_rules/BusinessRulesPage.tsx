import { Calculator, MapPin, Percent, RefreshCw, Save } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { KpiCard } from '../../components/blocks/KpiCard'
import { PageHeader } from '../../components/blocks/PageHeader'
import { CountUp, Stagger, StaggerItem } from '../../components/motion/Motion'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { apiFetch } from '../../lib/api'
import { formatQuantity, formatVND } from '../../lib/formatters'
import { invalidateCache } from '../../lib/cache'
import { useAuth } from '../authentication/useAuth'
import { InfoHint } from '../master_data/listParts'
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
  /** Last server values: the tiles show what applies, not unsaved edits. */
  const [saved, setSaved] = useState({ capacity: '', rate: '' })
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
        catalog(data.maxAgenciesPerWard)
        decimal(data.sellingPriceRate)
        if (current) {
          setCapacity(String(data.maxAgenciesPerWard))
          setRate(String(data.sellingPriceRate))
          setSaved({
            capacity: String(data.maxAgenciesPerWard),
            rate: String(data.sellingPriceRate),
          })
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
        maxAgenciesPerWard: catalog(capacity),
        sellingPriceRate: rate,
      }
      setBusy(true)
      const response = await intent.current.send<unknown>(
        '/business-rules',
        { method: 'PATCH', ifMatch: etag, body },
        false,
      )
      const data = record(response.data)
      catalog(data.maxAgenciesPerWard)
      decimal(data.sellingPriceRate)
      setEtag(response.etag)
      setCapacity(String(data.maxAgenciesPerWard))
      setRate(String(data.sellingPriceRate))
      setSaved({
        capacity: String(data.maxAgenciesPerWard),
        rate: String(data.sellingPriceRate),
      })
      for (const prefix of ['/business-rules', '/products'])
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
  const rateValue = /^\d+(\.\d+)?$/.test(saved.rate) ? Number(saved.rate) : null
  const capacityValue = /^\d+$/.test(saved.capacity)
    ? Number(saved.capacity)
    : null
  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Thay đổi quy định"
        actions={
          <InfoHint label="Giới thiệu quy định">
            Quy định chung cho việc tiếp nhận đại lý và tính giá bán. Thay đổi
            chỉ ảnh hưởng tới các chứng từ lập sau khi lưu.
          </InfoHint>
        }
      />
      {(error || notice) && (
        <div className="space-y-3">
          {error && <Alert type="error">{error}</Alert>}
          {notice && <Alert type="success">{notice}</Alert>}
        </div>
      )}
      {etag && (
        <Stagger
          className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3"
          aria-label="Quy định đang áp dụng"
          role="list"
        >
          <StaggerItem role="listitem">
            <KpiCard
              className="h-full"
              label="Đại lý tối đa / phường/xã"
              icon={<MapPin />}
              value={
                capacityValue === null ? '—' : <CountUp value={capacityValue} />
              }
            />
          </StaggerItem>
          <StaggerItem role="listitem">
            <KpiCard
              className="h-full"
              label="Hệ số giá bán"
              icon={<Calculator />}
              value={
                rateValue === null ? '—' : `×${formatQuantity(saved.rate)}`
              }
              delta={
                rateValue === null
                  ? undefined
                  : { ratio: rateValue - 1, label: 'so với giá nhập' }
              }
            />
          </StaggerItem>
          <StaggerItem role="listitem" className="col-span-2 sm:col-span-1">
            <KpiCard
              className="h-full"
              label="Ví dụ giá nhập 100.000 ₫"
              icon={<Percent />}
              value={
                rateValue === null
                  ? '—'
                  : formatVND(String(Math.round(100000 * rateValue)))
              }
              hint="Giá bán tương ứng"
            />
          </StaggerItem>
        </Stagger>
      )}
      <form
        onSubmit={submit}
        className="max-w-3xl overflow-hidden rounded-xl border bg-card shadow-xs"
        aria-busy={loading || undefined}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="text-base font-semibold">Quy định đang áp dụng</h2>
          {!canManage && <Badge variant="neutral">Chỉ xem</Badge>}
        </div>
        <div className="divide-y">
          <RuleRow
            icon={<MapPin className="size-5" />}
            title="Tiếp nhận đại lý"
            hint="Giới hạn số đại lý đang hoạt động trong cùng một phường/xã."
          >
            <Input
              id="rule-capacity"
              label="Số đại lý tối đa mỗi phường/xã"
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
            hint="Giá bán của mặt hàng được tính từ giá nhập nhân với hệ số."
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
  hint,
  children,
}: {
  icon: ReactNode
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-start">
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-chart-2/15 text-primary ring-1 ring-primary/10"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <InfoHint label={`Giải thích ${title}`}>{hint}</InfoHint>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
