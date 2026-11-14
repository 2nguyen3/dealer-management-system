import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const moneyGuides: readonly GuideContent[] = [
  {
    path: '/payment-receipts',
    purpose: msg(
      'Phiếu thu tiền ghi nhận tiền đại lý trả nợ bằng tiền mặt hoặc chuyển khoản. Trang cũng liệt kê phiếu thu trực tuyến do VNPAY tạo.',
    ),
    roles: [
      msg(
        'Kế toán: lập phiếu (quyền lập phiếu thu) và ghi sổ (quyền ghi sổ phiếu thu).',
      ),
      msg('Kinh doanh: xem phiếu thu (quyền tra cứu công nợ).'),
      msg('Quản lý: Hủy hoặc Sửa có lý do phiếu thu đã ghi sổ.'),
    ],
    flow: [
      { label: msg('Lập phiếu thu nháp'), role: msg('Kế toán') },
      { label: msg('Ghi sổ: nợ đại lý giảm'), role: msg('Kế toán') },
    ],
    steps: [
      msg('Bấm Lập phiếu thu mới.'),
      msg(
        'Chọn Đại lý và Ngày nghiệp vụ; xem Nợ hiện tại của đại lý ngay trên form.',
      ),
      msg(
        'Nhập Số tiền (VND nguyên, không vượt nợ hiện tại), chọn Hình thức thu: Tiền mặt hoặc Chuyển khoản (VNPAY), thêm Ghi chú nếu cần.',
      ),
      msg('Bấm Lưu nháp. Phiếu nháp sửa hoặc xóa được tự do.'),
      msg('Mở Chi tiết, bấm Ghi sổ và xác nhận.'),
      msg(
        'Chuyển khoản (VNPAY): bấm Tạo thanh toán & mã QR, gửi mã QR hoặc PDF phiếu báo cho đại lý. Phiếu thu tự lập và ghi sổ khi VNPAY xác nhận tiền về.',
      ),
      msg(
        'Xuất PDF cho khách: mở Chi tiết phiếu thu và bấm Xuất PDF phiếu thu (có số tiền bằng chữ và chỗ ký).',
      ),
      msg(
        'Phát hiện sai sau khi ghi sổ: bấm Hủy hoặc Sửa có lý do và nhập lý do.',
      ),
    ],
    rules: [
      msg(
        'Số tiền thu phải lớn hơn 0 và không vượt nợ hiện tại của đại lý tại lúc ghi sổ.',
      ),
      msg(
        'Ghi sổ làm nợ của đại lý giảm đúng số tiền thu; nợ chỉ là một con số, không phân bổ theo từng phiếu xuất.',
      ),
      msg(
        'Phiếu thu trực tuyến do VNPAY xác nhận là cuối cùng, không hủy hay sửa được.',
      ),
      msg(
        'Hủy phiếu thu làm nợ tăng lại, kể cả khi vượt hạn mức (đây là sửa sai và được ghi nhật ký).',
      ),
      msg('Chỉ hủy hoặc sửa được phiếu có ngày trong tháng hiện tại.'),
    ],
    errors: [
      'PAYMENT_EXCEEDS_DEBT',
      'WHOLE_VND_REQUIRED',
      'AGENCY_TERMINATED',
      'PERIOD_CLOSED',
      'REASON_REQUIRED',
      'STATE_CONFLICT',
    ],
    tips: [
      msg(
        'Vừa ghi sổ phiếu xuất và đại lý trả tiền ngay: dùng nút Ghi sổ & lập phiếu thu ở phiếu xuất để mở sẵn phiếu thu cho đúng đại lý.',
      ),
    ],
    related: [
      '/agencies',
      '/stock-issues',
      '/online-payments',
      '/document-history',
    ],
  },
  {
    path: '/online-payments',
    purpose: msg(
      'Thanh toán trực tuyến cho phép đại lý trả nợ qua VNPAY. Khi cổng xác nhận thành công, hệ thống tự lập phiếu thu trực tuyến.',
    ),
    roles: [
      msg('Kế toán: tạo giao dịch và đối soát (quyền thanh toán trực tuyến).'),
      msg('Kinh doanh: xem giao dịch (quyền tra cứu công nợ).'),
    ],
    flow: [
      { label: msg('Tạo giao dịch thanh toán'), role: msg('Kế toán') },
      {
        label: msg('Gửi mã QR hoặc liên kết cho đại lý'),
        role: msg('Kế toán'),
      },
      { label: msg('Đại lý thanh toán trên VNPAY') },
      { label: msg('VNPAY gửi xác nhận, hệ thống lập phiếu thu') },
      { label: msg('Đối soát nếu kết quả chưa rõ'), role: msg('Kế toán') },
    ],
    steps: [
      msg('Bấm Tạo thanh toán mới.'),
      msg(
        'Chọn Đại lý thanh toán, nhập Số tiền thanh toán (VND nguyên, không vượt nợ hiện tại), bấm Tiếp tục.',
      ),
      msg('Kiểm tra thông tin rồi bấm Khởi tạo thanh toán.'),
      msg(
        'Gửi mã QR hoặc bấm Mở trang thanh toán để đại lý trả tiền trên VNPAY.',
      ),
      msg('Bấm Kiểm tra trạng thái để xem kết quả mới nhất.'),
      msg(
        'Nếu lâu vẫn chưa có kết quả, mở Chi tiết và bấm Đối soát giao dịch hiện tại.',
      ),
    ],
    rules: [
      msg(
        'Số tiền không được vượt nợ hiện tại của đại lý lúc khởi tạo. Khởi tạo chưa làm giảm nợ.',
      ),
      msg(
        'Trang quay lại từ VNPAY không phải bằng chứng thanh toán. Chỉ xác nhận hợp lệ từ cổng hoặc đối soát Thành công mới lập phiếu thu.',
      ),
      msg('Chỉ đối soát được giao dịch đang chờ kết quả.'),
      msg(
        'Thành công là trạng thái cuối. Phiếu thu trực tuyến không sửa hay hủy được.',
      ),
      msg(
        'Nếu tiền về khi nợ đã giảm vì phiếu thu khác, tiền vẫn được ghi nhận và nợ có thể âm (đại lý trả trước).',
      ),
    ],
    errors: [
      'PAYMENT_EXCEEDS_DEBT',
      'VNPAY_AMOUNT_INVALID',
      'PROVIDER_UNAVAILABLE',
      'UNSUPPORTED_PROVIDER',
      'PAYMENT_CONFLICT',
      'INVALID_SIGNATURE',
    ],
    tips: [
      msg(
        'Khi chưa rõ kết quả, đừng tạo giao dịch mới; hãy đối soát giao dịch hiện tại để tránh thu hai lần.',
      ),
    ],
    related: ['/payment-receipts', '/agencies'],
  },
]
