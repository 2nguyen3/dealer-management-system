import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/shadcn/tabs'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { Table } from '../../components/ui/Table'
import { apiFetch } from '../../lib/api'
import { formatDateTime, formatVND } from '../../lib/formatters'
import { t } from '../../lib/i18n/core'
import { useAuth } from '../authentication/useAuth'
import {
  documentLink,
  exact,
  object,
  parsePage,
  validId,
} from '../document_history/documentContracts'

function parseHistory(value: unknown) {
  const { currentDebt } = object(value)
  const money = (v: unknown): v is string =>
    typeof v === 'string' && exact.signedMoney.test(v)
  if (!money(currentDebt)) throw new Error(t('Phản hồi máy chủ không hợp lệ.'))
  const page = parsePage(value, (item) => {
    const {
      documentId,
      documentCode,
      occurredAt,
      event,
      kind,
      replacesCode,
      change,
      balanceAfter,
    } = object(item)
    if (
      !validId(documentId) ||
      typeof documentCode !== 'string' ||
      !exact.code.test(documentCode) ||
      typeof occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(occurredAt)) ||
      (kind !== 'STOCK_ISSUE' && kind !== 'PAYMENT_RECEIPT') ||
      (event !== 'POSTED' && event !== 'REVERSED') ||
      !(replacesCode === null || typeof replacesCode === 'string') ||
      !money(change) ||
      !money(balanceAfter)
    )
      throw new Error(t('Phản hồi máy chủ không hợp lệ.'))
    return {
      documentId,
      documentCode,
      occurredAt,
      kind: kind as 'STOCK_ISSUE' | 'PAYMENT_RECEIPT',
      event,
      replacesCode,
      change,
      balanceAfter,
    }
  })
  return { currentDebt, ...page }
}

function DebtHistory({ agencyId }: { agencyId: string }) {
  const [cursors, setCursors] = useState<string[]>([])
  const [attempt, retry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: ReturnType<typeof parseHistory>
    error?: string
  } | null>(null)
  const cursor = cursors.at(-1)
  const path = `/agencies/${agencyId}/debt-history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  const key = `${path}:${attempt}`
  useEffect(() => {
    const controller = new AbortController()
    apiFetch<unknown>(path, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setResult({ key, data: parseHistory(data) })
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              err instanceof Error
                ? err.message
                : t('Không tải được danh sách.'),
          })
      })
    return () => controller.abort()
  }, [key, path])
  const data = result?.key === key ? result.data : undefined
  const error = result?.key === key ? result.error : undefined
  const next = data?.pagination.nextCursor
  return (
    <div className="space-y-3">
      {error ? (
        <Alert type="error">
          {error}{' '}
          <Button
            size="sm"
            variant="outline"
            onClick={() => retry((n) => n + 1)}
          >
            {t('Thử lại')}
          </Button>
        </Alert>
      ) : !data ? (
        <p role="status">{t('Đang tải giao dịch...')}</p>
      ) : (
        <>
          <p className="text-sm">
            {t('Nợ hiện tại')}:{' '}
            <strong className="tabular-nums">
              {formatVND(data.currentDebt)}
            </strong>
          </p>
          {!data.items.length ? (
            <p>{t('Không có dữ liệu.')}</p>
          ) : (
            <Table caption={t('Lịch sử công nợ & thanh toán')}>
              <thead>
                <tr>
                  {[
                    t('Thời điểm'),
                    t('Nghiệp vụ'),
                    t('Chứng từ'),
                    t('Phát sinh nợ'),
                    t('Thanh toán'),
                    t('Dư nợ sau giao dịch'),
                  ].map((label, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={i < 3 ? 'text-start' : 'text-end'}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const issue = row.kind === 'STOCK_ISSUE'
                  const amount = `${!row.change.startsWith('-') && row.change !== '0' ? '+' : ''}${formatVND(row.change)}`
                  return (
                    <tr key={`${row.documentId}:${row.event}`}>
                      <td>
                        <time dateTime={row.occurredAt}>
                          {formatDateTime(row.occurredAt)}
                        </time>
                      </td>
                      <td>
                        {issue ? t('Phiếu xuất') : t('Thu tiền')}
                        {row.event === 'REVERSED' && (
                          <div className="text-xs text-muted-foreground">
                            {t('Đã hủy')}
                          </div>
                        )}
                      </td>
                      <td>
                        <Link
                          className="font-mono text-primary underline"
                          to={documentLink(row.kind, row.documentId)}
                        >
                          {row.documentCode}
                        </Link>
                        {row.replacesCode && (
                          <div className="text-xs text-muted-foreground">
                            {t('Thay thế cho')} {row.replacesCode}
                          </div>
                        )}
                      </td>
                      <td className="text-end whitespace-nowrap tabular-nums">
                        {issue ? amount : '—'}
                      </td>
                      <td className="text-end whitespace-nowrap tabular-nums">
                        {issue ? '—' : amount}
                      </td>
                      <td className="text-end font-semibold whitespace-nowrap tabular-nums">
                        {formatVND(row.balanceAfter)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </>
      )}
      {(cursor || next) && (
        <Pagination
          hasPrevious={!!cursor}
          hasNext={!!next}
          onPrevious={() => setCursors((prev) => prev.slice(0, -1))}
          onNext={() => next && setCursors((prev) => [...prev, next])}
        />
      )}
    </div>
  )
}

export function AgencyProfileTabs({
  agencyId,
  children,
}: {
  agencyId: string
  children: ReactNode
}) {
  const { hasPermission } = useAuth()
  if (
    !hasPermission('debt.read') ||
    !(hasPermission('agency.read') || hasPermission('agency.manage'))
  )
    return children
  return (
    <Tabs defaultValue="profile">
      <TabsList className="max-w-full">
        <TabsTrigger value="profile" className="whitespace-normal">
          {t('Thông tin chung')}
        </TabsTrigger>
        <TabsTrigger value="history" className="whitespace-normal">
          {t('Lịch sử công nợ & thanh toán')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profile">{children}</TabsContent>
      <TabsContent value="history" className="min-w-0">
        <DebtHistory agencyId={agencyId} />
      </TabsContent>
    </Tabs>
  )
}
