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
 * Error codes returned by the backend (scanned from `backend/app` on
 * 2026-11-14), the target OpenAPI contract and client-side codes. Many codes
 * are shared by several screens, so the wording stays general; screens add
 * specific guidance (for example the stock-issue upfront step).
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
  COMMAND_OUTCOME_UNKNOWN: {
    message: msg('Chưa rõ kết quả của yêu cầu trước.'),
    hint: msg(
      'Thử lại cùng nội dung để hệ thống trả kết quả cũ; không lập chứng từ khác.',
    ),
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
    message: msg('Đại lý không hợp lệ cho chứng từ này.'),
    hint: msg(
      'Đại lý phải đang hoạt động và ngày nghiệp vụ không được trước ngày tiếp nhận đại lý.',
    ),
  },
  AGENCY_TERMINATED: {
    message: msg('Đại lý đã chấm dứt hợp tác.'),
    hint: msg('Chọn đại lý khác đang hoạt động.'),
  },
  DEBT_LIMIT_BELOW_CURRENT_BALANCE: {
    message: msg('Hạn mức nợ mới thấp hơn công nợ hiện tại của đại lý.'),
    hint: msg('Thu bớt công nợ trước hoặc chọn hạn mức cao hơn.'),
  },

  // Documents
  STATE_CONFLICT: {
    message: msg('Chứng từ không ở trạng thái cho phép thao tác này.'),
    hint: msg(
      'Tải lại chi tiết để xem trạng thái hiện tại; có thể người khác vừa nộp, ghi sổ hoặc hủy.',
    ),
  },
  INVALID_STATE_TRANSITION: {
    message: msg('Chứng từ không ở trạng thái cho phép thao tác này.'),
    hint: msg('Tải lại chi tiết để xem trạng thái hiện tại.'),
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
  LINE_CONFLICT: {
    message: msg('Dòng hàng không hợp lệ.'),
    hint: msg(
      'Số lượng và đơn giá phải dương; dòng điều chỉnh kho có đơn giá bằng 0.',
    ),
  },
  INVALID_QUANTITY: {
    message: msg('Số lượng không hợp lệ với đơn vị tính.'),
    hint: msg('Đơn vị tính này chỉ nhận số lượng nguyên.'),
  },
  INVALID_TOTAL: {
    message: msg('Tổng tiền chứng từ không hợp lệ.'),
    hint: msg(
      'Tổng tiền phải lớn hơn 0 và khoản trả ngay không được vượt tổng tiền phiếu.',
    ),
  },
  TOTAL_OVERFLOW: {
    message: msg('Tổng tiền vượt giới hạn lưu trữ.'),
    hint: msg('Tách thành nhiều chứng từ nhỏ hơn.'),
  },
  BALANCE_OVERFLOW: {
    message: msg('Số dư vượt giới hạn lưu trữ.'),
    hint: msg('Tách thành nhiều chứng từ nhỏ hơn.'),
  },
  REASON_REQUIRED: {
    message: msg('Cần nhập lý do nghiệp vụ.'),
    hint: msg('Ghi rõ lý do để lưu vết kiểm toán.'),
  },
  PRICE_SOURCE_REQUIRED: {
    message: msg('Mặt hàng chưa có giá nhập.'),
    hint: msg(
      'Ghi sổ một phiếu nhập cho mặt hàng này trước để hệ thống tính giá bán.',
    ),
    action: { label: msg('Mở Phiếu nhập hàng'), to: '/stock-receipts' },
  },
  PURCHASE_PRICE_NOT_ESTABLISHED: {
    message: msg('Mặt hàng chưa có giá nhập.'),
    hint: msg('Ghi sổ một phiếu nhập cho mặt hàng này trước.'),
    action: { label: msg('Mở Phiếu nhập hàng'), to: '/stock-receipts' },
  },
  SELLING_PRICE_UNUSABLE: {
    message: msg('Không tính được giá bán hợp lệ cho mặt hàng.'),
    hint: msg('Kiểm tra giá nhập hiện hành và tỷ lệ giá bán trong quy định.'),
    action: { label: msg('Mở Thay đổi quy định'), to: '/business-rules' },
  },
  INSUFFICIENT_STOCK: {
    message: msg('Không đủ tồn kho để xuất.'),
    hint: msg(
      'Giảm số lượng, ghi sổ phiếu nhập trước, hoặc kiểm tra tồn kho tại ngày nghiệp vụ.',
    ),
    action: { label: msg('Mở Tồn kho'), to: '/inventory' },
  },
  STOCK_CONFLICT: {
    message: msg('Thao tác làm tồn kho bị âm ở một thời điểm.'),
    hint: msg('Kiểm tra thẻ kho; giảm số lượng hoặc đổi ngày nghiệp vụ.'),
    action: { label: msg('Mở Tồn kho'), to: '/inventory' },
  },
  HISTORICAL_STOCK_NEGATIVE: {
    message: msg('Thao tác làm tồn kho trong quá khứ bị âm.'),
    hint: msg('Kiểm tra thẻ kho; giảm số lượng hoặc đổi ngày nghiệp vụ.'),
  },
  STOCK_OVERFLOW: {
    message: msg('Tồn kho vượt giới hạn lưu trữ.'),
    hint: msg('Kiểm tra lại số lượng nhập.'),
  },
  LIMIT_CONFLICT: {
    message: msg(
      'Thao tác vượt giới hạn cho phép (hạn mức nợ hoặc số đại lý tối đa).',
    ),
    hint: msg(
      'Với phiếu xuất: tăng trả ngay, giảm số lượng hoặc thu bớt công nợ trước khi nộp. Với quy định hay loại đại lý: giới hạn mới không được thấp hơn mức đang sử dụng.',
    ),
  },
  DEBT_LIMIT_EXCEEDED: {
    message: msg('Công nợ sau phiếu vượt hạn mức nợ của đại lý.'),
    hint: msg(
      'Tăng khoản trả ngay, giảm số lượng, hoặc thu bớt công nợ trước.',
    ),
    action: { label: msg('Mở Công nợ đại lý'), to: '/receivables' },
  },
  COUNT_LINKED_ADJUSTMENT: {
    message: msg('Phiếu điều chỉnh sinh từ kiểm kê không sửa riêng được.'),
    hint: msg('Xử lý trên biên bản kiểm kê tương ứng.'),
    action: { label: msg('Mở Kiểm kê kho'), to: '/stock-counts' },
  },
  CORRECTION_CONFLICT: {
    message: msg('Sửa sai làm lịch sử chứng từ không còn hợp lệ.'),
    hint: msg(
      'Các chứng từ phía sau phụ thuộc vào chứng từ này (tồn kho, công nợ, dư có). Sửa hoặc hủy chứng từ phía sau trước.',
    ),
  },
  REVERSAL_CONFLICT: {
    message: msg('Chỉ đảo được chứng từ đang có hiệu lực.'),
    hint: msg('Tải lại để xem chứng từ đã bị sửa hoặc hủy chưa.'),
  },
  HISTORICAL_EVIDENCE_IMMUTABLE: {
    message: msg('Bằng chứng đã ghi nhận không thể sửa.'),
    hint: msg('Lập chứng từ điều chỉnh thay vì sửa bằng chứng cũ.'),
  },
  HISTORICAL_RECEIVABLE_NEGATIVE: {
    message: msg('Thao tác làm công nợ trong quá khứ bị âm.'),
    hint: msg('Kiểm tra các phiếu thu và bù trừ phía sau.'),
  },

  // Stock counts
  EMPTY_COUNT: {
    message: msg('Biên bản kiểm kê chưa có dòng đếm nào.'),
    hint: msg('Thêm số đếm thực tế cho ít nhất một mặt hàng.'),
  },
  RECOUNT_PRODUCTS: {
    message: msg(
      'Đếm lại phải gồm đúng mọi mặt hàng đã có, mỗi mặt hàng một lần.',
    ),
    hint: msg('Nhập lại số đếm cho toàn bộ danh sách mặt hàng hiện có.'),
  },
  STALE_STOCK_SNAPSHOT: {
    message: msg('Số tồn trên sổ đã thay đổi kể từ lúc đếm.'),
    hint: msg(
      'Có chứng từ kho mới được ghi sổ. Đếm lại toàn bộ để lấy số sổ sách mới rồi xác nhận.',
    ),
  },

  // Money
  PAYMENT_EXCEEDS_DEBT: {
    message: msg('Số tiền thu vượt công nợ hiện tại của đại lý.'),
    hint: msg(
      'Nhập số tiền không lớn hơn công nợ; phần thừa nên ghi nhận thành dư có.',
    ),
    action: { label: msg('Mở Công nợ đại lý'), to: '/receivables' },
  },
  PAYMENT_EXCEEDS_CURRENT_DEBT: {
    message: msg('Số tiền thu vượt công nợ hiện tại của đại lý.'),
    hint: msg('Nhập số tiền không lớn hơn công nợ.'),
  },
  COLLECTION_EXCEEDS_ALLOCATABLE_DEBT: {
    message: msg('Số tiền thu vượt công nợ có thể phân bổ.'),
    hint: msg('Nhập số tiền không lớn hơn công nợ còn lại.'),
  },
  FIFO_REALLOCATION_INSUFFICIENT_DEBT: {
    message: msg('Không đủ công nợ để phân bổ lại theo thứ tự hóa đơn.'),
    hint: msg('Kiểm tra các phiếu thu và bù trừ phía sau.'),
  },
  WHOLE_VND_REQUIRED: {
    message: msg('Số tiền phải là số nguyên VND.'),
    hint: msg('Bỏ phần thập phân.'),
  },
  RECEIPT_CONFLICT: {
    message: msg('Chỉ sửa được phiếu thu công nợ đang ở trạng thái nháp.'),
    hint: msg(
      'Phiếu thu tự động từ phiếu xuất hoặc đã ghi sổ phải sửa qua Sửa sai & Hủy chứng từ.',
    ),
    action: {
      label: msg('Mở Sửa sai & Hủy chứng từ'),
      to: '/document-corrections',
    },
  },
  AUTO_RECEIPT_INDEPENDENT_MUTATION_FORBIDDEN: {
    message: msg('Phiếu thu tự động không sửa riêng được.'),
    hint: msg('Sửa sai phiếu xuất gốc để phiếu thu được tính lại.'),
  },
  PAYMENT_SOURCE_CONFLICT: {
    message: msg('Phiếu thu tự động không khớp với phiếu xuất gốc.'),
    hint: msg('Tải lại phiếu xuất gốc rồi thực hiện lại.'),
  },
  UPFRONT_REQUIRED: {
    message: msg('Phiếu xuất có khoản trả ngay nhưng chưa được xác nhận.'),
    hint: msg(
      'Kế toán cần xác nhận tiền trả ngay đã thực nhận cho đúng phiên bản phiếu này, rồi mới ghi sổ được. Sửa và nộp lại phiếu không thay cho bước xác nhận.',
    ),
    action: { label: msg('Mở Xác nhận trả ngay'), to: '/upfront-payments' },
  },
  UPFRONT_CONFIRMATION_REQUIRED: {
    message: msg('Phiếu xuất có khoản trả ngay nhưng chưa được xác nhận.'),
    hint: msg('Kế toán cần xác nhận tiền trả ngay trước khi ghi sổ.'),
    action: { label: msg('Mở Xác nhận trả ngay'), to: '/upfront-payments' },
  },
  UPFRONT_CONFLICT: {
    message: msg('Khoản trả ngay không khớp hoặc đã được xử lý.'),
    hint: msg(
      'Số tiền phải đúng bằng khoản trả ngay của phiếu và mỗi phiên bản chỉ xác nhận một lần. Muốn thay nội dung phiếu đã có tiền xác nhận, Kế toán ghi nhận tiền riêng trước.',
    ),
    action: { label: msg('Mở Xác nhận trả ngay'), to: '/upfront-payments' },
  },
  UPFRONT_REVISION_MISMATCH: {
    message: msg('Xác nhận trả ngay thuộc phiên bản phiếu cũ.'),
    hint: msg('Xác nhận lại cho phiên bản hiện tại của phiếu xuất.'),
  },
  VERIFIED_CASH_IMMUTABLE: {
    message: msg('Khoản tiền đã xác nhận không thể sửa.'),
    hint: msg('Dùng Ghi nhận tiền riêng nếu khoản tiền không dùng cho phiếu.'),
  },
  INSUFFICIENT_CREDIT: {
    message: msg('Dư có khả dụng của đại lý không đủ.'),
    hint: msg('Giảm số tiền hoặc chọn lô dư có khác.'),
    action: { label: msg('Mở Hạn mức & Dư có'), to: '/agency-credit' },
  },
  INSUFFICIENT_AVAILABLE_CREDIT: {
    message: msg('Dư có khả dụng của đại lý không đủ.'),
    hint: msg('Giảm số tiền hoặc chọn lô dư có khác.'),
    action: { label: msg('Mở Hạn mức & Dư có'), to: '/agency-credit' },
  },
  CREDIT_RESERVED: {
    message: msg('Dư có đang được giữ chỗ cho một yêu cầu hoàn tiền.'),
    hint: msg(
      'Hoàn tất hoặc hủy yêu cầu hoàn tiền đang giữ chỗ trước khi thay đổi.',
    ),
    action: { label: msg('Mở Hoàn tiền đại lý'), to: '/refunds' },
  },
  REFUND_CONFLICT: {
    message: msg('Bằng chứng chi tiền khác với lần ghi nhận trước.'),
    hint: msg('Tải lại yêu cầu hoàn tiền để xem bằng chứng đã ghi nhận.'),
  },
  REFUND_SOURCE_CONFLICT: {
    message: msg('Nguồn hoàn tiền không hợp lệ.'),
    hint: msg(
      'Hoàn online cần giao dịch trực tuyến gốc thành công; ngày chi không được trước phiếu thu gốc; khoản đã chi không thể đổi.',
    ),
  },
  REFUND_EXCEEDS_ORIGINAL_RECEIPT: {
    message: msg('Số tiền hoàn vượt khoản thu gốc.'),
    hint: msg('Giảm số tiền hoàn.'),
  },
  PAID_REFUND_IMMUTABLE: {
    message: msg('Yêu cầu hoàn tiền đã chi nên không thể hủy hay sửa.'),
  },
  REFUND_OUTCOME_UNKNOWN: {
    message: msg('Chưa rõ kết quả hoàn tiền tại cổng thanh toán.'),
    hint: msg('Bấm đối soát để hỏi lại cổng thanh toán.'),
  },
  RETURN_QUANTITY_CONFLICT: {
    message: msg('Số lượng trả vượt số lượng đã bán.'),
    hint: msg('Tổng các lần trả của mỗi dòng không được vượt số lượng xuất.'),
  },
  RETURN_QUANTITY_EXCEEDED: {
    message: msg('Số lượng trả vượt số lượng đã bán.'),
    hint: msg('Giảm số lượng trả.'),
  },
  RETURN_SOURCE_CONFLICT: {
    message: msg('Dòng trả không khớp với phiếu xuất gốc.'),
    hint: msg('Chọn lại phiếu xuất gốc đã ghi sổ và các dòng của phiếu đó.'),
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
  INVALID_WEBHOOK_SIGNATURE: {
    message: msg('Chữ ký từ cổng thanh toán không hợp lệ.'),
    hint: msg('Không coi giao dịch là thành công; đối soát lại với cổng.'),
  },
  PROVIDER_AMOUNT_MISMATCH: {
    message: msg('Số tiền từ cổng thanh toán không khớp.'),
    hint: msg('Đối soát lại giao dịch trước khi xử lý tiếp.'),
  },
  PROVIDER_REFERENCE_NOT_FOUND: {
    message: msg('Cổng thanh toán không tìm thấy giao dịch hoàn tiền.'),
    hint: msg('Giao dịch chưa được tạo ở cổng; có thể gửi lại yêu cầu hoàn.'),
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
