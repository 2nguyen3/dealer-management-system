import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const goodsGuides: readonly GuideContent[] = [
  {
    path: '/stock-receipts',
    purpose: msg(
      'Phiếu nhập hàng ghi nhận hàng nhập vào kho và giá nhập. Giá nhập là cơ sở để hệ thống tính giá bán cho phiếu xuất.',
    ),
    roles: [
      msg(
        'Kho: lập phiếu (quyền lập phiếu nhập) và ghi sổ (quyền xác nhận nhập).',
      ),
      msg('Kinh doanh: xem phiếu (quyền tra cứu tồn kho).'),
      msg('Quản lý: Sửa sai và Hủy phiếu đã ghi sổ.'),
    ],
    flow: [
      { label: msg('Tạo phiếu nhập nháp'), role: msg('Kho') },
      { label: msg('Kiểm tra nội dung'), role: msg('Kho') },
      {
        label: msg('Ghi sổ: tăng tồn kho, cập nhật giá nhập'),
        role: msg('Kho'),
      },
    ],
    steps: [
      msg('Bấm Tạo phiếu.'),
      msg('Chọn Ngày nghiệp vụ, nhập Ghi chú nếu cần.'),
      msg(
        'Ở Danh sách dòng hàng, chọn mặt hàng, nhập số lượng và Đơn giá nhập (VNĐ). Bấm Thêm dòng cho mặt hàng tiếp theo.',
      ),
      msg('Bấm Lưu nháp. Phiếu ở trạng thái Nháp.'),
      msg(
        'Mở Chi tiết để kiểm tra. Sửa thông tin nháp chỉ đổi được ngày và ghi chú.',
      ),
      msg('Bấm Ghi sổ rồi Xác nhận ghi sổ.'),
      msg(
        'Nếu phát hiện sai sau khi ghi sổ, bấm Sửa sai hoặc Hủy phiếu và nhập lý do.',
      ),
    ],
    rules: [
      msg('Mỗi mặt hàng chỉ một dòng; số lượng và đơn giá phải lớn hơn 0.'),
      msg(
        'Ghi sổ làm tăng tồn kho. Giá nhập hiện hành của mặt hàng là đơn giá của phiếu nhập còn hiệu lực mới nhất.',
      ),
      msg(
        'Giá nhập mới chỉ ảnh hưởng phiếu xuất nộp sau; phiếu xuất đã nộp giữ giá đã chốt.',
      ),
      msg('Phiếu nhập không làm thay đổi công nợ hay tiền.'),
      msg(
        'Hủy hoặc sửa phiếu nhập bị từ chối nếu làm tồn kho bị âm ở một thời điểm nào đó.',
      ),
    ],
    errors: [
      'EMPTY_DOCUMENT',
      'DUPLICATE_PRODUCT',
      'INACTIVE_MASTER',
      'INVALID_QUANTITY',
      'STOCK_CONFLICT',
      'STATE_CONFLICT',
    ],
    tips: [
      msg(
        'Mặt hàng mới phải có ít nhất một phiếu nhập đã ghi sổ thì mới lập phiếu xuất được.',
      ),
      msg('Nháp sai dòng hàng: bấm Hủy phiếu với nháp đó rồi tạo phiếu mới.'),
    ],
    related: [
      '/inventory',
      '/products',
      '/stock-issues',
      '/document-corrections',
    ],
  },
  {
    path: '/stock-issues',
    purpose: msg(
      'Phiếu xuất hàng ghi nhận hàng giao cho đại lý. Khi ghi sổ, tồn kho giảm và công nợ đại lý tăng; khoản trả ngay (nếu có) được ghi thành phiếu thu.',
    ),
    roles: [
      msg(
        'Kinh doanh: lập, nộp và thay nội dung chờ xuất (quyền lập phiếu xuất).',
      ),
      msg(
        'Kế toán: xác minh tiền trả ngay ở trang Xác nhận trả ngay (quyền xác nhận khoản trả ngay).',
      ),
      msg('Kho: ghi sổ phiếu xuất (quyền xác nhận xuất).'),
      msg('Quản lý: Sửa sai và Hủy phiếu.'),
    ],
    flow: [
      { label: msg('Lập phiếu nháp'), role: msg('Kinh doanh') },
      {
        label: msg('Nộp phiếu: chốt giá, kiểm tra tồn kho và hạn mức nợ'),
        role: msg('Kinh doanh'),
      },
      {
        label: msg('Xác minh tiền trả ngay (chỉ khi trả ngay lớn hơn 0)'),
        role: msg('Kế toán'),
      },
      { label: msg('Ghi sổ xuất kho'), role: msg('Kho') },
      { label: msg('Hệ thống tự lập phiếu thu cho khoản trả ngay') },
    ],
    steps: [
      msg('Bấm Tạo phiếu, chọn Đại lý đang hoạt động và Ngày nghiệp vụ.'),
      msg(
        'Nhập Trả ngay dự kiến (VNĐ): số tiền đại lý trả ngay khi nhận hàng. Nhập 0 nếu ghi nợ toàn bộ.',
      ),
      msg(
        'Thêm dòng hàng gồm mặt hàng và số lượng; đơn giá do hệ thống tính. Bấm Lưu nháp.',
      ),
      msg(
        'Mở Chi tiết, kiểm tra rồi bấm Nộp phiếu. Phiếu chuyển Chờ xử lý, phiên bản chuyển Sẵn sàng và giá được chốt.',
      ),
      msg(
        'Nếu có trả ngay: báo Kế toán vào Xác nhận trả ngay, bấm Ghi nhận tiền thực nhận và chọn đúng phiếu này. Chưa có bước này thì chưa ghi sổ được.',
      ),
      msg(
        'Khi tiền đã được xác minh (hoặc phiếu không có trả ngay), Kho bấm Ghi sổ rồi Xác nhận ghi sổ.',
      ),
      msg(
        'Muốn đổi nội dung khi phiếu đang chờ: bấm Thay nội dung chờ xuất, nhập Lý do, bấm Lưu thay thế. Phiếu về Nháp và phải Nộp phiếu lại.',
      ),
      msg('Sai sót sau khi ghi sổ: bấm Sửa sai hoặc Hủy phiếu và nhập lý do.'),
    ],
    rules: [
      msg(
        'Đơn giá xuất bằng giá nhập hiện hành nhân hệ số giá bán, làm tròn đến đồng, và được chốt khi Nộp phiếu.',
      ),
      msg(
        'Khi nộp: công nợ hiện tại cộng tổng phiếu trừ trả ngay không được vượt hạn mức nợ. Trả ngay không được lớn hơn tổng phiếu.',
      ),
      msg(
        'Ghi sổ: tồn kho giảm, công nợ tăng bằng tổng phiếu; tiền trả ngay đã xác minh tự thành phiếu thu trả cho chính phiếu này.',
      ),
      msg(
        'Sửa rồi nộp lại phiếu KHÔNG thay cho bước xác minh tiền. Mỗi phiên bản mới cần Kế toán xác minh lại.',
      ),
      msg(
        'Tiền đã được xác minh thì không Thay nội dung chờ xuất được. Kế toán phải Ghi nhận tiền riêng trước.',
      ),
      msg('Đại lý đã ngừng hợp tác không được xuất hàng.'),
    ],
    errors: [
      'UPFRONT_REQUIRED',
      'UPFRONT_CONFLICT',
      'LIMIT_CONFLICT',
      'INSUFFICIENT_STOCK',
      'PRICE_SOURCE_REQUIRED',
      'INVALID_TOTAL',
    ],
    tips: [
      msg(
        'Bấm Ghi sổ mà báo trả ngay chưa được xác nhận: đừng sửa hay nộp lại phiếu. Nhờ Kế toán xác minh tiền ở trang Xác nhận trả ngay rồi ghi sổ lại.',
      ),
      msg(
        'Nháp sai dòng hàng: Sửa thông tin nháp chỉ đổi ngày và ghi chú; hãy Hủy phiếu nháp rồi tạo phiếu mới.',
      ),
    ],
    related: [
      '/upfront-payments',
      '/receivables',
      '/inventory',
      '/business-rules',
    ],
  },
  {
    path: '/sales-returns',
    purpose: msg(
      'Phiếu trả hàng nhận lại hàng đại lý trả theo một phiếu xuất gốc đã ghi sổ. Hàng được nhập lại kho và công nợ giảm hoặc thành dư có.',
    ),
    roles: [
      msg('Kho: lập và ghi sổ (quyền lập trả hàng, xác nhận trả hàng).'),
      msg('Kinh doanh, Kế toán: xem (quyền tra cứu doanh số hoặc công nợ).'),
      msg('Quản lý: Sửa sai và Hủy phiếu.'),
    ],
    flow: [
      { label: msg('Tạo phiếu trả từ phiếu xuất gốc'), role: msg('Kho') },
      { label: msg('Kiểm tra số lượng trả'), role: msg('Kho') },
      { label: msg('Ghi sổ'), role: msg('Kho') },
      { label: msg('Tồn kho tăng; công nợ giảm hoặc thành dư có') },
    ],
    steps: [
      msg('Bấm Tạo phiếu.'),
      msg('Chọn Phiếu xuất gốc. Chỉ chọn được phiếu xuất đã ghi sổ.'),
      msg('Chọn Ngày nghiệp vụ, không trước ngày của phiếu xuất gốc.'),
      msg(
        'Với mỗi dòng, chọn dòng hàng đã bán và nhập số lượng trả. Đơn giá lấy theo phiếu xuất gốc.',
      ),
      msg('Bấm Lưu nháp, mở Chi tiết để kiểm tra.'),
      msg('Bấm Ghi sổ rồi Xác nhận ghi sổ.'),
    ],
    rules: [
      msg(
        'Tổng số lượng trả qua các lần không được vượt số lượng đã bán của từng dòng.',
      ),
      msg(
        'Giá trị trả tính theo đơn giá gốc và làm tròn lũy kế qua các lần trả, nên tổng không vượt giá trị đã bán.',
      ),
      msg(
        'Ghi sổ: giảm nợ còn lại của chính phiếu xuất gốc trước; phần vượt (hóa đơn đã trả bằng tiền) thành dư có cho đại lý.',
      ),
      msg('Đại lý đã ngừng hợp tác vẫn được trả hàng.'),
      msg('Phiếu xuất còn phiếu trả hàng có hiệu lực thì không hủy được.'),
    ],
    errors: [
      'RETURN_QUANTITY_CONFLICT',
      'RETURN_SOURCE_CONFLICT',
      'INVALID_QUANTITY',
      'DUPLICATE_PRODUCT',
      'EMPTY_DOCUMENT',
    ],
    tips: [
      msg(
        'Dư có phát sinh từ trả hàng có thể dùng để bù trừ công nợ hoặc hoàn tiền cho đại lý.',
      ),
    ],
    related: ['/stock-issues', '/receivables', '/agency-credit', '/refunds'],
  },
  {
    path: '/stock-adjustments',
    purpose: msg(
      'Điều chỉnh kho tăng hoặc giảm tồn kho khi có hư hỏng, mất mát hoặc sai lệch, luôn kèm lý do.',
    ),
    roles: [
      msg('Kho: lập phiếu (quyền lập điều chỉnh kho).'),
      msg(
        'Quản lý: duyệt bằng Ghi sổ (quyền duyệt điều chỉnh kho; mặc định chỉ nhóm Quản lý có).',
      ),
      msg('Kinh doanh: xem (quyền tra cứu tồn kho).'),
    ],
    flow: [
      { label: msg('Lập phiếu điều chỉnh kèm lý do'), role: msg('Kho') },
      { label: msg('Duyệt và ghi sổ'), role: msg('Quản lý') },
      { label: msg('Tồn kho thay đổi theo số lượng điều chỉnh') },
    ],
    steps: [
      msg('Bấm Tạo phiếu.'),
      msg('Chọn Ngày nghiệp vụ, nhập Lý do (bắt buộc) và Ghi chú.'),
      msg(
        'Với mỗi dòng, chọn mặt hàng, chọn Hướng Tăng hoặc Giảm và nhập số lượng. Bấm Thêm dòng nếu cần.',
      ),
      msg('Bấm Lưu nháp.'),
      msg('Quản lý mở Chi tiết, kiểm tra rồi bấm Ghi sổ và Xác nhận ghi sổ.'),
      msg('Sai sót sau khi ghi sổ: bấm Sửa sai hoặc Hủy phiếu và nhập lý do.'),
    ],
    rules: [
      msg('Phiếu điều chỉnh bắt buộc có lý do và ít nhất một dòng.'),
      msg(
        'Điều chỉnh giảm không được làm tồn kho bị âm ở bất kỳ thời điểm nào.',
      ),
      msg('Điều chỉnh kho không tác động công nợ hay tiền.'),
      msg(
        'Phiếu điều chỉnh sinh từ kiểm kê được ghi sổ cùng biên bản và không sửa hay hủy riêng.',
      ),
    ],
    errors: [
      'REASON_REQUIRED',
      'STOCK_CONFLICT',
      'EMPTY_DOCUMENT',
      'DUPLICATE_PRODUCT',
      'COUNT_LINKED_ADJUSTMENT',
      'FORBIDDEN',
    ],
    tips: [
      msg(
        'Nếu cần đối chiếu toàn bộ kho, dùng Kiểm kê kho; hệ thống sẽ tự lập phiếu điều chỉnh cho phần chênh lệch.',
      ),
    ],
    related: ['/stock-counts', '/inventory', '/document-corrections'],
  },
  {
    path: '/stock-counts',
    purpose: msg(
      'Kiểm kê kho so sánh số đếm thực tế với tồn trên sổ. Khi xác nhận, phần chênh lệch tự thành phiếu điều chỉnh kho.',
    ),
    roles: [
      msg('Kho: lập, đếm và xác nhận kiểm kê (quyền kiểm kê).'),
      msg(
        'Khi có chênh lệch, người xác nhận cần thêm quyền duyệt điều chỉnh kho (mặc định nhóm Quản lý).',
      ),
    ],
    flow: [
      { label: msg('Lập biên bản kiểm kê'), role: msg('Kho') },
      { label: msg('Nhập số đếm thực tế'), role: msg('Kho') },
      { label: msg('Đếm lại toàn bộ nếu sổ đã thay đổi'), role: msg('Kho') },
      { label: msg('Xác nhận kiểm kê'), role: msg('Quản lý') },
      {
        label: msg('Hệ thống tự lập và ghi sổ phiếu điều chỉnh cho dòng lệch'),
      },
    ],
    steps: [
      msg('Bấm Lập kiểm kê, nhập Thời điểm đếm và Lý do kiểm kê.'),
      msg(
        'Bấm Thêm mặt hàng, chọn mặt hàng và nhập số đếm thực tế, rồi bấm Lưu số đếm.',
      ),
      msg('Mở Chi tiết để xem Chênh lệch theo mặt hàng giữa số sổ và số đếm.'),
      msg(
        'Sửa một dòng bằng nút Sửa; sửa thời điểm hoặc lý do bằng Sửa thông tin kiểm kê.',
      ),
      msg(
        'Nếu có phiếu kho mới ghi sổ sau lúc đếm, bấm Đếm lại toàn bộ và nhập lại số đếm cho mọi mặt hàng đã có.',
      ),
      msg('Bấm Xác nhận kiểm kê rồi Xác nhận.'),
    ],
    rules: [
      msg(
        'Số sổ được chụp lúc đếm. Nếu sau đó có chứng từ kho ghi sổ, phải đếm lại trước khi xác nhận.',
      ),
      msg(
        'Đếm lại phải gồm đúng mọi mặt hàng đã có trong biên bản, mỗi mặt hàng một lần.',
      ),
      msg(
        'Có chênh lệch thì bắt buộc có lý do; phiếu điều chỉnh tự sinh lấy ngày đếm làm ngày nghiệp vụ.',
      ),
      msg('Mọi dòng khớp sổ thì không sinh phiếu điều chỉnh.'),
      msg(
        'Biên bản đã xác nhận không sửa được; phiếu điều chỉnh sinh từ kiểm kê không sửa hay hủy riêng.',
      ),
    ],
    errors: [
      'STALE_STOCK_SNAPSHOT',
      'RECOUNT_PRODUCTS',
      'EMPTY_COUNT',
      'REASON_REQUIRED',
      'DUPLICATE_PRODUCT',
      'INVALID_QUANTITY',
    ],
    related: ['/stock-adjustments', '/inventory'],
  },
]
