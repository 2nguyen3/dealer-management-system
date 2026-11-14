import { msg, t } from './i18n/core'

/** What to tell the user about an API error code. All texts are message IDs. */
export interface ErrorText {
  /** What went wrong, in business words. */
  message: string
  /** How to fix it or what to check next. */
  hint?: string
  /** Optional shortcut to the page that resolves it. */
  action?: { label: string; to: string }
}

/**
 * Error codes returned by the backend (every `ApiError(<status>, "<CODE>")`
 * and conflict map scanned from `backend/app` after the 2026-11 business
 * simplification), the OpenAPI contract and client-side codes. Many codes are
 * shared by several screens, so the wording stays general; screens add
 * specific guidance.
 */
export const ERROR_TEXTS = {
  // Authentication & access
  ACCOUNT_LOCKED: {
    message: msg('Tài khoản đang bị khóa.'),
    hint: msg('Liên hệ quản trị viên để mở khóa tài khoản.'),
  },
  INVALID_CREDENTIALS: {
    message: msg('Email hoặc mật khẩu không đúng.'),
    hint: msg('Kiểm tra lại email, mật khẩu và phím Caps Lock.'),
  },
  INVALID_OR_EXPIRED_TOKEN: {
    message: msg('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.'),
    hint: msg('Đăng nhập lại để tiếp tục.'),
  },
  FORBIDDEN: {
    message: msg('Bạn không có quyền thực hiện thao tác này.'),
    hint: msg('Nhờ quản trị viên cấp quyền phù hợp cho nhóm của bạn.'),
  },
  PERMISSION_DENIED: {
    message: msg('Bạn không có quyền thực hiện thao tác này.'),
    hint: msg('Nhờ quản trị viên cấp quyền phù hợp cho nhóm của bạn.'),
  },
  RATE_LIMIT_EXCEEDED: {
    message: msg('Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn.'),
    hint: msg('Chờ khoảng một phút rồi thử lại.'),
  },
  SERVICE_UNAVAILABLE: {
    message: msg('Dịch vụ tạm thời không sẵn sàng.'),
    hint: msg('Thử lại sau ít phút.'),
  },

  // Request format & concurrency
  BAD_REQUEST: {
    message: msg('Yêu cầu không hợp lệ.'),
    hint: msg('Tải lại trang rồi thao tác lại.'),
  },
  MALFORMED_REQUEST: {
    message: msg('Dữ liệu gửi lên không đúng định dạng.'),
    hint: msg('Kiểm tra các ô đã nhập rồi gửi lại.'),
  },
  VALIDATION_FAILED: {
    message: msg('Dữ liệu nhập chưa hợp lệ.'),
    hint: msg('Xem các ô được đánh dấu, sửa giá trị rồi gửi lại.'),
  },
  INVALID_FIELD: {
    message: msg('Có trường dữ liệu chưa hợp lệ.'),
    hint: msg('Xem các ô được đánh dấu, sửa giá trị rồi gửi lại.'),
  },
  INVALID_JSON: {
    message: msg('Dữ liệu gửi lên không đúng định dạng.'),
    hint: msg('Tải lại trang rồi thao tác lại.'),
  },
  INVALID_CURSOR: {
    message: msg('Vị trí phân trang không còn hợp lệ.'),
    hint: msg('Tải lại danh sách từ trang đầu.'),
  },
  NOT_ACCEPTABLE: {
    message: msg('Định dạng tải xuống không được hỗ trợ.'),
    hint: msg('Chọn PDF hoặc Excel (XLSX).'),
  },
  UNSUPPORTED_MEDIA_TYPE: {
    message: msg('Định dạng dữ liệu gửi lên không được hỗ trợ.'),
    hint: msg('Tải lại trang rồi thao tác lại.'),
  },
  UNSUPPORTED_RESPONSE_MEDIA_TYPE: {
    message: msg('Định dạng tải xuống không được hỗ trợ.'),
    hint: msg('Chọn PDF hoặc Excel (XLSX).'),
  },
  NOT_FOUND: {
    message: msg('Không tìm thấy dữ liệu yêu cầu.'),
    hint: msg(
      'Dữ liệu có thể đã bị xóa hoặc mã không đúng. Tải lại danh sách.',
    ),
  },
  RESOURCE_NOT_FOUND: {
    message: msg('Không tìm thấy dữ liệu yêu cầu.'),
    hint: msg(
      'Dữ liệu có thể đã bị xóa hoặc mã không đúng. Tải lại danh sách.',
    ),
  },
  REFERENCE_NOT_FOUND: {
    message: msg('Dữ liệu được tham chiếu không tồn tại.'),
    hint: msg('Chọn lại đại lý, mặt hàng hoặc chứng từ từ danh sách.'),
  },
  PRECONDITION_FAILED: {
    message: msg('Dữ liệu đã được người khác thay đổi.'),
    hint: msg('Tải lại để xem phiên bản mới nhất rồi thực hiện lại.'),
  },
  RESOURCE_VERSION_CONFLICT: {
    message: msg('Dữ liệu đã được người khác thay đổi.'),
    hint: msg('Tải lại để xem phiên bản mới nhất rồi thực hiện lại.'),
  },
  PRECONDITION_REQUIRED: {
    message: msg('Cần tải phiên bản mới nhất trước khi sửa.'),
    hint: msg('Mở lại chi tiết để lấy phiên bản hiện tại rồi thao tác lại.'),
  },
  IDEMPOTENCY_KEY_REUSED: {
    message: msg('Yêu cầu lặp lại có nội dung khác lần gửi trước.'),
    hint: msg(
      'Tải lại trang để xem kết quả lần trước trước khi gửi nội dung mới.',
    ),
  },
  RESOURCE_BUSY: {
    message: msg('Dữ liệu đang được xử lý bởi một yêu cầu khác.'),
    hint: msg('Chờ vài giây rồi thử lại đúng nội dung cũ.'),
  },
  INTERNAL_ERROR: {
    message: msg('Máy chủ gặp sự cố xử lý.'),
    hint: msg(
      'Kết quả chưa rõ. Thử lại cùng nội dung; nếu vẫn lỗi, báo quản trị viên.',
    ),
  },
  NETWORK_ERROR: {
    message: msg('Không thể kết nối đến máy chủ.'),
    hint: msg(
      'Kiểm tra mạng rồi thử lại cùng nội dung; không lập chứng từ khác.',
    ),
  },
  INVALID_RESPONSE: {
    message: msg('Phản hồi máy chủ không hợp lệ.'),
    hint: msg('Tải lại trang; nếu vẫn lỗi, báo quản trị viên.'),
  },
  INVALID_ACCEPT: {
    message: msg('Cần chọn định dạng tải xuống.'),
    hint: msg('Chọn PDF hoặc Excel (XLSX).'),
  },

  // Master data
  DUPLICATE: {
    message: msg('Giá trị này đã tồn tại.'),
    hint: msg('Dùng mã, tên hoặc email khác.'),
  },
  DUPLICATE_CODE: {
    message: msg('Mã này đã tồn tại.'),
    hint: msg('Dùng mã khác.'),
  },
  DUPLICATE_EMAIL: {
    message: msg('Email này đã được dùng.'),
    hint: msg('Dùng email khác.'),
  },
  NOT_UNIQUE: {
    message: msg('Giá trị này đã tồn tại.'),
    hint: msg('Dùng giá trị khác.'),
  },
  RESOURCE_IN_USE: {
    message: msg('Dữ liệu đang được sử dụng nên không thể xóa.'),
    hint: msg(
      'Ngừng hoạt động thay vì xóa, hoặc gỡ các liên kết (tài khoản, chứng từ) trước.',
    ),
  },
  INACTIVE_MASTER: {
    message: msg('Đại lý, mặt hàng hoặc đơn vị tính đang ngừng hoạt động.'),
    hint: msg('Kích hoạt lại danh mục hoặc chọn mục đang hoạt động.'),
  },
  MASTER_CONFLICT: {
    message: msg('Không thể đổi thuộc tính đã được dùng trong chứng từ.'),
    hint: msg('Tạo danh mục mới thay vì sửa danh mục đã có lịch sử.'),
  },
  USED_UNIT_IMMUTABLE: {
    message: msg('Mặt hàng đã có chứng từ nên không thể đổi đơn vị tính.'),
    hint: msg('Tạo mặt hàng mới nếu cần đơn vị tính khác.'),
  },
  FRACTION_NOT_ALLOWED: {
    message: msg('Đơn vị tính này chỉ nhận số lượng nguyên.'),
    hint: msg('Nhập số lượng không có phần thập phân.'),
  },
  QUANTITY_PRECISION_EXCEEDED: {
    message: msg('Số lượng có quá nhiều chữ số thập phân.'),
    hint: msg('Làm tròn số lượng theo đơn vị tính.'),
  },
  WARD_CAPACITY_EXCEEDED: {
    message: msg('Phường/xã đã đủ số đại lý tối đa theo quy định.'),
    hint: msg('Hãy chọn phường/xã khác hoặc điều chỉnh quy định.'),
    action: { label: msg('Mở Thay đổi quy định'), to: '/business-rules' },
  },
  CAPACITY_BELOW_CURRENT_USAGE: {
    message: msg('Giới hạn mới nhỏ hơn số đại lý hiện có.'),
    hint: msg('Chọn giới hạn lớn hơn hoặc bằng số đại lý đang hoạt động.'),
  },
  AGENCY_CONFLICT: {
    message: msg('Ngày tiếp nhận không hợp lệ với chứng từ đã có.'),
    hint: msg(
      'Ngày tiếp nhận đại lý không được sau ngày của chứng từ đã lập cho đại lý.',
    ),
  },
  AGENCY_TERMINATED: {
    message: msg('Đại lý đã ngừng hợp tác.'),
    hint: msg('Chọn đại lý khác đang hoạt động.'),
  },
  AGENCY_HAS_DEBT: {
    message: msg('Đại lý còn nợ nên chưa thể ngừng hợp tác.'),
    hint: msg(
      'Lập phiếu thu cho hết số nợ hiện tại (nợ về 0) rồi ngừng hợp tác.',
    ),
    action: { label: msg('Mở Phiếu thu tiền'), to: '/payment-receipts' },
  },
  DEBT_LIMIT_BELOW_CURRENT_BALANCE: {
    message: msg('Hạn mức nợ mới thấp hơn nợ hiện tại của đại lý.'),
    hint: msg('Thu bớt nợ trước hoặc chọn hạn mức cao hơn.'),
  },
  LIMIT_CONFLICT: {
    message: msg('Giới hạn mới thấp hơn mức đang sử dụng.'),
    hint: msg(
      'Hạn mức nợ của loại đại lý mới phải không nhỏ hơn nợ hiện tại; số đại lý tối đa mỗi phường/xã phải không nhỏ hơn số đại lý đang hoạt động.',
    ),
  },

  // Documents
  STATE_CONFLICT: {
    message: msg('Chứng từ không ở trạng thái cho phép thao tác này.'),
    hint: msg(
      'Tải lại chi tiết để xem trạng thái hiện tại; có thể người khác vừa ghi sổ, hủy hoặc sửa chứng từ.',
    ),
  },
  INVALID_STATE_TRANSITION: {
    message: msg('Chứng từ không ở trạng thái cho phép thao tác này.'),
    hint: msg('Tải lại chi tiết để xem trạng thái hiện tại.'),
  },
  PERIOD_CLOSED: {
    message: msg('Chứng từ thuộc tháng đã khóa sổ.'),
    hint: msg(
      'Chỉ hủy hoặc sửa được chứng từ có ngày trong tháng hiện tại. Lập chứng từ mới để điều chỉnh.',
    ),
  },
  REASON_REQUIRED: {
    message: msg('Cần nhập lý do.'),
    hint: msg('Hủy hoặc sửa chứng từ đã ghi sổ phải ghi rõ lý do.'),
  },
  EMPTY_DOCUMENT: {
    message: msg('Chứng từ chưa có dòng hàng nào.'),
    hint: msg('Thêm ít nhất một dòng hàng rồi lưu lại.'),
  },
  DUPLICATE_PRODUCT: {
    message: msg('Một mặt hàng xuất hiện nhiều lần trong chứng từ.'),
    hint: msg('Gộp các dòng cùng mặt hàng thành một dòng.'),
  },
  DUPLICATE_PRODUCT_LINE: {
    message: msg('Một mặt hàng xuất hiện nhiều lần trong chứng từ.'),
    hint: msg('Gộp các dòng cùng mặt hàng thành một dòng.'),
  },
  PRODUCT_NOT_PRICED: {
    message: msg('Mặt hàng chưa có giá bán vì chưa từng được nhập.'),
    hint: msg(
      'Ghi sổ một phiếu nhập cho mặt hàng này trước; giá bán = giá nhập gần nhất × tỷ lệ giá bán.',
    ),
    action: { label: msg('Mở Phiếu nhập hàng'), to: '/stock-receipts' },
  },
  SELLING_PRICE_UNUSABLE: {
    message: msg('Không tính được giá bán hợp lệ cho mặt hàng.'),
    hint: msg('Kiểm tra giá nhập gần nhất và tỷ lệ giá bán trong quy định.'),
    action: { label: msg('Mở Thay đổi quy định'), to: '/business-rules' },
  },
  INSUFFICIENT_STOCK: {
    message: msg('Không đủ tồn kho.'),
    hint: msg(
      'Số lượng xuất không được vượt tồn hiện tại; hủy phiếu nhập không được làm tồn âm. Giảm số lượng hoặc ghi sổ phiếu nhập trước.',
    ),
    action: { label: msg('Mở Danh mục mặt hàng'), to: '/products' },
  },
  DEBT_LIMIT_EXCEEDED: {
    message: msg('Nợ sau phiếu xuất vượt hạn mức nợ của đại lý.'),
    hint: msg(
      'Giảm số lượng, hoặc lập phiếu thu để giảm nợ hiện tại trước khi ghi sổ.',
    ),
    action: { label: msg('Mở Phiếu thu tiền'), to: '/payment-receipts' },
  },

  // Money
  PAYMENT_EXCEEDS_DEBT: {
    message: msg('Số tiền thu vượt nợ hiện tại của đại lý.'),
    hint: msg('Nhập số tiền lớn hơn 0 và không lớn hơn nợ hiện tại.'),
    action: { label: msg('Mở Hồ sơ đại lý'), to: '/agencies' },
  },
  WHOLE_VND_REQUIRED: {
    message: msg('Số tiền phải là số nguyên VND.'),
    hint: msg('Bỏ phần thập phân.'),
  },

  // Online payments
  PAYMENT_CONFLICT: {
    message: msg('Thông tin giao dịch không khớp với lần ghi nhận trước.'),
    hint: msg('Bấm đối soát giao dịch để lấy kết quả chính thức từ cổng.'),
  },
  PROVIDER_UNAVAILABLE: {
    message: msg('Cổng thanh toán đang không phản hồi hoặc chưa cấu hình.'),
    hint: msg('Thử lại sau; không tạo giao dịch mới khi chưa rõ kết quả.'),
  },
  UNSUPPORTED_PROVIDER: {
    message: msg('Cổng thanh toán chưa được cấu hình.'),
    hint: msg('Báo quản trị viên cấu hình cổng thanh toán.'),
  },
  INVALID_PROVIDER_RESPONSE: {
    message: msg('Phản hồi từ cổng thanh toán không hợp lệ.'),
    hint: msg('Bấm đối soát giao dịch hiện tại trước khi thử lại.'),
  },
  INVALID_SIGNATURE: {
    message: msg('Chữ ký từ cổng thanh toán không hợp lệ.'),
    hint: msg('Không coi giao dịch là thành công; đối soát lại với cổng.'),
  },
  VNPAY_AMOUNT_INVALID: {
    message: msg('Số tiền nằm ngoài giới hạn VNPAY cho phép.'),
    hint: msg('Nhập số tiền nguyên VND trong giới hạn của VNPAY.'),
  },

  // Reports and AI assistant (target contract)
  INVALID_DATE_RANGE: {
    message: msg('Khoảng thời gian không hợp lệ.'),
    hint: msg('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'),
  },
  RANGE_ORDER: {
    message: msg('Khoảng thời gian không hợp lệ.'),
    hint: msg('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'),
  },
  UNSUPPORTED_QUERY: {
    message: msg('Câu hỏi chưa được hỗ trợ.'),
    hint: msg('Đặt câu hỏi cụ thể hơn về tồn kho, công nợ hoặc doanh số.'),
  },
  READ_ONLY_QUERY_REQUIRED: {
    message: msg('Trợ lý chỉ trả lời câu hỏi tra cứu.'),
    hint: msg('Thực hiện thay đổi dữ liệu trên màn hình nghiệp vụ.'),
  },
  NEEDS_AGENCY_SELECTION: {
    message: msg('Cần chọn một đại lý cụ thể.'),
    hint: msg('Nêu tên hoặc mã đại lý trong câu hỏi.'),
  },
  NEEDS_CLARIFICATION: {
    message: msg('Câu hỏi cần làm rõ thêm.'),
    hint: msg('Bổ sung khoảng thời gian, đại lý hoặc mặt hàng.'),
  },
} as const satisfies Record<string, ErrorText>

export type ErrorCode = keyof typeof ERROR_TEXTS

/** Translated `{message, hint, action}` for a code, or `null` if unknown. */
export function describeError(code: string): ErrorText | null {
  const entry = (ERROR_TEXTS as Record<string, ErrorText>)[code]
  if (!entry) return null
  return {
    message: t(entry.message),
    ...(entry.hint ? { hint: t(entry.hint) } : {}),
    ...(entry.action
      ? { action: { label: t(entry.action.label), to: entry.action.to } }
      : {}),
  }
}
