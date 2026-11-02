# Business decision making — Các quyết định nghiệp vụ của DMS

## 1. Mục đích và cách đọc

Tài liệu này ghi lại 15 câu hỏi đã interview khi thiết kế lại database DMS
theo hướng ERP/SME. Mỗi câu hỏi trình bày vấn đề cần giải quyết, các phương án,
ví dụ đã thảo luận, lựa chọn cuối cùng và ảnh hưởng đến cách hệ thống vận hành.

Các ví dụ tiền dùng đơn vị VNĐ. Khi ghi “triệu”, hiểu là triệu đồng. Ngày 1/6,
20/6 hoặc 10/7 là ngày minh họa nghiệp vụ, không phải ngày diễn ra interview.

- **Phương án đã chọn** là lựa chọn người dùng xác nhận trực tiếp.
- **Ví dụ bổ sung** là tình huống dùng để giải thích rõ hơn, không phải câu hỏi
  hoặc quyết định mới của người dùng.
- **Quy ước triển khai** ở mục 3 là cách cụ thể hóa thiết kế. Những quy ước này
  được phân biệt với 15 lựa chọn đã interview.
- Người dùng đã xác nhận bản tổng hợp 15 quyết định bằng “okay” trước khi
  triển khai schema.

Tài liệu liên quan:

- BA đầu vào: [DMS_exploration.md](../BA/DMS_exploration.md).
- Database hiện hành: [DMS.sql](DMS.sql).
- Mô hình, ERD và transaction: [README.md](README.md).
- Schema đầu vào được bảo toàn: [archive/DMS.legacy.sql](archive/DMS.legacy.sql).

### 1.1. Một số khái niệm cần phân biệt

| Khái niệm | Ý nghĩa trong tài liệu |
| --- | --- |
| Lưu nháp | Lưu nội dung đang chuẩn bị; chưa tăng/giảm kho hoặc công nợ |
| Xác nhận nghiệp vụ | Người có thẩm quyền xác nhận điều kiện để ghi nhận nghiệp vụ chính thức |
| Ghi sổ | Ghi nhận ảnh hưởng chính thức vào tồn kho, phải thu hoặc dư có |
| Transaction | Nhóm thay đổi phải cùng thành công hoặc cùng rollback; không lưu một nửa kết quả |
| Ngày nghiệp vụ | Ngày quyết định giao dịch thuộc kỳ báo cáo nào |
| Thời gian thao tác | Thời điểm người dùng thực hiện công việc trên hệ thống; khác ngày nghiệp vụ |
| Sửa sai | Điều chỉnh chứng từ đã ghi không đúng sự việc thực tế |
| Trả hàng | Đại lý thực tế trả lại hàng sau một giao dịch bán hợp lệ |
| Dư nợ phải thu | Tiền đại lý còn phải trả doanh nghiệp |
| Dư có của đại lý | Giá trị doanh nghiệp còn phải hoàn hoặc bù cho đại lý; được theo dõi riêng với dư nợ |

### 1.2. Tóm tắt các lựa chọn

| Câu hỏi | Phương án đã chọn | Kết quả nghiệp vụ |
| --- | --- | --- |
| Q01 | **B** | Quy trình có nháp/xác nhận, phân bổ thanh toán, kiểm kê/điều chỉnh kho |
| Q02 | **1** | Xác nhận khoản trả ngay trước; ghi xuất và phiếu thu tự sinh cùng transaction |
| Q03 | **1** | Giữ phiên bản cũ, sửa bằng phiên bản mới dưới cùng số phiếu |
| Q04 | **1** | Sửa sai/hủy hồi tố làm tính lại kỳ của chứng từ gốc |
| Q05 | **1** | Kiểm tra tồn kho và công nợ không âm trong lịch sử bị ảnh hưởng |
| Q06 | **1** | Thu công nợ tự phân bổ FIFO |
| Q07 | **1** | Sửa/hủy tự tính lại phân bổ khi hợp lệ, bảo toàn tiền đã thu |
| Q08 | **2** | Có nghiệp vụ trả hàng và hoàn tiền thực tế |
| Q09 | **1** | Trả hàng/hoàn tiền ghi nhận theo ngày thực tế |
| Q10 | **1** | Dư có được hoàn tiền hoặc bù trừ có xác nhận |
| Q11 | **1, lựa chọn cuối cùng** | Online ghi đủ tiền thực nhận; phần vượt nợ thành dư có |
| Q12 | **1** | Không hạ hạn mức nếu khiến dư nợ hiện có vượt hạn mức mới |
| Q13 | **1** | Giá nhập hiện tại theo ngày nghiệp vụ mới nhất |
| Q14 | **1** | Chốt giá xuất khi chuyển phiếu sang chờ xuất |
| Q15 | **1** | Số lượng tối đa 3 số lẻ, tiền nguyên VNĐ |

## 2. Chi tiết các câu hỏi và quyết định

### Q01 — Lấy phạm vi nghiệp vụ nào làm cơ sở?

**Vấn đề:** BA chứa bộ 16 BM/QĐ với phiếu hiệu lực/hủy và phần quy trình mở rộng
với nháp, chờ xuất, xác nhận kho, xác nhận tiền, phân bổ và kiểm kê. Cần chốt
phạm vi trước khi quyết định cấu trúc bảng và thời điểm thay đổi số dư.

#### Phương án A — Ghi nhận ngay khi hoàn tất lập phiếu

Người dùng hoàn tất lập phiếu là xác nhận nghiệp vụ đã xảy ra. Hệ thống ghi
chứng từ, kho và công nợ ngay trong một transaction.

Ví dụ đã thảo luận: đại lý đang nợ 2 triệu, mua thêm 4 triệu và trả ngay 1 triệu.
Khi hoàn tất lập phiếu xuất:

```text
Giá trị phiếu xuất:       4 triệu
Phiếu thu tự sinh:        1 triệu
Dư nợ sau giao dịch:      2 + 4 - 1 = 5 triệu
Tồn kho:                 giảm ngay
```

Người hoàn tất thao tác chịu trách nhiệm rằng hàng đã xuất và tiền trả ngay
đã được nhận. Chưa có bước lưu công việc đang chờ kho/kế toán xử lý.

Ưu điểm là ít trạng thái, ít màn hình và dễ hoàn thiện theo bộ BM/QĐ. Hạn chế
là không tách rõ người lập yêu cầu khỏi người xác nhận thực tế.

#### Phương án B — Tách lập phiếu khỏi xác nhận thực tế

Vẫn ví dụ trên, nhưng công việc được tách thành các bước:

1. Kinh doanh lập phiếu nháp: chưa giảm kho, chưa tăng nợ.
2. Chuyển phiếu sang chờ xuất: chốt nội dung và giá theo Q14.
3. Kế toán xác nhận khoản trả ngay theo Q02.
4. Kho xác nhận xuất: ghi kho, phiếu xuất và khoản thu tự sinh đồng thời.
5. Sau transaction, dư nợ mới là 5 triệu.

Phương án này còn hỗ trợ phân bổ khoản thu vào từng phiếu, kiểm kê và chứng
từ điều chỉnh kho. Một người có thể thực hiện nhiều bước nếu được cấp quyền;
không bắt buộc mỗi bước phải do một người khác nhau làm.

#### So sánh phạm vi

| Nội dung | A | B |
| --- | --- | --- |
| Khi nào phiếu ảnh hưởng kho/nợ? | Khi hoàn tất lập phiếu | Khi xác nhận nghiệp vụ |
| Công việc nháp/chờ xử lý | Chưa thuộc phạm vi chính | Có |
| Tách trách nhiệm lập và xác nhận | Hạn chế | Rõ ràng |
| Biết tổng nợ đại lý | Có | Có |
| Biết từng phiếu còn nợ bao nhiêu | Chưa đầy đủ nếu khoản thu không có phân bổ | Có |
| Kiểm kê/điều chỉnh kho riêng | Chưa có trong bộ 16 BM/QĐ | Có |
| Công sức triển khai | Thấp hơn | Cao hơn |

Ví dụ kiểm kê đã thảo luận: sổ tồn là 100 sản phẩm nhưng thực tế đếm được 97.
Hướng B dùng chứng từ điều chỉnh giảm 3, có lý do, người lập và người xác
nhận. Không cần tạo phiếu xuất bán hàng giả để làm số tồn khớp.

**Phương án đã chọn: B.** Người dùng yêu cầu giải thích rõ hai hướng trước khi
chọn. Cả A và B đều có thể thiết kế dữ liệu đúng đắn và tối ưu; khác biệt là
độ sâu quy trình, không phải A là database “không chuẩn”.

**Ảnh hưởng đến thiết kế:** phải lưu trạng thái, người và thời điểm xác nhận,
phân bổ thanh toán và chứng từ điều chỉnh. Phạm vi vẫn là một kho; không thêm
nhà cung cấp, công nợ nhà cung cấp, đa chi nhánh, thuế hoặc kế toán tổng hợp.

### Q02 — Chưa xác nhận khoản trả ngay thì có được xuất hàng?

**Vấn đề:** số tiền kinh doanh khai báo sẽ trả chưa tự chứng minh kế toán đã
nhận tiền. Nếu lấy khoản chưa xác nhận để giảm nợ, hệ thống có thể cho xuất
vượt hạn mức thực tế.

Ví dụ đã thảo luận:

| Dữ liệu | Giá trị |
| --- | ---: |
| Hạn mức nợ | 10 triệu |
| Dư nợ hiện tại | 8 triệu |
| Phiếu xuất mới | 4 triệu |
| Khoản trả ngay khai báo | 3 triệu |

```text
Nếu tiền đã xác nhận: 8 + 4 - 3 = 9 triệu, trong hạn mức.
Nếu chưa xác nhận:   8 + 4     = 12 triệu, vượt hạn mức.
```

#### Phương án 1 — Có trả ngay thì xác nhận tiền trước

1. Kinh doanh khai báo số tiền dự kiến trả ngay.
2. Kế toán xác nhận khoản tiền đã nhận cho đúng phiên bản phiếu chờ xuất.
3. Bước xác nhận này chưa giảm nợ và chưa tạo phiếu thu hiệu lực.
4. Kho kiểm tra lại điều kiện xuất.
5. Nếu hợp lệ, ghi phiếu xuất, phiếu thu tự sinh, kho và nợ cùng transaction.

Với ví dụ trên, sau khi hoàn tất bước 5, dư nợ là 9 triệu. Nếu bất kỳ thay đổi
dữ liệu nào trong bước 5 thất bại, toàn bộ transaction rollback.

Ưu điểm là không dùng tiền chưa xác nhận để giảm nợ và giữ phiếu xuất/phiếu
thu tự sinh đồng bộ. Đánh đổi là phiếu có trả ngay phải chờ kế toán.

#### Phương án 2 — Có thể xuất trước nếu đủ hạn mức cho toàn bộ tiền hàng

Kho không trừ khoản chưa xác nhận khi kiểm tra hạn mức. Sau khi xuất, toàn
bộ giá trị hàng tăng nợ; kế toán xác nhận tiền sau thì mới giảm nợ.

Ví dụ ban đầu vẫn bị chặn vì nợ sẽ là 12 triệu. Nếu nợ cũ chỉ 5 triệu, có thể
xuất trước vì `5 + 4 = 9 triệu`; khoản thu được xử lý sau đó.

Ưu điểm là kho và kế toán độc lập hơn. Đánh đổi là phải tách rõ khoản dự kiến
trả khỏi tiền đã thu và thay đổi thời điểm ghi nhận phiếu thu trong BA.

**Phương án đã chọn: 1.** Nếu số tiền trả ngay bằng 0, không có bước xác nhận
khoản trả ngay; kho vẫn kiểm tra tồn và hạn mức trước khi ghi nhận xuất.

**Ngoại lệ cần xử lý:** nếu tiền đã nhận nhưng cuối cùng không xuất được,
không được bỏ qua tiền hoặc tạo phiếu xuất giả. Khoản đó được xử lý bằng
chứng từ nhận tiền riêng theo nguyên tắc Q11.

### Q03 — Sửa chứng từ đã xác nhận: ghi đè hay giữ phiên bản?

**Vấn đề:** cần cho sửa sai nhưng vẫn giải thích được chứng từ từng ghi gì,
ai sửa và ảnh hưởng cũ đã được xử lý ra sao.

Ví dụ đã thảo luận: PX-001 ghi xuất 10 sản phẩm, sau đó phát hiện thực tế chỉ
xuất 8. Đây là sửa sai ghi nhận. Nếu đã giao đúng 10 rồi đại lý trả 2, phải
dùng nghiệp vụ trả hàng ở Q08/Q09.

#### Phương án 1 — Giữ phiên bản cũ và tạo phiên bản điều chỉnh

| Nội dung | Trước sửa | Sau sửa |
| --- | --- | --- |
| Số phiếu | PX-001 | PX-001 |
| Phiên bản hiện hành | 1 | 2 |
| Số lượng xuất | 10 | 8 |
| Phiên bản 1 còn xem được? | Có | Có, được giữ nguyên |

Quy trình sửa:

1. Người có quyền nhập lý do và nội dung điều chỉnh.
2. Tạo phiên bản mới, không ghi đè phiên bản đã ghi nhận.
3. Trong một transaction, đảo ảnh hưởng 10 sản phẩm của phiên bản cũ và ghi
   ảnh hưởng 8 sản phẩm của phiên bản mới.
4. Kiểm tra kho, nợ, tiền thu và phân bổ liên quan.
5. Chuyển phiên bản mới thành hiện hành nếu toàn bộ kiểm tra hợp lệ.

Riêng tồn kho, kết quả ròng là tăng lại 2 sản phẩm so với dữ liệu trước sửa.
Không được xem đây là một phiếu bán mới. Báo cáo vẫn đếm PX-001 là một phiếu.

Ưu điểm là lịch sử chứng từ có cấu trúc, dễ tái dựng và đối chiếu. Đánh đổi
là cần lưu phiên bản và thực hiện các bút toán điều chỉnh.

#### Phương án 2 — Sửa trực tiếp và lưu trước/sau trong nhật ký

Cập nhật số lượng 10 thành 8 trên record hiện tại, đồng thời cập nhật kho/nợ
và ghi nhật ký. Muốn xem lại nội dung cũ phải tìm trong nhật ký thay vì mở
một phiên bản chứng từ riêng.

Ưu điểm là đơn giản hơn; hạn chế là lịch sử khó truy vấn và tái dựng hơn.

**Phương án đã chọn: 1.** Hủy cũng phải giữ chứng từ, nội dung lịch sử, người
thực hiện và lý do. Không xóa vật lý để làm mất dấu giao dịch.

### Q04 — Sửa/hủy phiếu tháng trước thay đổi kỳ nào?

**Vấn đề:** ngày phát hiện sai có thể khác tháng của chứng từ. Cần xác định
việc điều chỉnh làm thay đổi báo cáo cũ hay phát sinh điều chỉnh trong kỳ mới.

Ví dụ đã thảo luận: ngày 20/6 ghi phiếu xuất 4 triệu; ngày 10/7 phát hiện sai
và sửa giá trị đúng thành 3 triệu. Để minh họa riêng ảnh hưởng báo cáo, giả
sử phiếu chưa có khoản thu.

| Kết quả báo cáo | Phương án 1: tính lại kỳ gốc | Phương án 2: điều chỉnh kỳ thực hiện |
| --- | --- | --- |
| Doanh số tháng 6 của phiếu | 3 triệu | Giữ 4 triệu |
| Điều chỉnh ghi trong tháng 7 | Không thêm doanh số vì thao tác sửa | Ghi giảm 1 triệu |
| Nợ cuối tháng 6 do phiếu | Tính lại thành 3 triệu | Giữ 4 triệu |
| Nợ đầu tháng 7 liên quan | Tính lại theo nợ cuối tháng 6 | Giữ số đầu kỳ cũ, giảm ở phát sinh tháng 7 |
| Thời điểm thực hiện sửa | Vẫn lưu 10/7 | Vẫn lưu 10/7 |

Phương án 1 gần cách tổng hợp các phiếu còn hiệu lực của BM6. Phương án 2 phù
hợp hơn khi cần giữ ổn định kỳ đã chốt, nhưng phải bổ sung cách ghi và trình
bày giao dịch điều chỉnh thay vì chỉ lọc phiếu hiệu lực theo tháng.

**Phương án đã chọn: 1 — tính lại kỳ của ngày nghiệp vụ gốc.**

Nếu hủy phiếu tháng 6 vào tháng 7, chạy lại báo cáo tháng 6 sẽ loại ảnh hưởng
của phiếu đó. Các số dư đầu kỳ sau cũng được tính lại tương ứng, nếu thao
tác sửa/hủy đáp ứng toàn bộ ràng buộc liên quan.

**Đánh đổi:** báo cáo tháng 6 xuất trước và sau khi sửa có thể khác nhau.
Quyết định này không bao gồm khóa sổ hoặc bảo đảm một bản báo cáo đã xuất
sẽ bất biến. Phiên bản và nhật ký vẫn phải thể hiện việc sửa xảy ra ngày 10/7.

### Q05 — Chỉ kiểm tra số dư hiện tại hay cả lịch sử?

**Vấn đề:** sau Q04, sửa/hủy có thể làm thay đổi lịch sử. Số dư hôm nay không
âm chưa đủ chứng minh tất cả mốc quá khứ hợp lệ.

Ví dụ đã thảo luận, tồn ban đầu bằng 0:

| Ngày | Nghiệp vụ gốc | Tồn trước hủy | Tồn tính lại nếu hủy nhập ngày 1/6 |
| --- | --- | ---: | ---: |
| 1/6 | Nhập 10 | 10 | 0 |
| 5/6 | Xuất 10 | 0 | -10 |
| 10/6 | Nhập thêm 10 | 10 | 0 |

Đến tháng 7, yêu cầu hủy phiếu nhập ngày 1/6:

- Kiểm tra hiện tại: `10 - 10 = 0`, có thể tưởng thao tác hợp lệ.
- Kiểm tra lịch sử: ngày 5/6 thành -10, nghĩa là đã xuất hàng trước khi có hàng.

| Phương án | Kết quả với ví dụ |
| --- | --- |
| **1 — kiểm tra cả lịch sử** | **Từ chối hủy vì làm tồn ngày 5/6 âm** |
| 2 — chỉ kiểm tra hiện tại | Cho hủy vì tồn cuối vẫn bằng 0 |

**Phương án đã chọn: 1.** Quy tắc cũng áp dụng cho dư nợ: không sửa ngày hoặc
hủy nguồn phát sinh nợ nếu khiến lịch sử thể hiện thu tiền khi chưa có nợ.

**Ví dụ bổ sung về công nợ:** ban đầu nợ bằng 0, xuất 4 triệu ngày 1/6 rồi
thu 1 triệu ngày 5/6, hiện còn nợ 3 triệu. Nếu đổi ngày phiếu xuất sang 10/6,
nợ cuối vẫn 3 triệu nhưng ngày 5/6 trở thành -1 triệu do thu trước khi có nợ.
Yêu cầu đổi ngày đó phải bị từ chối dù số dư hiện tại không âm.

Việc kiểm tra áp dụng cho kết quả cuối cùng của toàn bộ thao tác, gồm các
chứng từ phụ thuộc. Không từ chối chỉ vì trạng thái tạm thời giữa bước đảo
ảnh hưởng cũ và ghi ảnh hưởng mới. Phải xử lý những chứng từ liên quan trước
hoặc trong cùng transaction nếu muốn thao tác trở nên hợp lệ.

**Đánh đổi:** kiểm tra lịch sử phức tạp hơn kiểm tra số dư hiện tại. Thiết kế
giới hạn theo mặt hàng/đại lý bị ảnh hưởng; kiểm tra từng phiếu phải thu và
lô dư có. Đây không phải quyết định áp hạn mức hôm nay ngược vào giao dịch cũ.

### Q06 — Phân bổ thu công nợ tự động hay do kế toán chọn?

**Vấn đề:** chỉ giảm tổng nợ đại lý chưa đủ biết từng phiếu đã trả bao nhiêu.
Cần xác định một khoản thu được dùng thanh toán cho các phiếu nào.

Ví dụ đã thảo luận: ngày 10/6 thu 4 triệu từ đại lý đang có hai phiếu nợ:

| Phiếu | Ngày nghiệp vụ | Còn nợ trước thu |
| --- | --- | ---: |
| PX-001 | 1/6 | 3 triệu |
| PX-002 | 5/6 | 2 triệu |

#### Phương án 1 — Tự phân bổ FIFO

FIFO trong câu hỏi này nghĩa là **ưu tiên trả phiếu có ngày nghiệp vụ cũ hơn**,
không phải phương pháp tính giá vốn tồn kho.

| Phiếu | Tiền được phân bổ | Còn nợ sau thu | Kết quả |
| --- | ---: | ---: | --- |
| PX-001 | 3 triệu | 0 | Đã trả đủ |
| PX-002 | 1 triệu | 1 triệu | Trả một phần |
| Tổng | 4 triệu | 1 triệu | Khớp khoản thu và tổng nợ |

Hệ thống tự tính, kế toán không cần nhập cách chia tiền cho từng phiếu.
Ưu điểm là ít thao tác và có quy tắc nhất quán. Đánh đổi là không xử lý yêu
cầu chỉ định “khoản này chỉ trả PX-002” bằng cách chọn thủ công.

#### Phương án 2 — Kế toán chọn phiếu và số tiền

Kế toán có thể chia 2 triệu cho PX-001 và 2 triệu cho PX-002. Tổng nợ vẫn còn
1 triệu, nhưng PX-002 trả đủ, còn PX-001 chưa trả hết. Hệ thống cần kiểm tra
tổng phân bổ khớp tiền thu và không vượt nợ từng phiếu.

Ưu điểm là linh hoạt theo mục đích thanh toán; đánh đổi là thêm giao diện,
thao tác và khả năng phân bổ nhầm.

**Phương án đã chọn: 1 — tự phân bổ FIFO.**

Điều kiện áp dụng:

- Cùng đại lý, phiếu đã xuất và còn hiệu lực.
- Không dùng khoản thu ngày 10/6 để trả phiếu có ngày nghiệp vụ sau 10/6.
- Cùng ngày thì dùng thứ tự phụ ổn định.
- Một phiếu được trả nhiều lần, một khoản thu có thể trả nhiều phiếu.
- Khoản trả ngay tự sinh chỉ trả phiếu xuất liên kết, không áp FIFO sang phiếu khác.

### Q07 — Sửa/hủy phiếu đã được phân bổ có tính lại FIFO?

**Vấn đề:** khi một phiếu bị sửa/hủy, phân bổ trước đây có thể không còn đúng.
Tiền thực nhận phải được giữ, nhưng cần xác định còn phân bổ hợp lệ được không.

Ví dụ đã thảo luận: PX-001 ngày 1/6 trị giá 3 triệu, PX-002 ngày 5/6 trị giá
5 triệu. Phiếu thu ngày 10/6 là 4 triệu, đã phân bổ theo FIFO:

| Phiếu | Giá trị | Đã phân bổ | Còn nợ |
| --- | ---: | ---: | ---: |
| PX-001 | 3 triệu | 3 triệu | 0 |
| PX-002 | 5 triệu | 1 triệu | 4 triệu |

Nay cần hủy PX-001 do ghi sai chứng từ.

#### Phương án 1 — Tính lại phân bổ trong cùng thao tác

1. Kiểm tra việc hủy PX-001 và các ảnh hưởng kho/nợ.
2. Đảo phân bổ cũ nhưng giữ nguyên phiếu thu 4 triệu.
3. Tính lại FIFO trên các phiếu hợp lệ tại ngày thu.
4. Phân bổ toàn bộ 4 triệu vào PX-002.
5. Ghi lịch sử thay đổi, kiểm tra số dư/lịch sử rồi commit cùng thao tác hủy.

| Nội dung | Sau xử lý |
| --- | --- |
| PX-001 | Đã hủy, không còn phân bổ hiệu lực |
| PX-002 | Được phân bổ 4 triệu, còn nợ 1 triệu |
| Phiếu thu | Vẫn hiệu lực, vẫn là 4 triệu |
| Lịch sử phân bổ cũ | Vẫn xem được, không bị xóa |

Tự phân bổ lại không có nghĩa mọi yêu cầu hủy đều được chấp nhận. Đối chiếu
với ví dụ Q06: nếu phiếu còn lại chỉ trị giá 2 triệu, không thể phân bổ đủ
khoản thu 4 triệu sau hủy. Trường hợp đó phải bị từ chối, không tự xóa tiền thu.

#### Phương án 2 — Chặn sửa/hủy khi đã có phân bổ

Dù có đủ phiếu khác để nhận tiền, hệ thống vẫn yêu cầu xử lý khoản thanh toán
bằng một nghiệp vụ riêng trước khi sửa/hủy. Ít thay đổi tự động hơn nhưng
quy trình sửa sai thêm bước.

**Phương án đã chọn: 1.** Việc phân bổ lại chỉ hợp lệ nếu đúng đại lý, đúng
ngày, đủ phần nợ có thể nhận phân bổ và không làm lịch sử âm.

Khoản thu công nợ độc lập được phân bổ lại; **phiếu thu tự sinh từ khoản trả
ngay không được chuyển sang phiếu khác bằng FIFO**. Trường hợp tiền trả ngay
thực tế cần thay đổi phải dùng xử lý tiền/chứng từ tương ứng, không giả hủy tiền.

### Q08 — Có làm trả hàng và hoàn tiền thực tế?

**Vấn đề:** hủy chứng từ trên phần mềm không làm hàng tự quay lại kho hoặc
tiền tự chuyển trả cho đại lý. Cần phân biệt sửa sai ghi nhận với đảo giao
dịch thực tế đã diễn ra.

Ví dụ đã thảo luận: đã giao hàng trị giá 4 triệu, thực thu trả ngay 1 triệu,
còn nợ 3 triệu. Sau đó đại lý muốn trả lại hàng và nhận lại tiền.

Nếu chỉ hủy phiếu xuất và phiếu thu, phần mềm có thể biểu diễn giao dịch như
chưa từng xảy ra, trong khi 1 triệu vẫn ở doanh nghiệp và hàng chưa chắc đã
được nhận lại. Vì vậy cần bằng chứng riêng cho hàng và tiền.

#### Phương án 1 — Chỉ hỗ trợ sửa sai chứng từ

Làm phiên bản điều chỉnh và nhật ký, nhưng chưa làm quy trình trả hàng/hoàn
tiền. Những yêu cầu làm giảm tiền đã thực thu bị chặn nếu chưa có nghiệp vụ
hợp lệ xử lý khoản tiền đó.

Ưu điểm là phạm vi nhỏ hơn. Đánh đổi là một số giao dịch đã nhận tiền thật
không thể hủy chỉ bằng BM10.

#### Phương án 2 — Hỗ trợ trả hàng và hoàn tiền thực tế

1. Lập chứng từ trả hàng liên kết phiếu xuất gốc.
2. Xác nhận lượng hàng thực tế nhận lại; lúc này mới tăng tồn.
3. Tính lại nghĩa vụ phải thu/phải hoàn theo giá trị trả.
4. Lập nghiệp vụ hoàn tiền nếu có khoản phải trả lại.
5. Chỉ xác nhận đã hoàn khi có kết quả tiền thực tế đã trả.

Với ví dụ trên, nếu nhận lại toàn bộ hàng, nợ 3 triệu được xóa và doanh
nghiệp còn phải hoàn hoặc bù 1 triệu. Khoản phải hoàn chưa đồng nghĩa tiền
đã hoàn thành công; cách sử dụng khoản đó được chốt ở Q10.

**Phương án đã chọn: 2.** Phạm vi thêm chứng từ và trạng thái cho nhận hàng
trả lại, hoàn tiền đang chờ/thất bại/chưa rõ kết quả/thành công. Đây là hoàn
tiền cho đại lý, không mở rộng sang phân hệ mua hàng hoặc chi nhà cung cấp.

### Q09 — Trả hàng thực tế theo ngày trả hay hồi tố tháng bán?

**Vấn đề:** Q04 đã chọn tính lại kỳ gốc khi sửa sai. Cần làm rõ quy tắc đó có
áp dụng cho việc trả hàng mới xảy ra ở tháng sau không.

Ví dụ đã thảo luận: ngày 20/6 bán và giao đúng hàng trị giá 4 triệu; ngày
10/7 mới nhận lại toàn bộ hàng.

#### Phương án 1 — Ghi nhận trả hàng theo ngày thực tế

| Sự kiện | Cách ghi nhận |
| --- | --- |
| Bán hàng 20/6 | Giữ nguyên phiếu xuất và doanh số 4 triệu của tháng 6 |
| Nhận hàng trả lại 10/7 | Tăng kho và ghi giá trị trả hàng trong tháng 7 |
| Công nợ/khoản phải hoàn | Thay đổi khi xác nhận trả hàng ngày 10/7 |
| Tiền được hoàn sau đó | Ghi theo ngày thực tế hoàn thành, không giả là đã hoàn ngày nhận hàng |

Báo cáo tách rõ:

```text
Doanh số thuần trong kỳ
 = Doanh số xuất hàng trong kỳ - Giá trị hàng trả lại trong kỳ
```

Nếu tháng 7 không có bán hàng nào khác, nghiệp vụ này cho gross sales bằng
0, hàng trả lại 4 triệu và doanh số thuần -4 triệu. Net âm do nhận lại hàng
của kỳ trước không có nghĩa tồn kho hoặc dư nợ được phép âm.

#### Phương án 2 — Trả hàng cũng điều chỉnh về tháng bán

Giảm doanh số tháng 6. Nếu đồng thời đưa biến động kho về tháng 6, lịch sử
sẽ thể hiện hàng đã quay lại từ tháng 6 dù thực tế tháng 7 mới nhận lại.
Muốn tránh điều đó phải tách thêm kỳ doanh số khỏi ngày biến động kho/nợ.

**Phương án đã chọn: 1.** Giữ quy tắc hồi tố cho sửa sai, dùng ngày thực tế
cho trả hàng và hoàn tiền. Phiếu trả hàng không được đếm như một phiếu xuất mới.

So sánh hai ví dụ:

- Ghi nhầm 4 triệu, giá trị đúng từ đầu là 3 triệu: sửa sai, tính lại tháng gốc.
- Đã bán đúng 4 triệu, tháng sau mới nhận hàng trả lại: nghiệp vụ mới, ghi tháng trả.

### Q10 — Khoản phải hoàn chỉ được trả lại hay có thể bù trừ?

**Vấn đề:** sau trả hàng, doanh nghiệp có thể còn giữ tiền của đại lý. Cần
chốt khoản này chỉ hoàn bằng tiền hay được dùng thanh toán giao dịch khác.

Ví dụ đã thảo luận:

| Thời điểm | Dư nợ phải thu | Dư có của đại lý |
| --- | ---: | ---: |
| Sau bán 4 triệu và thu 1 triệu | 3 triệu | 0 |
| Sau nhận lại toàn bộ hàng | 0 | 1 triệu |

Không ghi dư nợ thành -1 triệu. Hai số dư thể hiện hai nghĩa vụ khác nhau:
đại lý phải trả doanh nghiệp và doanh nghiệp phải hoàn/bù cho đại lý.

#### Phương án 1 — Cho hoàn tiền hoặc bù trừ

Kế toán có thể chọn một trong hai cách xử lý dư có 1 triệu:

- **Hoàn tiền:** trả lại 1 triệu; dư có chỉ giảm khi hoàn thành thực tế.
- **Bù trừ:** nếu đại lý mua tiếp 2 triệu, xác nhận dùng 1 triệu dư có để
  thanh toán; sau bù, còn phải trả 1 triệu.

Bù trừ phải có chứng từ, người xác nhận và phân bổ vào phiếu của cùng đại
lý. Không tạo phiếu thu tiền mặt/chuyển khoản 1 triệu giả, vì lần bù không
có tiền mới đi vào doanh nghiệp.

#### Phương án 2 — Chỉ hoàn tiền

Doanh nghiệp phải hoàn 1 triệu cũ; đơn mới 2 triệu vẫn được thanh toán riêng.
Quy trình đơn giản hơn, nhưng có thể phải vừa trả tiền ra vừa thu tiền vào
với cùng đại lý.

**Phương án đã chọn: 1 — hoàn tiền hoặc bù trừ, có xác nhận của kế toán.**

Một khoản dư có không được dùng hai lần. Khi đã dành cho refund đang chờ,
phần đó chưa được dùng bù trừ; chỉ phần còn khả dụng mới được sử dụng.

### Q11 — Tiền online thực nhận vượt nợ trong lúc chờ

**Vấn đề:** kiểm tra đúng lúc khởi tạo chưa bảo đảm công nợ vẫn còn đủ lúc
cổng thanh toán nhận tiền. Hai thời điểm có thể cách nhau vài phút và trong
khoảng đó đã có giao dịch khác.

Đây là câu hỏi được thảo luận lại nhiều lần. Cả bốn phương án được giữ dưới
đây để giải thích đúng quá trình lựa chọn.

#### Tình huống chung đã thảo luận

| Bước | Sự kiện | Dư nợ đã ghi nhận |
| --- | --- | ---: |
| 1 | Đại lý đang nợ | 5 triệu |
| 2 | Khởi tạo online 5 triệu, chưa thanh toán | 5 triệu |
| 3 | Kế toán thu chuyển khoản 3 triệu | 2 triệu |
| 4 | Cổng online xác nhận thực nhận thêm 5 triệu | Cần xử lý 5 triệu nhận mới khi nợ chỉ còn 2 triệu |

Tổng tiền thực nhận là 8 triệu cho khoản nợ gốc 5 triệu. Không thể đổi kết
quả online thành thất bại hoặc bỏ qua 3 triệu dư để làm số liệu khớp.

#### Phương án 1 — Tự trả nợ, phần còn lại thành dư có

Quy trình:

1. Khi khởi tạo, kiểm tra `0 < tiền online <= dư nợ hiện tại`; giao dịch ở
   trạng thái chờ, chưa tạo phiếu thu hiệu lực.
2. Không dành riêng công nợ cho online; khoản thu khác vẫn có thể được ghi nhận.
3. Khi cổng báo thành công, xác minh kết quả và đọc lại công nợ dưới khóa dữ liệu.
4. Trong cùng transaction, ghi online thành công và tạo đúng một phiếu thu
   **đủ 5 triệu**, không chỉ ghi 2 triệu.
5. Tự phân bổ FIFO 2 triệu trả hết nợ; 3 triệu còn lại thành dư có.

| Nội dung | Kết quả sau callback hợp lệ |
| --- | ---: |
| Phiếu thu chuyển khoản đã có | 3 triệu |
| Phiếu thu online mới | 5 triệu |
| Tổng tiền thực nhận | 8 triệu |
| Tổng đã dùng thanh toán nợ | 5 triệu |
| Dư nợ | 0 |
| Dư có đại lý | 3 triệu |

Kế toán có thể hoàn 3 triệu hoặc xác nhận bù trừ theo Q10. **Callback không
tự hoàn tiền và không tự bù dư có vào một đơn mới.** Nó chỉ ghi nhận đủ tiền
và xác định phần dư; việc sử dụng dư có là nghiệp vụ riêng.

Nếu không có khoản chuyển khoản xen vào, nợ vẫn 5 triệu khi online thành
công: cả 5 triệu trả nợ, dư nợ bằng 0, dư có bằng 0, không cần xử lý thêm.

Ưu điểm là tự động ghi nhận đầy đủ và không treo khoản nhận tiền ngoại lệ.
Đánh đổi là chấp nhận phát sinh dư có ngoài ý muốn, có thể cần hoàn/bù sau.

#### Phương án 2 — Tiền đã nhận chờ kế toán đối soát

Các bước khởi tạo và khoản thu chuyển khoản giống phương án 1. Khi nhận
online 5 triệu mà chỉ còn nợ 2 triệu:

1. Ghi bằng chứng cổng đã nhận 5 triệu và kết quả thanh toán thành công.
2. Đánh dấu khoản tiền ngoại lệ là chờ đối soát nội bộ.
3. Chưa tự phân bổ giảm nợ hoặc tạo dư có khả dụng.
4. Kế toán xem giao dịch, khoản chuyển khoản trước đó và các phiếu còn nợ.
5. Kế toán quyết định cách sử dụng khoản online, hệ thống kiểm tra lại rồi ghi sổ.

| Nội dung trong lúc chờ đối soát | Giá trị |
| --- | ---: |
| Dư nợ đang ghi nhận | 2 triệu |
| Tiền online đã nhận nhưng chờ xử lý | 5 triệu |
| Dư có khả dụng từ khoản online | 0 |

Phải tách hai trạng thái: **cổng đã thanh toán thành công** và **khoản tiền
nội bộ chưa xử lý xong**. Tiền chờ xử lý vẫn phải có danh sách/báo cáo riêng.

Hai cách xử lý đã được giải thích:

| Quyết định kế toán | Kết quả |
| --- | --- |
| Dùng khoản online để trả nợ | Phân bổ 2 triệu trả nợ, 3 triệu thành dư có; kết quả cuối giống phương án 1 |
| Hoàn toàn bộ khoản online bị trả trùng | Ghi khoản phải hoàn 5 triệu; dư nợ vẫn 2 triệu vì chưa dùng khoản online để trả nợ |

Yêu cầu hoàn tiền chưa phải hoàn tiền thành công. Tiền chỉ được ghi là đã trả
ra khi có kết quả thực tế. Trường hợp online khớp đủ công nợ có thể ghi nhận
tự động; phương án được giải thích là đối soát **ngoại lệ**, không bắt duyệt
mọi giao dịch online.

Ưu điểm là kế toán quyết định trước khi khoản tiền ngoại lệ được sử dụng.
Đánh đổi là thêm luồng tiền chờ xử lý và thay đổi QĐ15 về thời điểm giảm nợ.

#### Phương án 3 — Dành phần công nợ cho online đang chờ

Phương án này ngăn xung đột trước khi tiền nhận, thay vì giải quyết tiền dư
sau đó. Khi khởi tạo online 5 triệu, dành toàn bộ 5 triệu nợ cho giao dịch.
Trong thời gian chờ, không cho lập khoản thu khác vào phần đã dành.

```text
Nợ còn có thể thanh toán
 = Dư nợ hiện tại - Phần đang dành cho online chờ
```

| Tình huống | Dư nợ | Phần dành cho online | Phần còn có thể thu bằng giao dịch khác |
| --- | ---: | ---: | ---: |
| Online chờ 5 triệu | 5 triệu | 5 triệu | 0 |
| Online chờ 3 triệu | 5 triệu | 3 triệu | 2 triệu |

Với tình huống chung, khoản chuyển khoản 3 triệu ở bước 3 sẽ bị chặn khi
lập phiếu thu. Muốn đổi phương thức, phải kết thúc online an toàn trước:

1. Yêu cầu hủy online.
2. Cổng xác nhận giao dịch không thể thu tiền nữa.
3. Giải phóng phần công nợ đã dành.
4. Cho thu bằng phương thức khác.

Online thành công thì ghi tiền/giảm nợ và giải phóng phần dành cùng transaction.
Không chỉ hết giờ nội bộ rồi giải phóng, vì cổng có thể đã nhận tiền nhưng
callback đến muộn.

Ưu điểm là ngăn hai luồng trong hệ thống cùng thanh toán một phần nợ. Đánh
đổi là hạn chế đổi phương thức và cần quản lý phần dành/hủy/hết hạn. Cách này
không ngăn được việc đại lý tự chuyển tiền bên ngoài các luồng phần mềm.

#### Phương án 4 — Chỉ giới hạn theo nợ tại lúc khởi tạo

Đây là cách đơn giản hóa đề xuất “chỉ cho phép lập giao dịch online với số
tiền hiện có”, được làm rõ trong ngữ cảnh là dư nợ đại lý.

1. Đọc dư nợ mới nhất khi tạo giao dịch.
2. Chỉ cho tạo nếu tiền online lớn hơn 0 và không vượt nợ lúc đó.
3. Không dành công nợ; các khoản thu khác vẫn hoạt động.

Với tình huống chung, online 5 triệu lúc nợ 5 triệu hợp lệ, chuyển khoản
3 triệu sau đó cũng hợp lệ. Khi online thành công, vẫn phát sinh dư 3 triệu.

Ưu điểm là đơn giản và ngăn tạo giao dịch vượt nợ ngay từ đầu. **Phương án
này chưa giải quyết khoản tiền đã nhận khi công nợ thay đổi trong lúc chờ**;
vẫn cần chính sách xử lý ngoại lệ.

#### So sánh để hiểu đúng lựa chọn

| Nội dung | 1: tự ghi dư có | 2: chờ đối soát | 3: dành công nợ | 4: kiểm tra khởi tạo |
| --- | --- | --- | --- | --- |
| Thu khác trong lúc online chờ | Cho phép | Cho phép | Chỉ phần chưa dành | Cho phép |
| Cách xử lý tiền nhận vượt nợ | Tự trả nợ và tạo dư có | Kế toán quyết định | Chủ yếu phòng ngừa trước | Chưa quy định đầy đủ |
| Nợ sau callback trong ví dụ | 0 | 2 triệu cho đến khi xử lý | Trường hợp thu trùng trong luồng được chặn | Chưa xác định nếu không bổ sung xử lý |
| Dư có từ khoản online | 3 triệu | Chưa khả dụng khi chờ | Thường không phát sinh do xung đột trong hệ thống | Có thể phát sinh nhưng chưa có cách ghi nhận |

Phương án 1/2 là chính sách xử lý tiền đã nhận. Phương án 3/4 là chính sách
kiểm soát lúc tạo/chờ thanh toán. Kiểm tra đầu vào của phương án 4 vẫn là
một điều kiện cần trong phương án 1; nó không thay thế xử lý phần dư.

#### Diễn biến và quyết định cuối cùng

1. Ban đầu đưa ra 1 và 2; người dùng trả lời “cả hai đều không ổn”.
2. Đưa ra phương án 3 để chủ động ngăn xung đột.
3. Người dùng đề xuất chỉ tạo online với “số tiền hiện có”; làm rõ phương án 4.
4. Giải thích vì sao chỉ kiểm tra khởi tạo chưa giải quyết được nợ thay đổi sau đó.
5. Người dùng yêu cầu xem lại đủ bốn phương án, rồi giải thích riêng 1 và 2.
6. **Người dùng chọn lại “okay, 1”. Phương án đã chọn cuối cùng là 1.**

Không ghi 3 hoặc 4 thành lựa chọn đã được chấp thuận. Thiết kế cuối không
dành công nợ cho online chờ, nhưng vẫn kiểm tra tiền không vượt nợ lúc khởi tạo.

Các quy tắc đi kèm phương án 1:

- Một giao dịch online thành công tạo đúng một phiếu thu đầy đủ.
- Callback gửi lặp không được tạo thêm khoản thu hoặc giảm nợ lần nữa.
- FAILED/EXPIRED không tạo phiếu thu; kết quả thành công được xác minh đến
  muộn phải được xử lý theo tiền thực tế đã nhận.
- Thu công nợ thủ công vẫn không được chủ động vượt nợ. Ngoại lệ QĐ5 áp dụng
  cho tiền bên ngoài đã thực nhận, không phải cho người dùng nhập thu vượt nợ.
- Tiền trả ngay đã nhận nhưng không xuất được chuyển sang chứng từ nhận tiền
  riêng: phân bổ phần nợ có thể trả, phần dư thành dư có, không lập phiếu xuất giả.

### Q12 — Có giảm hạn mức xuống thấp hơn nợ đang có?

**Vấn đề:** quy định hạn mức có thể thay đổi, nhưng nợ đã phát sinh không tự
giảm theo quy định mới.

Ví dụ đã thảo luận: loại 1 có hạn mức 10 triệu, một đại lý đang nợ 8 triệu.
Quản lý muốn giảm hạn mức loại 1 xuống 5 triệu.

#### Phương án 1 — Chặn thay đổi đến khi số dư phù hợp

1. Kiểm tra tất cả đại lý thuộc loại bị thay đổi.
2. Nếu còn đại lý nợ hơn 5 triệu, từ chối lưu hạn mức mới và liệt kê các đại
   lý gây chặn.
3. Thu nợ hoặc điều chỉnh giảm nợ hợp lệ trước.
4. Kiểm tra lại rồi mới cho đổi hạn mức.

Với đại lý trong ví dụ, thu ít nhất 3 triệu sẽ đưa nợ từ 8 xuống 5 triệu.
Chỉ được hạ hạn mức khi các đại lý khác của loại đó cũng đã đáp ứng mức mới.

Ưu điểm là giữ quy tắc dư nợ hiện tại không vượt hạn mức, ít ngoại lệ cho
xác nhận và sửa/hủy. Đánh đổi là thay đổi chính sách phải chờ thu hồi nợ.

#### Phương án 2 — Cho hạ hạn mức, giữ nợ cũ vượt mức

Lưu hạn mức 5 triệu nhưng vẫn giữ nợ 8 triệu, đánh dấu đại lý đang vượt mức.
Vẫn cho thu nợ và xử lý giảm nợ; không cho xuất thêm nếu kết quả giao dịch
chưa đáp ứng hạn mức mới.

Ưu điểm là chính sách có hiệu lực ngay. Đánh đổi là phải quản lý nợ cũ vượt
mức và bổ sung ngoại lệ vào các quy tắc kiểm tra.

**Phương án đã chọn: 1.** Đổi loại đại lý cũng chỉ được thực hiện khi nợ hiện
tại không vượt hạn mức loại mới. Thay đổi quy định không sửa lại snapshot
hạn mức đã dùng ở thời điểm ghi nhận chứng từ lịch sử.

### Q13 — Giá nhập gần nhất theo ngày nghiệp vụ hay xác nhận?

**Vấn đề:** “phiếu nhập gần nhất” có thể là ngày hàng nhập thực tế hoặc lần
cuối nhân viên nhập/xác nhận dữ liệu. Nhập bổ sung chứng từ cũ làm hai thứ tự
này khác nhau.

Ví dụ đã thảo luận:

| Phiếu | Ngày nghiệp vụ | Ngày xác nhận trên hệ thống | Đơn giá nhập |
| --- | --- | --- | ---: |
| PN-001 | 10/6 | 10/6 | 100.000đ |
| PN-002 | 5/6 | 12/6, nhập bổ sung muộn | 90.000đ |

| Phương án | Giá hiện tại sau khi xác nhận PN-002 | Cách hiểu |
| --- | ---: | --- |
| **1 — ngày nghiệp vụ** | **100.000đ** | PN-001 là nghiệp vụ nhập mới hơn |
| 2 — thứ tự xác nhận | 90.000đ | PN-002 là phiếu vừa được xác nhận sau cùng |

**Phương án đã chọn: 1.** Nhập muộn PN-002 không làm thay giá hiện tại thành
90.000đ chỉ vì nó được nhập vào phần mềm sau PN-001.

Quy tắc xác định nguồn giá:

1. Chỉ xét phiếu nhập đã xác nhận, còn hiệu lực, với nội dung phiên bản hiện hành.
2. Ưu tiên ngày nghiệp vụ mới nhất.
3. Cùng ngày thì dùng thứ tự xác nhận ban đầu và mã nội bộ để phá hòa ổn định.
4. Sửa phiếu cũ không làm phiếu thành mới nhất chỉ vì `updatedAt` thay đổi.
5. Hủy phiếu nguồn thì lấy giá từ phiếu hợp lệ kế tiếp.

Trong ví dụ, nếu hủy PN-001 và PN-002 vẫn hợp lệ, giá hiện tại về 90.000đ.
Nếu không còn nguồn giá nhập hợp lệ, giá hiện tại về 0 và chặn xuất mới khi
chưa có giá được xác lập. Giá phiếu xuất đã ghi nhận không bị tự đổi theo
việc xác định lại giá hiện tại.

### Q14 — Giá xuất chốt khi chờ xuất hay khi kho xác nhận?

**Vấn đề:** kinh doanh và kho có thể xử lý phiếu vào hai ngày khác nhau. Nếu
giá hiện tại thay đổi giữa hai bước, phải biết giá nào quyết định tổng tiền
và khoản trả ngay.

Ví dụ đã thảo luận:

| Ngày | Sự kiện | Giá xuất hiện tại |
| --- | --- | ---: |
| 10/6 | Kinh doanh gửi phiếu chờ xuất | 102.000đ/sản phẩm |
| 11/6 | Có lần nhập mới làm thay đổi giá | 112.200đ/sản phẩm |
| 12/6 | Kho xác nhận xuất | 112.200đ/sản phẩm trên danh mục hiện tại |

#### Phương án 1 — Chốt khi chuyển sang chờ xuất

Phiếu gửi ngày 10/6 vẫn dùng 102.000đ khi kho xác nhận ngày 12/6.

1. Nháp hiển thị giá dự kiến, có thể tính lại.
2. Chuyển chờ xuất thì lưu giá nhập nguồn, tỷ lệ và giá xuất của phiếu.
3. Kế toán xác nhận khoản trả ngay dựa trên tổng tiền đã chốt.
4. Kho kiểm tra lại tồn, trạng thái và hạn mức; không tự đổi giá phiếu.

Ưu điểm là tổng tiền không bất ngờ thay đổi sau khi đã thống nhất khoản trả.
Đánh đổi là có phiếu chờ xuất dùng giá khác với giá bán hiện tại trên danh mục.

#### Phương án 2 — Chốt lúc kho xác nhận

Phiếu dùng 112.200đ ngày 12/6. Giá sát thời điểm thực xuất hơn, nhưng tổng
tiền và số tiền cần trả có thể đổi sau bước kế toán xác nhận; phải kiểm tra
và xác nhận thanh toán lại nếu bị ảnh hưởng.

**Phương án đã chọn: 1.** Nếu sửa nội dung phiếu đang chờ, phải tạo nội dung
mới, kiểm tra lại và xác nhận lại khoản trả ngay liên quan. Phiếu đã ghi nhận
không tự đổi giá hoặc tỷ lệ khi danh mục/quy định thay đổi.

### Q15 — Quy ước số lượng và tiền

**Vấn đề:** tỷ lệ giá xuất và số lượng cân/đo có thể tạo phần lẻ. Cần một quy
tắc thống nhất giữa giá, thành tiền, tổng phiếu, số dư và thanh toán thực tế.

| Nội dung | Phương án 1 | Phương án 2 |
| --- | --- | --- |
| Số lượng | Tối đa 3 chữ số thập phân | 2 chữ số thập phân |
| Đơn vị đếm như cái/chai | Chỉ số nguyên | Cần quy tắc đơn vị tương ứng |
| Đơn vị đo như kg | Có thể cho phần lẻ | Có phần lẻ trong giới hạn 2 số |
| Giá và số tiền | Đồng nguyên VNĐ | Giữ 2 chữ số lẻ của đồng |
| Cổng nhận tiền nguyên VNĐ | Khớp đơn vị thanh toán | Cần xử lý công nợ lẻ/chênh lệch làm tròn |

#### Ví dụ tính tiền đã thảo luận

Giá nhập 99đ, tỷ lệ giá xuất 1,02, xuất 1,250 kg:

| Bước | Phép tính | Kết quả |
| --- | --- | ---: |
| Tính giá xuất trước làm tròn | 99 * 1,02 | 100,98đ |
| Làm tròn đơn giá đến đồng | Làm tròn 100,98 | 101đ |
| Tính thành tiền trước làm tròn | 1,250 * 101 | 126,25đ |
| Làm tròn thành tiền dòng | Làm tròn 126,25 | 126đ |

Theo phương án 1, giá bán đã chốt là 101đ và thành tiền dòng là 126đ. Tổng
phiếu bằng tổng các dòng đã làm tròn, không tính tổng bằng số thực rồi làm
tròn theo một cách khác.

**Phương án đã chọn: 1 — số lượng tối đa 3 số lẻ, tiền nguyên VNĐ.**

Quy tắc đi kèm:

- Đơn vị đếm không nhận lượng như 1,250 cái; đơn vị đo chỉ cho phần lẻ khi
  được cấu hình phù hợp.
- Không dùng `float` cho tiền hoặc phép tính nghiệp vụ; dùng số thập phân chính xác.
- Tỷ lệ giá được lưu riêng đủ độ chính xác, không làm tròn tỷ lệ thành số nguyên.
- Làm tròn giá xuất trước, sau đó làm tròn từng dòng; tổng tiền là tổng dòng.
- Từ chối đầu vào không hợp lệ như tiền 1,5đ hoặc lượng có phần lẻ vượt mức
  cho phép, không để kiểu lưu trữ âm thầm làm tròn thay người dùng.

Người dùng yêu cầu tạo file `business_decision_making.md` sau khi chọn phương
án này, với đầy đủ phương án và lựa chọn được làm nổi bật.

## 3. Quy ước triển khai bổ sung, không phải câu trả lời interview

| Quy ước | Lý do/cách thực hiện |
| --- | --- |
| Một mặt hàng một dòng trong mỗi phiên bản | Phần mở rộng BA đã đề xuất gộp dòng; tránh giá nhập “gần nhất” mơ hồ khi cùng phiếu có nhiều giá cho một hàng |
| Đơn vị mặt hàng không đổi sau khi đã ghi nhận | Bảo toàn thẻ kho; muốn đổi bản chất đơn vị tạo mặt hàng mới. Chưa làm quy đổi bao/thùng/lô/serial |
| Trả hàng một phần được hỗ trợ | Tổng số lượng trả không vượt lượng bán, giá theo dòng gốc; làm tròn lũy kế để trả đủ không vượt tiền gốc |
| Refund theo một nguồn phiếu thu mỗi chứng từ | Truy được nguồn tiền, đặc biệt khi hoàn về giao dịch online gốc; có thể lập nhiều refund cho nhiều nguồn |
| Reservation cho refund, không cho thu online | Giữ dư có khi hoàn tiền đang chờ/unknown, tránh vừa hoàn vừa bù cùng một khoản |
| Không đổi khoản tiền trả ngay thực nhận bằng sửa phiếu đã ghi nhận | QĐ10 phải phân biệt sửa sai nội dung với thay đổi tiền thực tế. Giữ bằng chứng tiền; dùng chứng từ thu thêm/hoàn/bù phù hợp |
| Điều chỉnh kiểm kê đã xác nhận và refund đã trả tiền không được xóa ảnh hưởng như chưa từng xảy ra | Lưu bằng chứng thực tế; nghiệp vụ mới sửa tình trạng thực tế, không giả hủy tiền đã ra |
| Phân quyền chức năng, một nhóm mỗi tài khoản | Theo bộ QĐ11–13. BA chưa quy định đại lý do nhân viên nào phụ trách; chưa thêm row ownership suy đoán |
| Hạ giới hạn số đại lý bị chặn nếu nhỏ hơn số đang hoạt động | Cụ thể hóa tính đúng đắn tương tự quyết định hạ hạn mức; không tự đuổi đại lý |
| Snapshot tên/đơn vị/liên hệ trên chứng từ | Bản in lịch sử không thay đổi khi danh mục/hồ sơ đổi; dữ liệu chủ vẫn chuẩn hóa bằng FK |

### 3.1. Ví dụ bổ sung: làm tròn khi trả hàng từng phần

Đây là ví dụ giải thích quy ước triển khai từ quyết định Q15, không phải một
lựa chọn mới trong interview.

Một mặt hàng đo lường bán 1 đơn vị, giá 1đ; thành tiền gốc là 1đ. Đại lý trả
hai lần, mỗi lần 0,5 đơn vị. Nếu làm tròn từng lần độc lập, mỗi lần có thể là
1đ, khiến tổng giá trị trả thành 2đ dù tiền hàng gốc chỉ 1đ.

Quy ước làm tròn lũy kế:

```text
Giá trị lần trả này
 = làm tròn(tổng lượng trả đến lần này * giá bán gốc)
 - tổng giá trị các lần trả trước
```

| Lần trả | Lượng trả lần này | Lượng trả lũy kế | Giá trị trả lũy kế đã làm tròn | Giá trị riêng lần này |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0,5 | 0,5 | 1đ | 1đ |
| 2 | 0,5 | 1 | 1đ | 0đ |

Tổng hàng trả là 1 đơn vị, tổng giá trị trả là 1đ. Lần thứ hai vẫn phải tăng
kho 0,5 đơn vị dù giá trị tiền của riêng lần đó bằng 0.

### 3.2. Ví dụ bổ sung: giữ dư có khi hoàn tiền đang chờ

Đây là cách triển khai bảo đảm một khoản dư có không được sử dụng hai lần.

Giả sử đại lý có dư có 1 triệu và kế toán yêu cầu hoàn toàn bộ 1 triệu online:

| Giai đoạn | Dư có còn ghi nhận | Đang dành cho refund | Còn có thể dùng bù trừ |
| --- | ---: | ---: | ---: |
| Trước yêu cầu hoàn | 1 triệu | 0 | 1 triệu |
| Hoàn đang chờ hoặc chưa rõ kết quả | 1 triệu | 1 triệu | 0 |
| Hoàn thành công | 0 | 0 | 0 |
| Hoàn thất bại được xác nhận chắc chắn | 1 triệu | 0 | 1 triệu |

Không coi timeout là bằng chứng hoàn thất bại để giải phóng tiền ngay. Khi
kết quả chưa rõ, giữ phần đã dành và kiểm tra trạng thái giao dịch trước khi
thử lại. Đây là giữ **dư có cho hoàn tiền**, khác với phương án giữ **công nợ
cho thu online** ở Q11 mà người dùng đã không chọn.
