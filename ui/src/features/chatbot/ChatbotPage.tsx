import { Alert } from '../../components/ui/Alert'

export function ChatbotPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">AGENTRA / ASSISTANT</p>
          <h1 className="page-title">Trợ lý tra cứu</h1>
          <p className="page-desc">
            Chỉ cung cấp câu trả lời từ dịch vụ đã được triển khai và phân
            quyền.
          </p>
        </div>
      </div>
      <section className="card" aria-labelledby="chatbot-unavailable">
        <h2 id="chatbot-unavailable">Chưa khả dụng</h2>
        <Alert type="info">
          Dịch vụ chatbot chưa được triển khai. Tính năng hỏi đáp đang tắt.
        </Alert>
        <p>
          Không có câu hỏi nào được gửi, không tải trước dữ liệu đại lý hoặc mặt
          hàng và không tạo câu trả lời thay thế từ trình duyệt.
        </p>
        <p>
          Tra cứu dữ liệu tại các màn hình nghiệp vụ được cấp quyền. Việc mở trợ
          lý không cấp thêm quyền truy cập dữ liệu.
        </p>
      </section>
    </div>
  )
}
