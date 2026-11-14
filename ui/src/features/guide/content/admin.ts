import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const adminGuides: readonly GuideContent[] = [
  {
    path: '/users',
    purpose: msg(
      'Tài khoản người dùng dùng để tạo tài khoản, gán nhóm quyền, khóa tài khoản và đặt lại mật khẩu.',
    ),
    roles: [
      msg(
        'Quản trị hệ thống: mọi thao tác trên trang (quyền quản lý tài khoản; mặc định nhóm Quản lý).',
      ),
    ],
    flow: [
      { label: msg('Tạo tài khoản'), role: msg('Quản trị hệ thống') },
      { label: msg('Gán nhóm người dùng'), role: msg('Quản trị hệ thống') },
      { label: msg('Người dùng đăng nhập và đổi mật khẩu') },
      {
        label: msg('Khóa hoặc đặt lại mật khẩu khi cần'),
        role: msg('Quản trị hệ thống'),
      },
    ],
    steps: [
      msg('Bấm Thêm mới.'),
      msg(
        'Nhập Họ tên, Email, chọn Nhóm người dùng, nhập Mật khẩu và Trạng thái, rồi bấm Tạo mới.',
      ),
      msg('Tìm theo tên hoặc email; lọc theo trạng thái.'),
      msg('Bấm Chi tiết để đổi nhóm hoặc thông tin, sau đó bấm Lưu thay đổi.'),
      msg('Để khóa tài khoản, đổi Trạng thái sang Đang khóa rồi Lưu thay đổi.'),
      msg('Bấm Đặt lại mật khẩu, nhập Mật khẩu mới và báo cho người dùng.'),
    ],
    rules: [
      msg(
        'Mỗi tài khoản thuộc một nhóm; quyền của tài khoản là quyền của nhóm đó.',
      ),
      msg('Email đăng nhập không được trùng.'),
      msg(
        'Không xóa tài khoản, chỉ khóa. Tài khoản bị khóa không đăng nhập được.',
      ),
    ],
    errors: [
      'DUPLICATE_EMAIL',
      'VALIDATION_FAILED',
      'RESOURCE_IN_USE',
      'PRECONDITION_FAILED',
    ],
    related: ['/user-groups', '/permissions', '/audit-logs'],
  },
  {
    path: '/user-groups',
    purpose: msg(
      'Nhóm người dùng gom các tài khoản cùng vai trò để phân quyền chức năng một lần cho cả nhóm.',
    ),
    roles: [
      msg(
        'Quản trị hệ thống: tạo và sửa nhóm (quyền quản lý nhóm); xóa nhóm cần thêm quyền phân quyền.',
      ),
    ],
    flow: [
      { label: msg('Tạo nhóm'), role: msg('Quản trị hệ thống') },
      {
        label: msg('Phân quyền chức năng cho nhóm'),
        role: msg('Quản trị hệ thống'),
      },
      { label: msg('Gán tài khoản vào nhóm'), role: msg('Quản trị hệ thống') },
    ],
    steps: [
      msg('Bấm Thêm mới, nhập Mã nhóm và Tên nhóm, rồi bấm Tạo mới.'),
      msg('Bấm Chi tiết để sửa, sau đó bấm Lưu thay đổi.'),
      msg('Sang trang Phân quyền chức năng để cấp quyền cho nhóm vừa tạo.'),
      msg('Bấm Xóa chỉ khi nhóm chưa có tài khoản nào.'),
    ],
    rules: [
      msg(
        'Mặc định có bốn nhóm: Quản lý (mọi quyền), Kinh doanh, Kho và Kế toán.',
      ),
      msg('Nhóm còn tài khoản thì không xóa được.'),
    ],
    errors: ['RESOURCE_IN_USE', 'DUPLICATE_CODE', 'FORBIDDEN'],
    related: ['/permissions', '/users'],
  },
  {
    path: '/permissions',
    purpose: msg(
      'Phân quyền chức năng bật hoặc tắt từng quyền cho một nhóm người dùng.',
    ),
    roles: [
      msg(
        'Quản trị hệ thống: cấp và thu hồi quyền (quyền phân quyền; mặc định nhóm Quản lý).',
      ),
    ],
    flow: [
      { label: msg('Chọn nhóm người dùng'), role: msg('Quản trị hệ thống') },
      {
        label: msg('Cho phép hoặc thu hồi từng quyền'),
        role: msg('Quản trị hệ thống'),
      },
      { label: msg('Người dùng tải lại trang để thấy menu mới') },
    ],
    steps: [
      msg('Ở ô Nhóm người dùng, gõ tên nhóm để chọn.'),
      msg('Xem Tổng quan quyền của nhóm và Tỷ lệ cấp quyền.'),
      msg('Dùng ô Tìm chức năng để tìm theo mã hoặc tên.'),
      msg('Bấm Cho phép để cấp quyền, hoặc Thu hồi để bỏ quyền của nhóm.'),
    ],
    rules: [
      msg(
        'Mặc định Kinh doanh: tiếp nhận đại lý, lập và nộp phiếu xuất, xem doanh số, công nợ.',
      ),
      msg(
        'Mặc định Kho: phiếu nhập, ghi sổ phiếu xuất, trả hàng, kiểm kê, lập điều chỉnh kho, mặt hàng, đơn vị tính.',
      ),
      msg(
        'Mặc định Kế toán: phiếu thu, xác nhận trả ngay, bù trừ dư có, hoàn tiền, thanh toán trực tuyến, báo cáo.',
      ),
      msg(
        'Sửa sai, hủy chứng từ, duyệt điều chỉnh kho, thay đổi quy định và quản trị: mặc định chỉ nhóm Quản lý.',
      ),
      msg(
        'Quyền được kiểm tra lại ở mỗi thao tác; menu cập nhật sau khi người dùng tải lại trang.',
      ),
    ],
    errors: ['FORBIDDEN', 'PERMISSION_DENIED', 'PRECONDITION_FAILED'],
    tips: [
      msg(
        'Ví dụ: muốn Kho tự duyệt điều chỉnh kho, cấp quyền Duyệt điều chỉnh kho cho nhóm Kho.',
      ),
    ],
    related: ['/user-groups', '/users'],
  },
  {
    path: '/audit-logs',
    purpose: msg(
      'Nhật ký hệ thống ghi lại ai đã thay đổi dữ liệu gì và vào lúc nào, để tra soát khi cần.',
    ),
    roles: [msg('Quản lý: xem nhật ký (quyền xem nhật ký).')],
    steps: [
      msg(
        'Lọc theo Hành động, Người dùng hoặc Hệ thống, Mã người thực hiện và Mã yêu cầu.',
      ),
      msg('Bấm Chi tiết trên một dòng để mở Chi tiết nhật ký.'),
      msg('Xem Trường thay đổi, dữ liệu Trước thay đổi và Sau thay đổi.'),
    ],
    rules: [
      msg(
        'Nhật ký tự ghi khi chứng từ, phiên bản, dòng hàng và bằng chứng thanh toán thay đổi.',
      ),
      msg('Nhật ký không sửa, không xóa được.'),
      msg('Thông tin nhạy cảm như mật khẩu đã được ẩn.'),
    ],
    errors: ['FORBIDDEN', 'INVALID_CURSOR'],
    related: ['/document-history', '/users'],
  },
  {
    path: '/document-history',
    purpose: msg(
      'Lịch sử chứng từ cho tìm mọi loại chứng từ, xem từng phiên bản, bản in và tải PDF.',
    ),
    roles: [
      msg('Mọi người dùng: chỉ thấy loại chứng từ mà mình có quyền đọc.'),
    ],
    steps: [
      msg(
        'Nhập Tìm chứng từ theo mã, đại lý hoặc ghi chú; chọn Loại chứng từ, Đại lý, Mặt hàng.',
      ),
      msg(
        'Chọn Từ ngày và Đến ngày (không gồm ngày cuối), rồi bấm Áp dụng bộ lọc.',
      ),
      msg(
        'Chọn một chứng từ để xem Dòng thời gian phiên bản; bấm Xem trên một phiên bản để xem nội dung và dòng hàng.',
      ),
      msg('Bấm Xem bản in hoặc Tải PDF để in chứng từ.'),
    ],
    rules: [
      msg(
        'Chứng từ không bao giờ bị xóa. Mỗi lần sửa sai tạo phiên bản mới có lý do; phiên bản cũ được giữ nguyên.',
      ),
      msg('Chứng từ đã hủy vẫn được lưu và tra cứu được.'),
    ],
    errors: ['FORBIDDEN', 'NOT_FOUND', 'NOT_ACCEPTABLE'],
    related: ['/document-corrections', '/audit-logs'],
  },
  {
    path: '/document-corrections',
    purpose: msg(
      'Sửa sai & Hủy chứng từ là nơi tập trung để sửa hoặc hủy chứng từ đã ghi sổ, bằng một phiên bản mới có lý do.',
    ),
    roles: [
      msg(
        'Quản lý: Điều chỉnh (quyền sửa chứng từ đã xác nhận, kèm quyền ghi sổ của loại chứng từ đó).',
      ),
      msg(
        'Quản lý: Hủy chứng từ (quyền hủy chứng từ; hủy phiếu xuất có trả ngay cần thêm quyền xác nhận thu).',
      ),
    ],
    flow: [
      { label: msg('Tìm chứng từ đã ghi sổ'), role: msg('Quản lý') },
      { label: msg('Kiểm tra nội dung hiện tại'), role: msg('Quản lý') },
      { label: msg('Điều chỉnh hoặc hủy, kèm lý do'), role: msg('Quản lý') },
      {
        label: msg('Hệ thống đảo bút toán cũ, kiểm tra lại tồn kho và công nợ'),
      },
    ],
    steps: [
      msg(
        'Danh sách chỉ gồm chứng từ đã ghi sổ. Lọc theo loại, đại lý hoặc ngày.',
      ),
      msg('Bấm Kiểm tra trên chứng từ cần xử lý.'),
      msg(
        'Bấm Điều chỉnh, nhập Thông tin thay thế (ngày nghiệp vụ mới, dòng hàng, số tiền thay thế…) và Lý do bắt buộc, rồi bấm Xác nhận thay thế.',
      ),
      msg('Hoặc bấm Hủy chứng từ, nhập Lý do bắt buộc, rồi bấm Xác nhận hủy.'),
      msg('Nếu báo dữ liệu đã thay đổi, bấm Tải lại rồi làm lại.'),
    ],
    rules: [
      msg(
        'Không áp dụng cho hoàn tiền, phiếu thu tự động, phiếu thu trực tuyến, phiếu thu riêng và điều chỉnh sinh từ kiểm kê.',
      ),
      msg(
        'Sửa phiếu xuất giữ nguyên tiền trả ngay; tổng mới không được nhỏ hơn trả ngay.',
      ),
      msg(
        'Hủy phiếu xuất bị chặn nếu còn phiếu trả hàng có hiệu lực; tiền trả ngay của phiếu đó chuyển thành phiếu thu riêng.',
      ),
      msg(
        'Bị từ chối nếu làm tồn kho âm, công nợ vượt hạn mức, hoặc mất nguồn của khoản hoàn tiền.',
      ),
      msg(
        'Sửa hoặc hủy có thể phân bổ lại tiền thu giữa các hóa đơn. Hủy không hoàn tác được.',
      ),
    ],
    errors: [
      'CORRECTION_CONFLICT',
      'STOCK_CONFLICT',
      'RETURN_SOURCE_CONFLICT',
      'LIMIT_CONFLICT',
      'RECEIPT_CONFLICT',
      'REASON_REQUIRED',
    ],
    tips: [
      msg(
        'Chứng từ chưa ghi sổ (nháp, chờ xuất) xử lý ngay trên trang của loại chứng từ đó bằng nút Hủy phiếu.',
      ),
    ],
    related: [
      '/document-history',
      '/stock-issues',
      '/payment-receipts',
      '/audit-logs',
    ],
  },
]
