import {
  ArrowUpRight,
  EyeOff,
  MoreHorizontal,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  X,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { describeError } from '@/lib/errors'
import {
  formatDate,
  formatDateTime,
  formatQuantity,
  formatVND,
} from '@/lib/formatters'
import { t } from '@/lib/i18n/core'
import type { FunctionCode } from '@/lib/types'
import { cn } from '@/lib/utils'
import { allowsNavigation, routePermissions } from '../../app/navigation'
import { columnLabels } from '../reports/display'
import {
  INVENTORY_PERMISSIONS,
  MAX_TURN_LENGTH,
  SOURCE_ROUTES,
  type ChatbotCandidate,
  type ChatbotCell,
  type ChatbotColumnType,
  type ChatbotMissing,
  type ChatbotRefusal,
  type ChatbotTable,
} from './contract'
import { PetMascot } from './PetMascot'
import type { ChatItem } from './useAssistantChat'

/** Labels of contract columns that the reports page does not show. */
const extraLabels: Record<string, string> = {
  wardName: t('Phường/xã'),
  debt: t('Dư nợ hiện tại'),
  stock: t('Tồn kho hiện tại'),
}

const missingLabels: Record<ChatbotMissing, string> = {
  metric: t('Loại tra cứu'),
  period: t('Khoảng thời gian'),
  agency: t('Đại lý'),
  product: t('Mặt hàng'),
}

function refusalText(reason: ChatbotRefusal): string {
  if (reason === 'UNSUPPORTED_QUERY')
    return describeError('UNSUPPORTED_QUERY')?.hint ?? reason
  if (reason === 'FORBIDDEN_METRIC')
    return t('Bạn chưa được cấp quyền xem loại số liệu này.')
  return t('Không tìm thấy đại lý hoặc mặt hàng phù hợp.')
}

function formatCell(type: ChatbotColumnType, value: ChatbotCell): string {
  if (value === null || value === '') return '—'
  const raw = String(value)
  switch (type) {
    case 'money':
      return formatVND(raw)
    case 'quantity':
    case 'integer':
      return formatQuantity(raw)
    case 'rate':
      return `${formatQuantity(raw)} %`
    default:
      return raw
  }
}

/** Last day of a half-open [fromDate, toDate) period. */
function inclusiveEnd(toDate: string): string {
  const date = new Date(`${toDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function ResultTable({
  table,
  hasPermission,
}: {
  table: ChatbotTable
  hasPermission: (code: FunctionCode) => boolean
}) {
  const period = table.understood.period
  const route = SOURCE_ROUTES[table.source.operationId]
  const canOpen = allowsNavigation(hasPermission, routePermissions[route])
  return (
    <figure className="mt-2 overflow-hidden rounded-lg border bg-background">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
        <span className="font-medium text-foreground">{table.title}</span>
        <span className="text-muted-foreground">
          {period
            ? `${formatDate(period.fromDate)} – ${formatDate(inclusiveEnd(period.toDate))}`
            : t('Số dư hiện tại')}
        </span>
      </figcaption>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-background">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-2.5 py-1.5 font-medium whitespace-nowrap text-muted-foreground',
                    column.type === 'code' || column.type === 'text'
                      ? 'text-start'
                      : 'text-end',
                  )}
                >
                  {columnLabels[column.key] ??
                    extraLabels[column.key] ??
                    column.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.columns.length}
                  className="px-2.5 py-3 text-center text-muted-foreground"
                >
                  {t('Không có dữ liệu phù hợp.')}
                </td>
              </tr>
            ) : (
              table.rows.map((row, index) => (
                <tr key={index} className="border-t">
                  {table.columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-2.5 py-1.5',
                        column.type === 'code' || column.type === 'text'
                          ? 'text-start'
                          : 'text-end whitespace-nowrap',
                        column.type === 'code' && 'font-mono text-[11px]',
                      )}
                    >
                      {formatCell(column.type, row[column.key] ?? null)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>
          {t('{shown}/{total} dòng · cập nhật {time}', {
            shown: table.rows.length,
            total: table.totalRows,
            time: formatDateTime(table.asOf),
          })}
        </span>
        {canOpen && (
          <Link
            to={route}
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
          >
            {t('Mở dữ liệu nguồn')}
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </figure>
  )
}

function Candidates({
  candidates,
  chosen,
  disabled,
  onChoose,
}: {
  candidates: ChatbotCandidate[]
  chosen?: string
  disabled: boolean
  onChoose: (candidate: ChatbotCandidate) => void
}) {
  return (
    <ul className="mt-2 grid gap-1.5" aria-label={t('Chọn đúng mã')}>
      {candidates.map((candidate) => (
        <li key={candidate.code}>
          <button
            type="button"
            disabled={disabled || chosen !== undefined}
            aria-pressed={chosen === candidate.code}
            onClick={() => onChoose(candidate)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-start text-xs transition-colors',
              'hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-60',
              chosen === candidate.code &&
                'border-primary bg-primary/10 opacity-100 disabled:opacity-100',
            )}
          >
            <span className="font-mono text-[11px] font-semibold text-primary">
              {candidate.code}
            </span>
            <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
            {candidate.detail && (
              <span className="shrink-0 text-muted-foreground">
                {candidate.detail}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Bubble({
  from,
  children,
  tone = 'default',
}: {
  from: 'user' | 'assistant'
  children: ReactNode
  tone?: 'default' | 'warning'
}) {
  const reduce = useReducedMotion()
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      className={cn('flex', from === 'user' ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          from === 'user'
            ? 'rounded-ee-sm bg-primary text-primary-foreground'
            : 'w-full rounded-es-sm border bg-card shadow-xs',
          tone === 'warning' &&
            'border-amber-500/40 bg-amber-50 dark:bg-amber-950/30',
        )}
      >
        {children}
      </div>
    </motion.li>
  )
}

function TypingDots() {
  const reduce = useReducedMotion()
  return (
    <li className="flex justify-start" aria-label={t('Trợ lý đang trả lời')}>
      <div className="flex items-center gap-1 rounded-2xl rounded-es-sm border bg-card px-3 py-2.5 shadow-xs">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="size-1.5 rounded-full bg-muted-foreground/60"
            animate={reduce ? undefined : { y: [0, -3, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: index * 0.15,
            }}
          />
        ))}
      </div>
    </li>
  )
}

export interface AssistantPanelProps {
  id: string
  items: readonly ChatItem[]
  pending: boolean
  firstName: string
  hasPermission: (code: FunctionCode) => boolean
  onSend: (text: string) => void
  onChoose: (itemId: number, candidate: ChatbotCandidate) => void
  onReset: () => void
  onHide: () => void
  onClose: () => void
  style?: CSSProperties
  className?: string
}

/** The assistant's conversation window, anchored to the companion. */
export function AssistantPanel({
  id,
  items,
  pending,
  firstName,
  hasPermission,
  onSend,
  onChoose,
  onReset,
  onHide,
  onClose,
  style,
  className,
}: AssistantPanelProps) {
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLOListElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  useEffect(() => {
    const node = log.current
    if (node) node.scrollTop = node.scrollHeight
  }, [items, pending])

  const suggestions = [
    hasPermission('debt.read') && t('Đại lý nào đang nợ nhiều nhất?'),
    INVENTORY_PERMISSIONS.some(hasPermission) &&
      t('Mặt hàng nào sắp hết hàng?'),
    hasPermission('sales.read') &&
      t('Top 5 đại lý có doanh số cao nhất tháng này'),
  ].filter((value): value is string => Boolean(value))

  const submit = (text = draft) => {
    if (!text.trim() || pending) return
    onSend(text)
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <section
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      style={style}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <header className="flex items-center gap-2.5 border-b bg-gradient-to-b from-primary/10 to-transparent px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-primary/15">
          <PetMascot mood={pending ? 'think' : 'idle'} size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-sm font-semibold">
            {t('Trợ lý Agentra')}
          </h2>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" aria-hidden="true" />
            {t('Chỉ tra cứu, theo quyền của bạn')}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label={t('Tùy chọn trợ lý')}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[70]">
            <DropdownMenuItem onSelect={onReset} disabled={items.length === 0}>
              <RotateCcw className="size-4" />
              {t('Cuộc trò chuyện mới')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onHide}>
              <EyeOff className="size-4" />
              {t('Ẩn trợ lý')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Đóng')}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-4" />
        </button>
      </header>

      <ol
        ref={log}
        role="log"
        aria-live="polite"
        aria-label={t('Hội thoại')}
        className="bg-dots flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/20 px-3 py-4"
      >
        <Bubble from="assistant">
          <p>
            {t(
              'Chào {name}! Mình tra cứu công nợ, tồn kho và doanh số theo đúng quyền của bạn. Bạn muốn xem gì?',
              { name: firstName },
            )}
          </p>
          {items.length === 0 && suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={pending}
                  onClick={() => submit(text)}
                  className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </Bubble>
        {items.map((item) => {
          if (item.kind === 'user')
            return (
              <Bubble key={item.id} from="user">
                <p className="break-words whitespace-pre-wrap">{item.text}</p>
              </Bubble>
            )
          if (item.kind === 'error')
            return (
              <Bubble key={item.id} from="assistant" tone="warning">
                <p role="alert">{item.message}</p>
              </Bubble>
            )
          const { reply } = item
          return (
            <Bubble
              key={item.id}
              from="assistant"
              tone={reply.status === 'REFUSED' ? 'warning' : 'default'}
            >
              <p className="whitespace-pre-wrap">{reply.answer}</p>
              {reply.status === 'ANSWERED' &&
                reply.tables.map((table, index) => (
                  <ResultTable
                    key={index}
                    table={table}
                    hasPermission={hasPermission}
                  />
                ))}
              {reply.status === 'NEEDS_SELECTION' && (
                <>
                  <Candidates
                    candidates={reply.candidates}
                    chosen={item.chosen}
                    disabled={pending}
                    onChoose={(candidate) => onChoose(item.id, candidate)}
                  />
                  {reply.totalMatches > reply.candidates.length && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {t(
                        'Có {total} kết quả; nêu thêm mã hoặc phường/xã để thu hẹp.',
                        { total: reply.totalMatches },
                      )}
                    </p>
                  )}
                </>
              )}
              {reply.status === 'NEEDS_INFO' && (
                <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {t('Cần thêm:')}
                  {reply.missing.map((key) => (
                    <span
                      key={key}
                      className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                    >
                      {missingLabels[key]}
                    </span>
                  ))}
                </p>
              )}
              {reply.status === 'REFUSED' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {refusalText(reply.reason)}
                </p>
              )}
            </Bubble>
          )
        })}
        {pending && <TypingDots />}
      </ol>

      <form
        className="border-t bg-background p-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border bg-background px-2.5 py-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
          <label htmlFor={`${id}-input`} className="sr-only">
            {t('Câu hỏi cho trợ lý')}
          </label>
          <textarea
            id={`${id}-input`}
            ref={input}
            rows={1}
            value={draft}
            maxLength={MAX_TURN_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('Hỏi về công nợ, tồn kho, doanh số…')}
            className="field-sizing-content max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label={t('Gửi câu hỏi')}
            className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40"
          >
            <SendHorizontal className="size-4 rtl:-scale-x-100" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] leading-snug text-muted-foreground">
          {t(
            'Trợ lý không sửa dữ liệu. Số liệu trong bảng lấy từ báo cáo của hệ thống.',
          )}
        </p>
      </form>
    </section>
  )
}
