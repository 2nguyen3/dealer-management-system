# Agentra — Ngôn ngữ nghiệp vụ

Agentra quản lý phân phối hàng hóa cho đại lý, nhập/xuất kho, thu tiền và công nợ.
Các thuật ngữ dưới đây được làm rõ trong quá trình thiết kế lại dữ liệu theo hướng ERP/SME.

## Chứng từ

**Phiếu nháp**:
Chứng từ đang được chuẩn bị, chưa làm phát sinh tồn kho hoặc công nợ.

**Xác nhận nghiệp vụ**:
Việc người có thẩm quyền xác nhận một nghiệp vụ đã đủ điều kiện để được ghi nhận chính thức.
_Tránh_: Đồng nhất lưu nháp với ghi nhận nghiệp vụ.

**Phiên bản chứng từ**:
Nội dung chứng từ tại một lần ghi nhận; điều chỉnh tạo phiên bản mới dưới cùng số phiếu và bảo toàn phiên bản trước.
_Tránh_: Xem mỗi phiên bản là một phiếu nghiệp vụ độc lập.

**Ngày nghiệp vụ**:
Ngày dùng để xác định kỳ của nghiệp vụ trong báo cáo; có thể khác ngày người dùng thực hiện thao tác.
_Tránh_: Đồng nhất ngày nghiệp vụ với thời gian tạo hoặc cập nhật.

## Thanh toán

**Khoản trả ngay dự kiến**:
Số tiền khai báo sẽ thanh toán cùng phiếu xuất, chưa tự chứng minh rằng doanh nghiệp đã thu tiền.
_Tránh_: Tiền đã thu.

**Phiếu thu tự sinh**:
Chứng từ thu khoản trả ngay gắn với một phiếu xuất; được ghi nhận cùng phiếu xuất sau khi khoản trả ngay đã được kế toán xác nhận.

**Phân bổ thanh toán**:
Phần tiền của một phiếu thu được xác định dùng để thanh toán cho một phiếu xuất cụ thể.
_Tránh_: Đồng nhất tổng tiền thu của đại lý với tiền thanh toán của một phiếu xuất.

**Phân bổ FIFO**:
Cách phân bổ thu công nợ ưu tiên phiếu xuất có ngày nghiệp vụ cũ hơn; khoản trả ngay thuộc riêng phiếu xuất liên quan.

## Trả hàng

**Trả hàng**:
Nghiệp vụ nhận lại hàng từ đại lý sau một giao dịch xuất hợp lệ, liên kết với phiếu xuất gốc và ghi nhận tại ngày nhận lại thực tế.
_Tránh_: Đồng nhất trả hàng với sửa sai hoặc hủy phiếu xuất gốc.

**Hoàn tiền**:
Nghiệp vụ doanh nghiệp thực tế trả lại tiền cho đại lý; có thời điểm và kết quả thực hiện riêng với việc nhận hàng trả lại.
_Tránh_: Đồng nhất hủy phiếu thu với hoàn tiền.

**Dư nợ phải thu**:
Số tiền đại lý còn phải thanh toán cho doanh nghiệp, không bao gồm khoản doanh nghiệp phải trả lại đại lý.
_Tránh_: Dùng số nợ âm để biểu diễn khoản phải hoàn.

**Dư có của đại lý**:
Giá trị doanh nghiệp còn phải hoàn hoặc bù cho đại lý, được theo dõi riêng với dư nợ phải thu.

**Bù trừ dư có**:
Nghiệp vụ dùng dư có khả dụng để thanh toán công nợ của cùng đại lý, được kế toán xác nhận và không làm phát sinh tiền thu mới.
_Tránh_: Phiếu thu tiền mặt, phiếu thu chuyển khoản.

**Doanh số thuần**:
Doanh số xuất hàng sau khi trừ giá trị hàng trả lại được ghi nhận trong cùng kỳ báo cáo.
