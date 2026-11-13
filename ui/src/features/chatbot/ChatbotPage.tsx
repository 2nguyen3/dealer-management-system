import { Bot, Lock, SendHorizontal, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { PageHeader } from '@/components/blocks/PageHeader'
import { Stagger, StaggerItem } from '@/components/motion/Motion'
import { Avatar, AvatarFallback } from '@/components/shadcn/avatar'
import { Badge } from '@/components/ui/Badge'

/** Three softly bouncing dots: the assistant is "waiting" for its service. */
function WaitingDots() {
  const reduce = useReducedMotion()
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="size-1.5 rounded-full bg-muted-foreground/60"
          animate={reduce ? undefined : { y: [0, -3, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: index * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  )
}

/**
 * Assistant page. The chatbot service is not deployed, so this renders the
 * conversation layout with a status notice only: no input control, no
 * requests, no prefetched business data and no fabricated answers.
 */
export function ChatbotPage() {
  return (
    <div className="page-container space-y-6">
      <PageHeader
        eyebrow="Agentra / Assistant"
        title="Trợ lý tra cứu"
        className="mb-0"
      />
      <section
        className="mx-auto flex max-w-3xl animate-in flex-col overflow-hidden rounded-xl border bg-card shadow-xs duration-500 fade-in-0 slide-in-from-bottom-2"
        aria-label="Trợ lý Agentra – Chưa khả dụng"
        aria-describedby="chatbot-unavailable"
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9 ring-2 ring-primary/15">
              <AvatarFallback className="bg-primary/10 text-primary">
                <Bot className="size-5" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Trợ lý Agentra</h2>
              <p className="text-xs text-muted-foreground">
                Hỏi đáp theo quyền của bạn
              </p>
            </div>
          </div>
          <Badge variant="neutral" id="chatbot-unavailable">
            Chưa khả dụng
          </Badge>
        </header>
        <Stagger
          className="bg-dots flex min-h-72 flex-col gap-4 bg-muted/30 px-4 py-6"
          role="group"
          aria-label="Hội thoại"
          step={0.15}
        >
          <StaggerItem className="flex items-end gap-2">
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="size-3.5" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm shadow-xs">
              <p className="font-medium">
                Dịch vụ chatbot chưa được triển khai. Tính năng hỏi đáp đang
                tắt.
              </p>
              <p className="text-xs text-muted-foreground">
                Không gửi câu hỏi, không tải trước dữ liệu và không tự tạo câu
                trả lời.
              </p>
            </div>
          </StaggerItem>
          <StaggerItem className="flex items-end gap-2">
            <span className="size-6 shrink-0" aria-hidden="true" />
            <div className="rounded-2xl rounded-bl-sm border bg-card px-3 py-2.5 shadow-xs">
              <WaitingDots />
            </div>
          </StaggerItem>
          <StaggerItem className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-dashed bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
            <ShieldCheck
              className="size-3.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>Mở trợ lý không cấp thêm quyền truy cập dữ liệu.</p>
          </StaggerItem>
        </Stagger>
        <div
          className="flex items-center gap-2 border-t px-4 py-3"
          aria-hidden="true"
        >
          <div className="flex h-10 flex-1 cursor-not-allowed items-center gap-2 rounded-full border bg-muted/50 px-4 text-sm text-muted-foreground">
            <Lock className="size-3.5" />Ô nhập câu hỏi sẽ mở khi dịch vụ được
            triển khai
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SendHorizontal className="size-4" />
          </span>
        </div>
      </section>
    </div>
  )
}
