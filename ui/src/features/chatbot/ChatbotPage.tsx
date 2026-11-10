import { Bot, Lock, SendHorizontal, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/blocks/PageHeader'
import { Badge } from '@/components/ui/Badge'

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
        description="Chỉ cung cấp câu trả lời từ dịch vụ đã được triển khai và phân quyền."
        className="mb-0"
      />
      <section
        className="mx-auto flex max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-xs"
        aria-label="Trợ lý Agentra – Chưa khả dụng"
        aria-describedby="chatbot-unavailable"
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Bot className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Trợ lý Agentra</h2>
              <p className="text-xs text-muted-foreground">
                Hỏi đáp dữ liệu nghiệp vụ theo quyền của bạn
              </p>
            </div>
          </div>
          <Badge variant="neutral" id="chatbot-unavailable">
            Chưa khả dụng
          </Badge>
        </header>
        <div
          className="flex min-h-72 flex-col gap-4 bg-muted/30 px-4 py-6"
          role="group"
          aria-label="Hội thoại"
        >
          <div className="flex items-end gap-2">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <Bot className="size-4" />
            </span>
            <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm shadow-xs">
              <p className="font-medium">
                Dịch vụ chatbot chưa được triển khai. Tính năng hỏi đáp đang
                tắt.
              </p>
              <p className="text-muted-foreground">
                Không có câu hỏi nào được gửi, không tải trước dữ liệu đại lý
                hoặc mặt hàng và không tạo câu trả lời thay thế từ trình duyệt.
              </p>
            </div>
          </div>
          <div className="mx-auto flex max-w-md items-start gap-2 rounded-lg border border-dashed bg-card/70 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck
              className="mt-0.5 size-3.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>
              Tra cứu dữ liệu tại các màn hình nghiệp vụ được cấp quyền. Việc mở
              trợ lý không cấp thêm quyền truy cập dữ liệu.
            </p>
          </div>
        </div>
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
