import { msg } from '@/lib/i18n/core'
import type { GuideContent } from '../types'

export const goodsGuides: readonly GuideContent[] = [
  {
    path: '/stock-receipts',
    purpose: msg(
      'Phiếu nhập hàng ghi nhận hàng nhập vào kho và giá nhập. Giá nhập gần nhất là cơ sở để hệ thống tính giá bán cho phiếu xuất.',
    ),
    roles: [
      msg(
        'Kho: lập phiếu (quyền lập phiếu nhập) và ghi sổ (quyền ghi sổ phiếu nhập).',
      ),
      msg('Quản lý: Hủy hoặc Sửa có lý do phiếu đã ghi sổ.'),
    ],
    flow: [
      { label: msg('Lập phiếu nhập nháp'), role: msg('Kho') },
      {
        label: msg('Ghi sổ: tăng tồn kho, cập nhật giá nhập gần nhất'),
        role: msg('Kho'),
      },
    ],
    steps: [
      msg('Bấm Tạo phiếu, chọn Ngày nghiệp vụ và nhập Ghi chú nếu cần.'),
      msg(
        'Ở Danh sách dòng hàng, chọn mặt hàng, nhập số lượng và Đơn giá nhập (VNĐ). Bấm Thêm dòng cho mặt hàng tiếp theo.',
      ),
      msg(
        'Bấm Lưu nháp. Phiếu nháp sửa hoặc xóa được tự do cho đến khi ghi sổ.',
      ),
      msg('Mở Chi tiết để kiểm tra, rồi bấm Ghi sổ và xác nhận.'),
      msg(
        'Phát hiện sai sau khi ghi sổ: bấm Hủy hoặc Sửa có lý do và nhập lý do.',
      ),
    ],
    rules: [
      msg('Mỗi mặt hàng chỉ một dòng; số lượng và đơn giá phải lớn hơn 0.'),
      msg(
        'Ghi sổ làm tăng tồn kho và đặt giá nhập gần nhất của mặt hàng bằng đơn giá trên phiếu.',
      ),
      msg(
        'Giá nhập mới chỉ ảnh hưởng phiếu xuất ghi sổ sau; phiếu xuất đã ghi sổ giữ đơn giá đã chốt.',
      ),
      msg('Phiếu nhập không làm thay đổi nợ của đại lý.'),
      msg(
        'Hủy phiếu nhập bị từ chối nếu làm tồn kho bị âm. Chỉ hủy hoặc sửa được phiếu có ngày trong tháng hiện tại.',
      ),
    ],
    errors: [
      'EMPTY_DOCUMENT',
      'DUPLICATE_PRODUCT',
      'INACTIVE_MASTER',
      'INSUFFICIENT_STOCK',
      'PERIOD_CLOSED',
      'STATE_CONFLICT',
    ],
    tips: [
      msg(
        'Mặt hàng mới phải có ít nhất một phiếu nhập đã ghi sổ thì mới có giá bán và lập phiếu xuất được.',
      ),
      msg(
        'Sửa có lý do tạo phiếu mới (mã mới) thay cho phiếu cũ; phiếu cũ chuyển Đã hủy và vẫn xem được trong lịch sử.',
      ),
    ],
    related: ['/products', '/stock-issues', '/document-history'],
  },
  {
    path: '/stock-issues',
    purpose: msg(
      'Phiếu xuất hàng ghi nhận hàng giao cho đại lý. Khi ghi sổ, tồn kho giảm và nợ của đại lý tăng đúng tổng tiền phiếu.',
    ),
    roles: [
      msg('Kinh doanh: lập phiếu nháp (quyền lập phiếu xuất).'),
      msg('Kho: ghi sổ phiếu xuất (quyền ghi sổ phiếu xuất).'),
      msg('Kế toán: lập phiếu thu khi đại lý trả tiền.'),
      msg('Quản lý: Hủy hoặc Sửa có lý do phiếu đã ghi sổ.'),
    ],
    flow: [
      { label: msg('Lập phiếu nháp'), role: msg('Kinh doanh') },
      {
        label: msg('Ghi sổ: chốt giá, kiểm tra tồn kho và hạn mức nợ'),
        role: msg('Kho'),
      },
      { label: msg('Lập phiếu thu khi đại lý trả tiền'), role: msg('Kế toán') },
    ],
    steps: [
      msg('Bấm Tạo phiếu, chọn Đại lý đang hoạt động và Ngày nghiệp vụ.'),
      msg(
        'Thêm dòng hàng gồm mặt hàng và số lượng; đơn giá do hệ thống tính. Bấm Lưu nháp.',
      ),
      msg(
        'Mở Chi tiết, xem nợ hiện tại, hạn mức và nợ sau phiếu của đại lý rồi bấm Ghi sổ.',
      ),
      msg(
        'Nếu đại lý trả tiền ngay, bấm Ghi sổ & lập phiếu thu để mở phiếu thu cho đúng đại lý sau khi ghi sổ.',
      ),
      msg(
        'Phát hiện sai sau khi ghi sổ: bấm Hủy hoặc Sửa có lý do và nhập lý do.',
      ),
    ],
    rules: [
      msg(
        'Đơn giá xuất = giá nhập gần nhất × tỷ lệ giá bán, làm tròn đến đồng, và được chốt khi ghi sổ.',
      ),
      msg(
        'Mặt hàng chưa từng được nhập thì chưa có giá bán nên không xuất được.',
      ),
      msg('Số lượng xuất của mỗi mặt hàng không được vượt tồn hiện tại.'),
      msg(
        'Nợ của đại lý sau khi ghi sổ không được vượt hạn mức nợ của loại đại lý.',
      ),
      msg(
        'Ghi sổ: tồn kho giảm, nợ tăng bằng tổng tiền phiếu. Tiền thu được ghi bằng phiếu thu riêng.',
      ),
      msg(
        'Đại lý đã ngừng hợp tác và mặt hàng ngừng kinh doanh không dùng được cho phiếu mới.',
      ),
      msg('Chỉ hủy hoặc sửa được phiếu có ngày trong tháng hiện tại.'),
    ],
    errors: [
      'PRODUCT_NOT_PRICED',
      'INSUFFICIENT_STOCK',
      'DEBT_LIMIT_EXCEEDED',
      'AGENCY_TERMINATED',
      'INACTIVE_MASTER',
      'PERIOD_CLOSED',
      'REASON_REQUIRED',
    ],
    tips: [
      msg(
        'Ghi sổ bị từ chối vì vượt hạn mức: lập phiếu thu để giảm nợ trước, hoặc giảm số lượng.',
      ),
      msg(
        'Nợ có thể âm khi đại lý trả trước qua thanh toán trực tuyến; phiếu xuất sau tự trừ vào số trả trước đó.',
      ),
    ],
    related: ['/payment-receipts', '/agencies', '/products', '/business-rules'],
  },
]
