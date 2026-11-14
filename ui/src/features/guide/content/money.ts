import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const moneyGuides: readonly GuideContent[] = [
  {
    path: '/receivables',
    purpose: msg(
      'Công nợ đại lý cho xem dư nợ, dư có, hạn mức còn lại, tuổi nợ và sổ công nợ của từng đại lý.',
    ),
    roles: [msg('Kinh doanh, Kế toán: xem công nợ (quyền tra cứu công nợ).')],
    steps: [
      msg('Tìm đại lý theo mã hoặc tên.'),
      msg(
        'Xem các cột Dư nợ, Hạn mức còn lại và Sử dụng hạn mức để biết đại lý nào sắp chạm hạn mức.',
      ),
      msg(
        'Bấm Chi tiết để xem Số dư hóa đơn: từng phiếu xuất còn nợ, tổng tiền, còn nợ và tình trạng.',
      ),
      msg('Xem Tuổi nợ hóa đơn để biết các khoản nợ lâu ngày.'),
      msg('Bấm Mở sổ công nợ để xem từng lần tăng nợ, giảm nợ theo thời gian.'),
    ],
    rules: [
      msg(
        'Công nợ theo dõi theo từng phiếu xuất; tổng dư nợ là tổng nợ còn lại của các phiếu.',
      ),
      msg(
        'Nợ tăng khi ghi sổ phiếu xuất; giảm khi ghi sổ phiếu thu, phiếu trả hàng hoặc bù trừ dư có.',
      ),
      msg('Tiền thu luôn trả hóa đơn cũ nhất trước.'),
      msg('Hạn mức còn lại bằng hạn mức nợ trừ dư nợ hiện tại.'),
      msg(
        'Ghi sổ lùi ngày có thể phân bổ lại tiền thu giữa các hóa đơn; tổng dư nợ không vì thế mà đổi.',
      ),
    ],
    errors: ['FORBIDDEN', 'NOT_FOUND'],
    related: [
      '/payment-receipts',
      '/stock-issues',
      '/agency-credit',
      '/reports',
    ],
  },
  {
    path: '/payment-receipts',
    purpose: msg(
      'Phiếu thu tiền ghi nhận tiền đại lý trả nợ bằng tiền mặt hoặc chuyển khoản. Trang cũng liệt kê phiếu thu tự động và phiếu thu trực tuyến.',
    ),
    roles: [
      msg(
        'Kế toán: lập phiếu (quyền lập phiếu thu) và ghi sổ (quyền xác nhận thu).',
      ),
      msg('Kinh doanh: xem (quyền tra cứu công nợ).'),
      msg('Quản lý: sửa sai, hủy phiếu thu thủ công.'),
    ],
    flow: [
      { label: msg('Lập phiếu thu nháp'), role: msg('Kế toán') },
      { label: msg('Ghi sổ'), role: msg('Kế toán') },
      { label: msg('Công nợ giảm, trả hóa đơn cũ nhất trước') },
    ],
    steps: [
      msg('Bấm Lập phiếu thu mới.'),
      msg(
        'Chọn Đại lý, Ngày nghiệp vụ, nhập Số tiền (VND nguyên) và chọn Phương thức: Tiền mặt hoặc Chuyển khoản.',
      ),
      msg('Bấm Lưu bản nháp.'),
      msg('Mở Chi tiết, bấm Ghi sổ rồi Xác nhận ghi sổ.'),
      msg('Nháp lập sai: bấm Hủy phiếu, nhập Lý do hủy, rồi lập phiếu mới.'),
      msg('Sai sót sau khi ghi sổ: dùng trang Sửa sai & Hủy chứng từ.'),
    ],
    rules: [
      msg('Số tiền thu không được vượt công nợ của đại lý tại ngày phiếu thu.'),
      msg(
        'Tiền được phân bổ vào hóa đơn cũ nhất trước. Phiếu thu lùi ngày chỉ trả được các hóa đơn có đến ngày đó.',
      ),
      msg(
        'Phiếu thu tự động từ phiếu xuất, phiếu thu trực tuyến và phiếu thu riêng chỉ để xem, không sửa hay hủy.',
      ),
      msg('Đại lý đã ngừng hợp tác vẫn thu nợ được.'),
      msg(
        'Hủy phiếu thu làm công nợ tăng lại; bị từ chối nếu nợ vượt hạn mức hoặc tiền đã được hoàn.',
      ),
    ],
    errors: [
      'PAYMENT_EXCEEDS_DEBT',
      'WHOLE_VND_REQUIRED',
      'RECEIPT_CONFLICT',
      'AUTO_RECEIPT_INDEPENDENT_MUTATION_FORBIDDEN',
      'AGENCY_CONFLICT',
      'LIMIT_CONFLICT',
    ],
    tips: [
      msg(
        'Tiền trả ngay khi nhận hàng không lập ở đây; Kế toán xác minh ở trang Xác nhận trả ngay.',
      ),
    ],
    related: [
      '/receivables',
      '/upfront-payments',
      '/online-payments',
      '/document-corrections',
    ],
  },
  {
    path: '/upfront-payments',
    purpose: msg(
      'Kế toán xác minh tiền đại lý trả ngay khi nhận hàng, cho đúng phiên bản Sẵn sàng của phiếu xuất đang chờ.',
    ),
    roles: [
      msg('Kế toán: Ghi nhận tiền thực nhận (quyền xác nhận khoản trả ngay).'),
      msg('Kế toán: Ghi nhận tiền riêng (quyền xác nhận thu).'),
      msg(
        'Kho: xem để biết phiếu xuất nào đã đủ điều kiện ghi sổ (quyền xác nhận xuất).',
      ),
    ],
    flow: [
      {
        label: msg('Nộp phiếu xuất có khoản trả ngay'),
        role: msg('Kinh doanh'),
      },
      {
        label: msg('Nhận tiền và xác minh tiền thực nhận'),
        role: msg('Kế toán'),
      },
      { label: msg('Ghi sổ phiếu xuất'), role: msg('Kho') },
      {
        label: msg(
          'Hệ thống tự lập phiếu thu, khoản tiền thành Đã thành phiếu thu',
        ),
      },
    ],
    steps: [
      msg('Bấm Ghi nhận tiền thực nhận.'),
      msg(
        'Ở ô Chọn phiếu xuất chờ ghi sổ, tìm theo số phiếu hoặc đại lý. Chỉ phiếu có phiên bản Sẵn sàng mới hiện ra.',
      ),
      msg(
        'Nhập Số tiền (VND nguyên) đúng bằng khoản trả ngay trên phiếu xuất.',
      ),
      msg(
        'Chọn Phương thức Tiền mặt hoặc Chuyển khoản, nhập Thời điểm thực nhận (giờ Việt Nam) và Tham chiếu bằng chứng.',
      ),
      msg(
        'Bấm Xác minh tiền thực nhận. Khoản tiền hiện trạng thái Chờ phiếu xuất ghi sổ.',
      ),
      msg(
        'Báo Kho ghi sổ phiếu xuất. Sau đó khoản tiền chuyển Đã thành phiếu thu và có liên kết phiếu thu.',
      ),
      msg(
        'Nếu tiền không dùng cho phiếu này nữa: mở Chi tiết, bấm Ghi nhận tiền riêng, nhập lý do và xác nhận.',
      ),
    ],
    rules: [
      msg(
        'Xác minh gắn với một phiên bản cụ thể của phiếu xuất. Mỗi phiên bản chỉ xác minh một lần, số tiền phải đúng bằng khoản trả ngay.',
      ),
      msg(
        'Sửa rồi nộp lại phiếu xuất tạo phiên bản mới; phiên bản mới phải được xác minh lại. Nộp lại không phải là xác nhận tiền.',
      ),
      msg(
        'Đã xác minh thì Kinh doanh không Thay nội dung chờ xuất được. Kế toán phải Ghi nhận tiền riêng trước.',
      ),
      msg(
        'Ghi nhận tiền riêng lập phiếu thu riêng: trả các nợ cũ nhất của đại lý, phần thừa thành dư có. Trạng thái phiếu xuất không đổi.',
      ),
      msg(
        'Xác minh chưa làm giảm công nợ; công nợ chỉ đổi khi phiếu xuất được ghi sổ.',
      ),
      msg(
        'Trả ngay chỉ nhận Tiền mặt hoặc Chuyển khoản; ngày nhận tiền không trước ngày tiếp nhận đại lý.',
      ),
    ],
    errors: [
      'UPFRONT_CONFLICT',
      'UPFRONT_REQUIRED',
      'UPFRONT_REVISION_MISMATCH',
      'VERIFIED_CASH_IMMUTABLE',
      'WHOLE_VND_REQUIRED',
      'AGENCY_CONFLICT',
    ],
    tips: [
      msg(
        'Chỉ nút Xác minh tiền thực nhận trên trang này mới mở khóa Ghi sổ cho phiếu xuất có trả ngay.',
      ),
      msg(
        'Cần đổi nội dung phiếu đã xác minh tiền: Ghi nhận tiền riêng → Kinh doanh Thay nội dung chờ xuất và Nộp phiếu → nếu còn trả ngay, xác minh lại cho phiên bản mới.',
      ),
      msg(
        'Tiền đã ghi nhận riêng đã giảm công nợ; khi nộp lại, đừng nhập lại cùng khoản đó làm trả ngay để tránh ghi nhận hai lần.',
      ),
    ],
    related: [
      '/stock-issues',
      '/payment-receipts',
      '/receivables',
      '/dashboard',
    ],
  },
  {
    path: '/credit-applications',
    purpose: msg(
      'Bù trừ dư có dùng dư có của đại lý để trả công nợ. Không phát sinh tiền mặt.',
    ),
    roles: [
      msg('Kế toán: lập và ghi sổ (quyền bù trừ dư có).'),
      msg('Kinh doanh: xem (quyền tra cứu công nợ).'),
    ],
    flow: [
      { label: msg('Kiểm tra dư có khả dụng'), role: msg('Kế toán') },
      { label: msg('Lập phiếu bù trừ nháp'), role: msg('Kế toán') },
      { label: msg('Ghi sổ'), role: msg('Kế toán') },
      { label: msg('Dư có giảm, công nợ giảm cùng số tiền') },
    ],
    steps: [
      msg('Kiểm tra dư có khả dụng của đại lý ở trang Hạn mức & Dư có.'),
      msg('Bấm Lập phiếu bù trừ.'),
      msg('Chọn Đại lý, Ngày nghiệp vụ và nhập Số tiền (VND nguyên).'),
      msg('Bấm Lưu bản nháp.'),
      msg('Mở Chi tiết, bấm Ghi sổ rồi Xác nhận ghi sổ.'),
      msg('Sai sót sau khi ghi sổ: dùng trang Sửa sai & Hủy chứng từ.'),
    ],
    rules: [
      msg(
        'Dư có được lấy từ khoản cũ nhất trước, bỏ qua phần đang giữ chỗ cho hoàn tiền.',
      ),
      msg(
        'Tiền bù trừ trả hóa đơn cũ nhất trước và không vượt công nợ tại ngày bù trừ.',
      ),
      msg('Tổng tiền thật không đổi; chỉ chuyển từ dư có sang trả nợ.'),
    ],
    errors: [
      'INSUFFICIENT_CREDIT',
      'PAYMENT_EXCEEDS_DEBT',
      'CREDIT_RESERVED',
      'WHOLE_VND_REQUIRED',
    ],
    related: ['/agency-credit', '/receivables', '/document-corrections'],
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
        'Chọn Đại lý thanh toán, nhập Số tiền thanh toán (VND nguyên), bấm Tiếp tục.',
      ),
      msg('Kiểm tra thông tin rồi bấm Khởi tạo thanh toán.'),
      msg(
        'Gửi mã QR hoặc bấm Mở trang thanh toán để đại lý trả tiền trên VNPAY.',
      ),
      msg('Bấm Kiểm tra trạng thái để xem kết quả mới nhất.'),
      msg(
        'Nếu lâu vẫn chưa có kết quả, mở Chi tiết và bấm Đối soát giao dịch hiện tại.',
      ),
      msg(
        'Nếu khởi tạo bị gián đoạn, bấm Tiếp tục khởi tạo thanh toán thay vì tạo giao dịch mới.',
      ),
    ],
    rules: [
      msg(
        'Số tiền không được vượt công nợ hiện tại của đại lý lúc khởi tạo. Khởi tạo chưa làm giảm công nợ.',
      ),
      msg(
        'Trang quay lại từ VNPAY không phải bằng chứng thanh toán. Chỉ xác nhận hợp lệ từ cổng hoặc đối soát Thành công mới lập phiếu thu.',
      ),
      msg(
        'Giao dịch quá hạn không tự chuyển Hết hạn; trạng thái chỉ đổi khi cổng báo về hoặc khi đối soát.',
      ),
      msg(
        'Thành công là trạng thái cuối. Phiếu thu trực tuyến không sửa hay hủy được.',
      ),
      msg(
        'Nếu tiền về vượt nợ còn lại (ví dụ hai giao dịch cùng lúc), phần thừa thành dư có cho đại lý.',
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
    related: ['/payment-receipts', '/receivables', '/refunds'],
  },
  {
    path: '/refunds',
    purpose: msg(
      'Hoàn tiền đại lý trả lại tiền dư có cho đại lý, bằng tiền mặt, chuyển khoản hoặc hoàn trực tuyến qua VNPAY.',
    ),
    roles: [
      msg('Kế toán: lập yêu cầu (quyền lập hoàn tiền).'),
      msg(
        'Kế toán: giữ chỗ, xác nhận đã chi và đối soát (quyền xác nhận hoàn tiền).',
      ),
      msg(
        'Quản lý: hủy yêu cầu chưa chi (cần cả quyền hủy chứng từ và xác nhận hoàn tiền).',
      ),
    ],
    flow: [
      { label: msg('Lập yêu cầu hoàn tiền'), role: msg('Kế toán') },
      { label: msg('Giữ chỗ quỹ'), role: msg('Kế toán') },
      {
        label: msg('Chi tiền: xác nhận đã chi hoặc hoàn trực tuyến'),
        role: msg('Kế toán'),
      },
      { label: msg('Hoàn tất, dư có giảm') },
    ],
    steps: [
      msg('Bấm Lập yêu cầu hoàn tiền.'),
      msg(
        'Chọn Phiếu thu nguồn (đã ghi sổ), Ngày nghiệp vụ, Số tiền, Phương thức và nhập Lý do hoàn tiền. Bấm Lưu bản nháp.',
      ),
      msg(
        'Mở Chi tiết, bấm Giữ chỗ quỹ rồi Xác nhận giữ chỗ. Số tiền được giữ, không dùng cho việc khác.',
      ),
      msg(
        'Tiền mặt hoặc chuyển khoản: chi tiền cho đại lý, bấm Xác nhận đã chi tiền, nhập Thời điểm đã chi và Tham chiếu bằng chứng chi tiền.',
      ),
      msg(
        'Trực tuyến: bấm Yêu cầu hoàn trực tuyến rồi Gửi yêu cầu hoàn. Nếu kết quả Chưa rõ hoặc Chờ xử lý, bấm Đối soát lần thử hiện tại.',
      ),
      msg(
        'Yêu cầu chưa chi có thể hủy: bấm Hủy phiếu và nhập Lý do hủy; phần giữ chỗ được trả lại.',
      ),
    ],
    rules: [
      msg(
        'Chỉ hoàn từ dư có còn khả dụng của chính phiếu thu nguồn; tổng đã hoàn và đang giữ không vượt số tiền phiếu thu đó.',
      ),
      msg('Ngày hoàn không được trước ngày phiếu thu nguồn.'),
      msg(
        'Hoàn trực tuyến chỉ dùng khi phiếu thu nguồn là giao dịch trực tuyến thành công.',
      ),
      msg('Yêu cầu đã chi tiền là bằng chứng cố định: không sửa, không hủy.'),
      msg(
        'Đang chờ kết quả từ cổng thì không hủy và không tạo lần mới; hãy đối soát.',
      ),
    ],
    errors: [
      'INSUFFICIENT_CREDIT',
      'REFUND_SOURCE_CONFLICT',
      'REFUND_EXCEEDS_ORIGINAL_RECEIPT',
      'PAID_REFUND_IMMUTABLE',
      'REFUND_OUTCOME_UNKNOWN',
      'CREDIT_RESERVED',
    ],
    tips: [
      msg(
        'Nếu lần hoàn trực tuyến Thất bại, phần giữ chỗ được trả lại dư có khả dụng của đại lý.',
      ),
    ],
    related: ['/agency-credit', '/payment-receipts', '/online-payments'],
  },
]
