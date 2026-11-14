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
        'Tab Chức năng nghiệp vụ: xem các khu vực Đại lý & Hàng hóa, Giao dịch kho, Thu tiền & Công nợ, Danh mục & Quy định, Quản trị & Lịch sử; bấm ngôi sao trên thẻ để thêm vào Yêu thích.',
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
        'Thứ tự nghiệp vụ thường gặp: Phiếu nhập → Phiếu xuất → Xác nhận trả ngay (nếu có) → Ghi sổ → Phiếu thu.',
      ),
      msg(
        'Nháp và chứng từ chờ ghi sổ chưa làm thay đổi tồn kho hay công nợ. Chỉ Ghi sổ mới có hiệu lực.',
      ),
    ],
    related: ['/dashboard', '/reports', '/profile'],
  },
  {
    path: '/dashboard',
    purpose: msg(
      'Bảng điều khiển cho cái nhìn nhanh về doanh số, công nợ, dòng tiền, dư có và tồn kho của toàn công ty theo tháng.',
    ),
    roles: [
      msg(
        'Mỗi khối số liệu chỉ hiện khi bạn có quyền tương ứng: tra cứu đại lý, tồn kho, doanh số hoặc công nợ.',
      ),
      msg('Kho (quyền xác nhận xuất): thấy số phiếu xuất đang chờ ghi sổ.'),
      msg(
        'Kế toán (quyền xác nhận khoản trả ngay): thấy tiền đã xác minh nhưng chưa thành phiếu thu.',
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
        'Chỉ tính chứng từ đã ghi sổ. Nháp, phiếu chờ ghi sổ và chứng từ đã hủy không được tính.',
      ),
      msg(
        'Số liệu tính theo ngày nghiệp vụ. Ghi sổ lùi ngày hoặc sửa sai có thể làm thay đổi số liệu tháng trước.',
      ),
      msg('Doanh số thuần bằng doanh số gộp trừ hàng trả lại.'),
      msg('Tổng dư có gồm cả phần đang được giữ chỗ cho yêu cầu hoàn tiền.'),
      msg(
        'Tiền đã xác minh nhưng chưa ghi phiếu thu là trả ngay Kế toán đã xác minh, chờ Kho ghi sổ phiếu xuất. Khoản này chưa tính vào thực thu.',
      ),
    ],
    errors: ['FORBIDDEN', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'],
    tips: [
      msg(
        'Nếu ô Phiếu xuất đang chờ lớn hơn 0, kiểm tra trang Xác nhận trả ngay xem phiếu nào còn chờ Kế toán.',
      ),
    ],
    related: ['/reports', '/receivables', '/stock-issues', '/upfront-payments'],
  },
  {
    path: '/reports',
    purpose: msg(
      'Lập các báo cáo kinh doanh theo kỳ: doanh số đại lý, công nợ, xuất nhập tồn, doanh số mặt hàng, thu chi và dư có; xuất ra PDF hoặc Excel.',
    ),
    roles: [
      msg(
        'Cần quyền Báo cáo kèm quyền đọc tương ứng: tra cứu doanh số, công nợ hoặc tồn kho.',
      ),
      msg('Kế toán: mặc định xem được báo cáo doanh số, công nợ, thu chi.'),
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
        'Chọn Loại báo cáo: Doanh số đại lý, Công nợ, Xuất nhập tồn, Doanh số mặt hàng hoặc Thu chi & dư có.',
      ),
      msg(
        'Chọn Kỳ báo cáo nhanh, hoặc nhập Từ ngày và Đến trước ngày. Ngày ở ô Đến trước ngày không được tính.',
      ),
      msg(
        'Thêm bộ lọc nếu cần, ví dụ phường/xã cho báo cáo công nợ; chọn Sắp xếp và Số dòng mỗi trang.',
      ),
      msg('Bấm Áp dụng để tải dữ liệu. Bấm Xóa bộ lọc để làm lại từ đầu.'),
      msg('Dùng Trang trước và Trang tiếp để xem các trang kết quả.'),
      msg(
        'Bấm Xuất báo cáo rồi chọn Xuất PDF hoặc Xuất XLSX. Tệp gồm toàn bộ kết quả đã lọc, không chỉ trang đang xem.',
      ),
    ],
    rules: [
      msg(
        'Doanh số là tổng tiền các phiếu xuất đã ghi sổ trong kỳ; tỷ lệ là doanh số của đại lý chia tổng doanh số.',
      ),
      msg(
        'Báo cáo công nợ: nợ cuối kỳ bằng nợ đầu kỳ cộng phát sinh tăng trừ phát sinh giảm.',
      ),
      msg(
        'Phát sinh giảm được tách thành tiền đã thu, hàng trả lại và bù trừ dư có.',
      ),
      msg(
        'Báo cáo tính theo ngày nghiệp vụ và không khóa sổ kỳ. Nghiệp vụ lùi ngày hoặc sửa sai có thể làm đổi số liệu kỳ cũ.',
      ),
      msg('Nháp, phiếu chờ ghi sổ và chứng từ đã hủy không được tính.'),
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
    related: ['/dashboard', '/receivables', '/inventory'],
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
        'Trong lúc chờ, dùng Bảng điều khiển, Báo cáo kinh doanh, Công nợ đại lý hoặc Tồn kho & Thẻ kho để tra cứu.',
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
    related: ['/dashboard', '/reports', '/receivables', '/inventory'],
  },
]
