import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const masterGuides: readonly GuideContent[] = [
  {
    path: '/agencies',
    purpose: msg(
      'Hồ sơ đại lý dùng để tiếp nhận đại lý mới, cập nhật thông tin, xem dư nợ và ngừng hợp tác khi cần.',
    ),
    roles: [
      msg(
        'Kinh doanh: tiếp nhận, sửa hồ sơ, ngừng hợp tác (quyền tiếp nhận/cập nhật đại lý).',
      ),
      msg('Kho, Kế toán: tra cứu hồ sơ (quyền tra cứu đại lý).'),
      msg('Quản lý: làm được mọi thao tác.'),
    ],
    flow: [
      { label: msg('Tiếp nhận đại lý mới'), role: msg('Kinh doanh') },
      { label: msg('Cập nhật hồ sơ khi có thay đổi'), role: msg('Kinh doanh') },
      { label: msg('Lập phiếu xuất, thu tiền cho đại lý') },
      { label: msg('Ngừng hợp tác khi chấm dứt'), role: msg('Kinh doanh') },
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
      msg('Bấm Xem chi tiết để xem dư nợ, dư có và mức dùng hạn mức.'),
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
        'Loại đại lý quyết định hạn mức nợ. Không đổi được sang loại có hạn mức thấp hơn công nợ hiện tại.',
      ),
      msg(
        'Ngừng hợp tác không mở lại được. Đại lý đã ngừng không được xuất hàng mới, nhưng vẫn thu nợ và nhận trả hàng.',
      ),
      msg('Ngày chứng từ của đại lý không được trước ngày tiếp nhận.'),
      msg('Đại lý đã có giao dịch không xóa được, chỉ ngừng hợp tác.'),
    ],
    errors: [
      'WARD_CAPACITY_EXCEEDED',
      'LIMIT_CONFLICT',
      'INACTIVE_MASTER',
      'RESOURCE_IN_USE',
      'STATE_CONFLICT',
      'PRECONDITION_FAILED',
    ],
    related: [
      '/agency-types',
      '/business-rules',
      '/receivables',
      '/agency-credit',
    ],
  },
  {
    path: '/products',
    purpose: msg(
      'Danh mục mặt hàng quản lý tên, đơn vị tính, ngưỡng cảnh báo tồn thấp, và cho xem tồn kho, giá nhập, giá bán hiện tại.',
    ),
    roles: [
      msg('Kho: thêm, sửa, xóa mặt hàng (quyền quản lý mặt hàng).'),
      msg('Kinh doanh: xem danh mục (quyền tra cứu tồn kho).'),
    ],
    steps: [
      msg('Bấm Thêm mới.'),
      msg(
        'Nhập Tên mặt hàng, chọn Đơn vị tính, nhập Ngưỡng tồn thấp và Trạng thái, rồi bấm Tạo mới.',
      ),
      msg(
        'Tìm theo mã hoặc tên; xem cột Tồn / ngưỡng để biết mặt hàng nào Dưới ngưỡng.',
      ),
      msg('Bấm Chi tiết để xem và sửa, sau đó bấm Lưu thay đổi.'),
      msg(
        'Bấm Xóa chỉ khi mặt hàng chưa phát sinh chứng từ; nếu đã dùng, chuyển Trạng thái sang ngừng hoạt động.',
      ),
    ],
    rules: [
      msg(
        'Giá nhập hiện hành lấy từ phiếu nhập đã ghi sổ còn hiệu lực mới nhất; không nhập tay giá ở đây.',
      ),
      msg(
        'Giá bán bằng giá nhập hiện hành nhân hệ số giá bán, làm tròn đến đồng.',
      ),
      msg(
        'Mặt hàng chưa có phiếu nhập ghi sổ thì chưa có giá, chưa lập phiếu xuất được.',
      ),
      msg('Mặt hàng đã có chứng từ thì không đổi được đơn vị tính.'),
      msg('Mặt hàng ngừng hoạt động không dùng được trong chứng từ mới.'),
    ],
    errors: [
      'USED_UNIT_IMMUTABLE',
      'RESOURCE_IN_USE',
      'INACTIVE_MASTER',
      'PRICE_SOURCE_REQUIRED',
    ],
    related: ['/units', '/inventory', '/stock-receipts', '/business-rules'],
  },
  {
    path: '/inventory',
    purpose: msg(
      'Tồn kho & Thẻ kho cho xem tồn hiện tại của từng mặt hàng và lịch sử nhập, xuất, tồn theo thời gian.',
    ),
    roles: [msg('Kinh doanh, Kho: xem tồn kho (quyền tra cứu tồn kho).')],
    steps: [
      msg(
        'Xem các chỉ số: Mặt hàng đang theo dõi, Sắp hết hàng và Giá trị tồn kho theo giá nhập hiện hành.',
      ),
      msg(
        'Lọc theo mã hoặc tên; chọn tình trạng Sắp hết để xem mặt hàng dưới ngưỡng.',
      ),
      msg(
        'Bấm Thẻ kho trên một dòng để xem từng lần nhập, xuất, trả, điều chỉnh và số tồn sau mỗi lần.',
      ),
    ],
    rules: [
      msg(
        'Tồn kho chỉ thay đổi khi ghi sổ phiếu nhập, phiếu xuất, phiếu trả hàng hoặc điều chỉnh kho.',
      ),
      msg('Nháp và phiếu xuất chờ ghi sổ chưa làm giảm tồn kho.'),
      msg(
        'Tồn kho không được âm ở bất kỳ thời điểm nào, kể cả khi ghi sổ hoặc sửa chứng từ lùi ngày.',
      ),
    ],
    errors: ['INSUFFICIENT_STOCK', 'STOCK_CONFLICT', 'FORBIDDEN'],
    tips: [
      msg(
        'Nếu tồn trên sổ khác tồn thực tế, lập Kiểm kê kho thay vì sửa trực tiếp.',
      ),
    ],
    related: ['/stock-receipts', '/stock-issues', '/stock-counts', '/products'],
  },
  {
    path: '/agency-credit',
    purpose: msg(
      'Hạn mức & Dư có cho xem hạn mức nợ, dư có, phần đang giữ chỗ và từng khoản dư có của một đại lý.',
    ),
    roles: [
      msg(
        'Kế toán: xem để bù trừ dư có hoặc hoàn tiền (quyền tra cứu công nợ, bù trừ dư có hoặc xác nhận hoàn tiền).',
      ),
      msg('Kinh doanh: xem (quyền tra cứu công nợ).'),
    ],
    steps: [
      msg('Chọn Đại lý rồi bấm Xem dư có.'),
      msg('Xem hạn mức nợ, tổng dư có, phần Đang giữ và phần Khả dụng.'),
      msg(
        'Bảng Các khoản dư có cho biết chứng từ nguồn, phiếu thu gốc và số dư của từng khoản.',
      ),
      msg('Bấm Mở sổ dư có để xem diễn biến tăng, giảm theo thời gian.'),
    ],
    rules: [
      msg(
        'Dư có là tiền thật đại lý đã trả vượt phần nợ. Đây là khoản phải trả lại cho đại lý, không phải nợ âm.',
      ),
      msg(
        'Dư có phát sinh khi tiền trực tuyến hoặc tiền thu riêng vượt nợ, hoặc khi trả hàng cho hóa đơn đã trả bằng tiền.',
      ),
      msg(
        'Mỗi khoản nhớ phiếu thu gốc. Hoàn tiền chỉ lấy từ khoản của chính phiếu thu đó.',
      ),
      msg(
        'Dư có khả dụng bằng dư có trừ phần đang giữ chỗ cho yêu cầu hoàn tiền. Khoản cũ được dùng trước.',
      ),
      msg('Hạn mức nợ lấy theo loại đại lý.'),
    ],
    errors: ['INSUFFICIENT_CREDIT', 'CREDIT_RESERVED', 'FORBIDDEN'],
    related: [
      '/credit-applications',
      '/refunds',
      '/receivables',
      '/agency-types',
    ],
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
        'Không hạ giới hạn nợ xuống dưới công nợ hiện tại của bất kỳ đại lý nào thuộc loại.',
      ),
      msg(
        'Giới hạn mới áp dụng ngay cho lần nộp và ghi sổ phiếu xuất tiếp theo.',
      ),
    ],
    errors: [
      'DEBT_LIMIT_BELOW_CURRENT_BALANCE',
      'RESOURCE_IN_USE',
      'DUPLICATE_CODE',
      'PRECONDITION_FAILED',
    ],
    related: ['/agencies', '/agency-credit', '/receivables'],
  },
  {
    path: '/units',
    purpose: msg(
      'Đơn vị tính dùng cho mặt hàng và quyết định số lượng có được nhập số lẻ hay không.',
    ),
    roles: [
      msg('Kho: thêm, sửa, xóa đơn vị (quyền quản lý đơn vị tính).'),
      msg('Kinh doanh: xem (quyền tra cứu tồn kho).'),
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
        'Đơn vị đã dùng trong chứng từ hoặc kiểm kê thì không đổi được lựa chọn Cho phép số lẻ.',
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
      'Thay đổi quy định gồm số đại lý tối đa mỗi phường/xã và hệ số giá bán so với giá nhập.',
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
        'Ô Hệ số giá bán: giá bán bằng giá nhập nhân hệ số. Xem ví dụ giá bán tương ứng ngay bên cạnh.',
      ),
      msg('Bấm Lưu thay đổi quy định để áp dụng.'),
      msg('Nếu báo dữ liệu đã thay đổi, bấm Tải lại quy định rồi sửa lại.'),
    ],
    rules: [
      msg(
        'Hệ số giá bán phải dương, tối đa 3 chữ số nguyên và 6 chữ số thập phân.',
      ),
      msg(
        'Hệ số mới chỉ ảnh hưởng phiếu xuất nộp sau khi lưu; phiếu đã nộp hoặc đã ghi sổ giữ giá đã chốt.',
      ),
      msg(
        'Số đại lý tối đa áp dụng khi tiếp nhận đại lý mới hoặc đổi phường/xã.',
      ),
      msg(
        'Không hạ số đại lý tối đa xuống dưới số đại lý đang hoạt động tại một phường/xã bất kỳ.',
      ),
    ],
    errors: ['VALIDATION_FAILED', 'PRECONDITION_FAILED', 'FORBIDDEN'],
    related: ['/agencies', '/products', '/stock-issues'],
  },
]
