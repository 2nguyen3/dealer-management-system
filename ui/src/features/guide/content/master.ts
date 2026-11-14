import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const masterGuides: readonly GuideContent[] = [
  {
    path: '/agencies',
    purpose: msg(
      'Hồ sơ đại lý dùng để tiếp nhận đại lý mới, cập nhật thông tin, theo dõi nợ hiện tại so với nợ tối đa và ngừng hợp tác khi cần.',
    ),
    roles: [
      msg(
        'Kinh doanh: tiếp nhận, sửa hồ sơ, ngừng hợp tác (quyền tiếp nhận/cập nhật đại lý).',
      ),
      msg('Kho, Kế toán: tra cứu hồ sơ và nợ (quyền tra cứu đại lý).'),
      msg('Quản lý: làm được mọi thao tác.'),
    ],
    flow: [
      { label: msg('Tiếp nhận đại lý mới'), role: msg('Kinh doanh') },
      { label: msg('Cập nhật hồ sơ khi có thay đổi'), role: msg('Kinh doanh') },
      { label: msg('Lập phiếu xuất, thu tiền cho đại lý') },
      { label: msg('Thu hết nợ rồi ngừng hợp tác'), role: msg('Kinh doanh') },
    ],
    steps: [
      msg('Bấm Tiếp nhận đại lý mới.'),
      msg(
        'Nhập Tên đại lý, Số điện thoại, Email, Địa chỉ, chọn Phường/xã (gồm cả đặc khu), Loại đại lý và Ngày tiếp nhận.',
      ),
      msg('Bấm Tiếp nhận để lưu hồ sơ. Hệ thống tự cấp mã đại lý.'),
      msg(
        'Tìm theo tên hoặc số điện thoại; lọc theo phường/xã, loại đại lý, trạng thái.',
      ),
      msg(
        'Xem cột Nợ hiện tại, Nợ tối đa và thanh mức sử dụng để biết đại lý nào sắp chạm hạn mức.',
      ),
      msg('Bấm Sửa hồ sơ, chỉnh thông tin rồi bấm Lưu thay đổi.'),
      msg(
        'Bấm Ngừng hợp tác, nhập Lý do ngừng hợp tác rồi bấm Xác nhận ngừng hợp tác.',
      ),
    ],
    rules: [
      msg(
        'Mỗi phường/xã chỉ có tối đa số đại lý đang hoạt động theo quy định hiện hành.',
      ),
      msg(
        'Loại đại lý quyết định nợ tối đa. Không đổi được sang loại có nợ tối đa thấp hơn nợ hiện tại.',
      ),
      msg(
        'Nợ hiện tại tăng khi ghi sổ phiếu xuất và giảm khi ghi sổ phiếu thu. Nợ âm nghĩa là đại lý đã trả trước.',
      ),
      msg(
        'Chỉ ngừng hợp tác được khi nợ hiện tại bằng 0. Ngừng hợp tác không mở lại được và đại lý không dùng được cho chứng từ mới.',
      ),
      msg('Ngày chứng từ của đại lý không được trước ngày tiếp nhận.'),
    ],
    errors: [
      'WARD_CAPACITY_EXCEEDED',
      'LIMIT_CONFLICT',
      'AGENCY_HAS_DEBT',
      'AGENCY_CONFLICT',
      'STATE_CONFLICT',
      'PRECONDITION_FAILED',
    ],
    related: [
      '/agency-types',
      '/business-rules',
      '/stock-issues',
      '/payment-receipts',
    ],
  },
  {
    path: '/products',
    purpose: msg(
      'Danh mục mặt hàng quản lý tên, đơn vị tính, trạng thái và cho xem tồn kho, giá nhập gần nhất, giá bán hiện tại.',
    ),
    roles: [
      msg('Kho: thêm, sửa, xóa mặt hàng (quyền quản lý mặt hàng).'),
      msg(
        'Kinh doanh, Kế toán: xem danh mục (quyền lập/ghi sổ phiếu nhập, phiếu xuất hoặc xem báo cáo).',
      ),
    ],
    steps: [
      msg('Bấm Thêm mới.'),
      msg(
        'Nhập Tên mặt hàng, chọn Đơn vị tính và Trạng thái, rồi bấm Tạo mới.',
      ),
      msg(
        'Tìm theo mã hoặc tên; xem các cột Tồn, Giá nhập gần nhất và Giá bán.',
      ),
      msg('Bấm Chi tiết để xem và sửa, sau đó bấm Lưu thay đổi.'),
      msg(
        'Bấm Xóa chỉ khi mặt hàng chưa phát sinh chứng từ; nếu đã dùng, chuyển Trạng thái sang ngừng hoạt động.',
      ),
    ],
    rules: [
      msg(
        'Tồn kho tăng khi ghi sổ phiếu nhập và giảm khi ghi sổ phiếu xuất; không nhập tay tồn hay giá ở đây.',
      ),
      msg(
        'Giá nhập gần nhất là đơn giá của phiếu nhập ghi sổ gần nhất. Giá bán = giá nhập gần nhất × tỷ lệ giá bán, làm tròn đến đồng.',
      ),
      msg(
        'Mặt hàng chưa có phiếu nhập ghi sổ thì chưa có giá bán, chưa xuất được.',
      ),
      msg('Mặt hàng đã có chứng từ thì không đổi được đơn vị tính.'),
      msg('Mặt hàng ngừng hoạt động không dùng được trong chứng từ mới.'),
    ],
    errors: [
      'USED_UNIT_IMMUTABLE',
      'RESOURCE_IN_USE',
      'INACTIVE_MASTER',
      'PRODUCT_NOT_PRICED',
    ],
    related: ['/units', '/stock-receipts', '/stock-issues', '/business-rules'],
  },
  {
    path: '/agency-types',
    purpose: msg(
      'Loại đại lý phân nhóm đại lý và đặt giới hạn nợ tối đa cho mỗi đại lý thuộc loại đó.',
    ),
    roles: [
      msg('Quản lý: thêm, sửa, xóa loại (quyền quản lý loại đại lý).'),
      msg('Kinh doanh, Kho, Kế toán: xem (quyền tra cứu đại lý).'),
    ],
    steps: [
      msg('Bấm Thêm mới.'),
      msg(
        'Nhập Mã loại, Tên loại đại lý, Giới hạn nợ (VND) và Trạng thái, rồi bấm Tạo mới.',
      ),
      msg('Bấm Chi tiết để sửa, sau đó bấm Lưu thay đổi.'),
      msg(
        'Bấm Xóa chỉ khi loại chưa có đại lý; nếu đã có, chuyển Trạng thái sang ngừng hoạt động.',
      ),
    ],
    rules: [
      msg(
        'Giới hạn nợ là hạn mức nợ của từng đại lý thuộc loại, không phải tổng của cả loại.',
      ),
      msg(
        'Không hạ giới hạn nợ xuống dưới nợ hiện tại của bất kỳ đại lý nào thuộc loại.',
      ),
      msg('Giới hạn mới áp dụng ngay cho lần ghi sổ phiếu xuất tiếp theo.'),
    ],
    errors: [
      'DEBT_LIMIT_BELOW_CURRENT_BALANCE',
      'RESOURCE_IN_USE',
      'DUPLICATE_CODE',
      'PRECONDITION_FAILED',
    ],
    related: ['/agencies', '/stock-issues'],
  },
  {
    path: '/units',
    purpose: msg(
      'Đơn vị tính dùng cho mặt hàng và quyết định số lượng có được nhập số lẻ hay không.',
    ),
    roles: [
      msg('Kho: thêm, sửa, xóa đơn vị (quyền quản lý đơn vị tính).'),
      msg('Kho: xem khi lập phiếu nhập (quyền lập phiếu nhập).'),
    ],
    steps: [
      msg('Bấm Thêm mới.'),
      msg(
        'Nhập Mã đơn vị, Tên đơn vị, chọn Cho phép số lẻ và Trạng thái, rồi bấm Tạo mới.',
      ),
      msg('Bấm Chi tiết để sửa, sau đó bấm Lưu thay đổi.'),
      msg('Bấm Xóa chỉ khi đơn vị chưa được mặt hàng nào dùng.'),
    ],
    rules: [
      msg(
        'Đơn vị không cho số lẻ chỉ nhận số lượng nguyên; đơn vị cho số lẻ nhận tối đa 3 chữ số thập phân.',
      ),
      msg(
        'Đơn vị đã dùng trong chứng từ thì không đổi được lựa chọn Cho phép số lẻ.',
      ),
    ],
    errors: [
      'MASTER_CONFLICT',
      'RESOURCE_IN_USE',
      'FRACTION_NOT_ALLOWED',
      'QUANTITY_PRECISION_EXCEEDED',
      'DUPLICATE_CODE',
    ],
    related: ['/products'],
  },
  {
    path: '/business-rules',
    purpose: msg(
      'Thay đổi quy định gồm số đại lý tối đa mỗi phường/xã và tỷ lệ giá bán so với giá nhập gần nhất.',
    ),
    roles: [
      msg('Quản lý: thay đổi quy định (quyền thay đổi quy định).'),
      msg('Kinh doanh, Kho: chỉ xem quy định đang áp dụng.'),
    ],
    flow: [
      { label: msg('Xem quy định đang áp dụng'), role: msg('Quản lý') },
      { label: msg('Sửa số liệu và lưu'), role: msg('Quản lý') },
      {
        label: msg('Áp dụng cho chứng từ và hồ sơ lập sau khi lưu'),
      },
    ],
    steps: [
      msg('Xem khối Quy định đang áp dụng ở đầu trang.'),
      msg(
        'Ô Số đại lý tối đa mỗi phường/xã: giới hạn số đại lý đang hoạt động trong cùng một phường/xã.',
      ),
      msg(
        'Ô Hệ số giá bán: giá bán = giá nhập gần nhất × tỷ lệ. Xem ví dụ giá bán tương ứng ngay bên cạnh.',
      ),
      msg('Bấm Lưu thay đổi quy định để áp dụng.'),
      msg('Nếu báo dữ liệu đã thay đổi, bấm Tải lại quy định rồi sửa lại.'),
    ],
    rules: [
      msg(
        'Hệ số giá bán phải dương, tối đa 3 chữ số nguyên và 6 chữ số thập phân.',
      ),
      msg(
        'Tỷ lệ mới chỉ ảnh hưởng phiếu xuất ghi sổ sau khi lưu; phiếu đã ghi sổ giữ đơn giá đã chốt.',
      ),
      msg(
        'Số đại lý tối đa áp dụng khi tiếp nhận đại lý mới hoặc đổi phường/xã.',
      ),
      msg(
        'Không hạ số đại lý tối đa xuống dưới số đại lý đang hoạt động tại một phường/xã bất kỳ.',
      ),
    ],
    errors: ['LIMIT_CONFLICT', 'VALIDATION_FAILED', 'PRECONDITION_FAILED'],
    related: ['/agencies', '/products', '/stock-issues'],
  },
]
