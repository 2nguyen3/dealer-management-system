import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const overviewGuides: readonly GuideContent[] = [
  {
    path: '/',
    purpose: msg(
      'Cổng quản lý là trang đầu tiên sau khi đăng nhập. Tab Yêu thích là bộ chức năng bạn dùng nhiều nhất; tab Chức năng nghiệp vụ gom lối tắt tới mọi khu vực bạn được cấp quyền.',
    ),
    roles: [
      msg('Mọi người dùng đã đăng nhập: chỉ thấy những khu vực mình có quyền.'),
    ],
    steps: [
      msg(
        'Tab Yêu thích: lần đầu có sẵn bộ chức năng mặc định theo quyền của bạn. Bấm Thêm chức năng để thêm, nút mũi tên lên/xuống hoặc kéo tay nắm để đổi thứ tự, nút X để bỏ, Khôi phục mặc định để quay lại bộ ban đầu.',
      ),
      msg(
        'Tab Chức năng nghiệp vụ: xem các khu vực Đại lý & Hàng hóa, Chứng từ, Danh mục & Quy định, Quản trị & Lịch sử; bấm ngôi sao trên thẻ để thêm vào Yêu thích.',
      ),
      msg('Bấm vào một thẻ chức năng để mở trang tương ứng.'),
      msg(
        'Bấm Xem tổng quan để mở Bảng điều khiển, hoặc Mở báo cáo để mở Báo cáo kinh doanh.',
      ),
      msg(
        'Mỗi trang đều có nút Hướng dẫn ở góc trên để xem cách làm và các lỗi thường gặp.',
      ),
      msg(
        'Nếu thấy thông báo chưa có khu vực nghiệp vụ được cấp quyền, liên hệ quản trị viên để được cấp quyền.',
      ),
    ],
    rules: [
      msg(
        'Menu và lối tắt hiển thị theo quyền của nhóm người dùng. Quyền thay đổi có hiệu lực sau khi tải lại trang.',
      ),
      msg(
        'Danh sách Yêu thích lưu riêng cho từng tài khoản trên trình duyệt này. Chức năng đã mất quyền được ẩn và báo số lượng; Trợ lý AI chưa thể thêm vào Yêu thích.',
      ),
    ],
    errors: ['FORBIDDEN', 'INVALID_OR_EXPIRED_TOKEN'],
    tips: [
      msg(
        'Thứ tự nghiệp vụ thường gặp: Phiếu nhập → Phiếu xuất (ghi sổ) → Phiếu thu.',
      ),
      msg(
        'Nháp chưa làm thay đổi tồn kho hay nợ. Chỉ Ghi sổ mới có hiệu lực; chứng từ đã ghi sổ chỉ Hủy hoặc Sửa có lý do.',
      ),
    ],
    related: ['/dashboard', '/reports', '/profile'],
  },
  {
    path: '/dashboard',
    purpose: msg(
      'Bảng điều khiển cho cái nhìn nhanh về doanh số, tiền thu, tổng nợ, các đại lý nợ gần hạn mức và chứng từ nháp theo tháng.',
    ),
    roles: [
      msg(
        'Mỗi khối số liệu chỉ hiện khi bạn có quyền tương ứng: tra cứu đại lý, doanh số, công nợ hoặc lập/ghi sổ chứng từ.',
      ),
      msg('Quản lý: thấy toàn bộ các khối.'),
    ],
    steps: [
      msg('Chọn Tháng ở thanh bộ lọc phía trên.'),
      msg('Thu hẹp số liệu theo Đại lý, Loại đại lý, Phường/xã hoặc Mặt hàng.'),
      msg('Nhấn một đại lý hoặc mặt hàng trên biểu đồ để lọc chéo toàn trang.'),
      msg('Bấm Xóa bộ lọc để quay về số liệu toàn công ty.'),
      msg('Bấm Làm mới để tải số liệu mới nhất.'),
      msg('Mỗi biểu đồ có thể chuyển sang dạng bảng để đọc số chính xác.'),
    ],
    rules: [
      msg(
        'Chỉ tính chứng từ đã ghi sổ. Nháp và chứng từ đã hủy không được tính.',
      ),
      msg('Số liệu tính theo ngày nghiệp vụ của chứng từ.'),
      msg(
        'Tổng nợ là tổng nợ hiện tại của các đại lý; đại lý trả trước có nợ âm.',
      ),
    ],
    errors: ['FORBIDDEN', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'],
    tips: [
      msg(
        'Đại lý nợ gần hạn mức sẽ bị từ chối khi ghi sổ phiếu xuất tiếp theo; nhắc Kế toán lập phiếu thu trước.',
      ),
    ],
    related: ['/reports', '/agencies', '/stock-issues', '/payment-receipts'],
  },
  {
    path: '/reports',
    purpose: msg(
      'Lập các báo cáo kinh doanh theo kỳ: doanh số đại lý, công nợ, tồn kho, doanh số mặt hàng và thu tiền; xuất ra PDF hoặc Excel.',
    ),
    roles: [
      msg(
        'Cần quyền Báo cáo; báo cáo doanh số cần thêm quyền tra cứu doanh số, báo cáo công nợ và thu tiền cần thêm quyền tra cứu công nợ.',
      ),
      msg('Kế toán: mặc định xem được báo cáo doanh số, công nợ, thu tiền.'),
      msg('Quản lý: xem được mọi báo cáo.'),
    ],
    flow: [
      { label: msg('Chọn loại báo cáo'), role: msg('Kế toán') },
      { label: msg('Chọn kỳ và bộ lọc'), role: msg('Kế toán') },
      { label: msg('Bấm Áp dụng để tải số liệu'), role: msg('Kế toán') },
      { label: msg('Xuất PDF hoặc Excel'), role: msg('Kế toán') },
    ],
    steps: [
      msg(
        'Chọn Loại báo cáo: Doanh số đại lý, Công nợ, Tồn kho, Doanh số mặt hàng hoặc Thu tiền.',
      ),
      msg('Chọn tháng hoặc khoảng ngày của kỳ báo cáo.'),
      msg('Thêm bộ lọc nếu cần, ví dụ đại lý hoặc mặt hàng.'),
      msg('Bấm Áp dụng để tải dữ liệu. Bấm Xóa bộ lọc để làm lại từ đầu.'),
      msg(
        'Bấm Xuất báo cáo rồi chọn Xuất PDF hoặc Xuất XLSX. Tệp gồm toàn bộ kết quả đã lọc, không chỉ trang đang xem.',
      ),
    ],
    rules: [
      msg(
        'Doanh số là tổng tiền các phiếu xuất đã ghi sổ trong kỳ; tỷ lệ là doanh số của đại lý chia tổng doanh số tháng.',
      ),
      msg(
        'Công nợ: nợ đầu kỳ + phát sinh (phiếu xuất) − đã trả (phiếu thu) = nợ cuối kỳ. Nợ cuối tháng hiện tại bằng nợ hiện tại của đại lý.',
      ),
      msg(
        'Tồn kho: tồn đầu kỳ + nhập − xuất = tồn cuối kỳ. Tồn cuối kỳ hiện tại bằng tồn của mặt hàng.',
      ),
      msg(
        'Thu tiền được tách theo hình thức: tiền mặt, chuyển khoản, trực tuyến.',
      ),
      msg('Nháp và chứng từ đã hủy không được tính.'),
    ],
    errors: [
      'INVALID_DATE_RANGE',
      'RANGE_ORDER',
      'FORBIDDEN',
      'NOT_ACCEPTABLE',
    ],
    tips: [
      msg(
        'Nếu không thấy một loại báo cáo, nhóm của bạn chưa có quyền đọc tương ứng.',
      ),
    ],
    related: ['/dashboard', '/agencies', '/products'],
  },
  {
    path: '/profile',
    purpose: msg(
      'Hồ sơ cá nhân cho xem thông tin tài khoản, các quyền đã được cấp và chỉnh giao diện theo ý bạn.',
    ),
    roles: [msg('Mọi người dùng đã đăng nhập.')],
    steps: [
      msg(
        'Thẻ Tổng quan: xem thông tin tài khoản, nhóm, số quyền được cấp và lối truy cập nhanh.',
      ),
      msg(
        'Thẻ Quyền hạn: xem chi tiết quyền theo từng nghiệp vụ và mức phủ quyền của bạn.',
      ),
      msg(
        'Thẻ Giao diện: chọn Chủ đề giao diện sáng hoặc tối và Màu chủ đạo. Lựa chọn được lưu trên trình duyệt này.',
      ),
      msg('Bấm Đổi mật khẩu, nhập mật khẩu hiện tại và mật khẩu mới.'),
      msg('Bấm Đăng xuất khi dùng xong, nhất là trên máy dùng chung.'),
    ],
    rules: [
      msg(
        'Quyền do quản trị viên cấp theo nhóm; bạn không tự đổi được quyền của mình.',
      ),
    ],
    errors: ['INVALID_CREDENTIALS', 'VALIDATION_FAILED', 'RATE_LIMIT_EXCEEDED'],
    tips: [
      msg(
        'Thẻ Giao diện có công tắc Hiện gợi ý bước tiếp theo: tắt nếu bạn đã quen quy trình và không cần thông báo ở góc dưới màn hình.',
      ),
      msg(
        'Thẻ Giao diện còn có mục Ngôn ngữ giao diện (24 ngôn ngữ). Chỉ chữ của phần mềm đổi; tên hàng, tên đại lý, phường/xã, ghi chú và mã chứng từ giữ nguyên.',
      ),
    ],
    related: ['/', '/permissions'],
  },
  {
    path: '/chatbot',
    purpose: msg(
      'Trợ lý AI sẽ trả lời câu hỏi tra cứu về tồn kho, công nợ, doanh số theo đúng quyền của bạn. Tính năng này đang ở trạng thái Sắp có.',
    ),
    roles: [
      msg(
        'Mọi người dùng; trợ lý không cấp thêm quyền truy cập dữ liệu ngoài quyền bạn đang có.',
      ),
    ],
    steps: [
      msg('Hiện dịch vụ chưa được triển khai nên ô hỏi đáp đang tắt.'),
      msg(
        'Trong lúc chờ, dùng Bảng điều khiển, Báo cáo kinh doanh, Hồ sơ đại lý hoặc Danh mục mặt hàng để tra cứu.',
      ),
    ],
    rules: [
      msg(
        'Trợ lý chỉ trả lời câu hỏi tra cứu; mọi thay đổi dữ liệu phải làm trên màn hình nghiệp vụ.',
      ),
    ],
    errors: [
      'READ_ONLY_QUERY_REQUIRED',
      'UNSUPPORTED_QUERY',
      'NEEDS_AGENCY_SELECTION',
      'NEEDS_CLARIFICATION',
    ],
    related: ['/dashboard', '/reports', '/agencies', '/products'],
  },
]
