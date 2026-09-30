# **2.1 Danh sách các yêu cầu**

| STT | Tên yêu cầu | Loại yêu cầu | Biểu mẫu | Quy định | Ghi chú |
| ----- | ----- | ----- | ----- | ----- | ----- |
| 1 | Tiếp nhận đại lý | Nghiệp vụ | BM1 | QĐ1 | Gồm cập nhật hồ sơ, đổi loại, ngừng hợp tác (không mở lại; muốn hợp tác lại thì lập đại lý mới); chỉ xóa khi chưa phát sinh giao dịch |
| 2 | Lập phiếu nhập hàng | Nghiệp vụ | BM2 | QĐ2 |   |
| 3 | Lập phiếu xuất hàng | Nghiệp vụ | BM3 | QĐ3 | Tự sinh phiếu thu nếu có trả ngay |
| 4 | Tra cứu đại lý | Nghiệp vụ | BM4 |  |   |
| 5 | Lập phiếu thu tiền | Nghiệp vụ | BM5 | QĐ5 |   |
| 6 | Lập báo cáo tháng | Nghiệp vụ | BM6.1 BM6.2 | QĐ6 |   |
| 7 | Thay đổi quy định | Nghiệp vụ |   | QĐ7 |   |
| 8 | Quản lý loại đại lý | Nghiệp vụ | BM8 | QĐ8 |   |
| 9 | Quản lý mặt hàng và đơn vị tính | Nghiệp vụ | BM9.1 BM9.2 | QĐ9 | Không quản lý danh mục (nhóm hàng) |
| 10 | Sửa / hủy phiếu nhập, phiếu xuất, phiếu thu | Nghiệp vụ | BM10 | QĐ10 |  |
| 11 | Quản lý tài khoản | Hệ thống | BM11 | QĐ11 |  |
| 12 | Quản lý nhóm người dùng | Hệ thống | BM12 | QĐ12 |   |
| 13 | Phân quyền chức năng | Hệ thống | BM13 | QĐ13 |   |
| 14 | Quản lý nhật ký hệ thống | Hệ thống | BM14 | QĐ14 |   |
| 15 | Thanh toán trực tuyến | Nghiệp vụ | BM15 | QĐ15 |  |
| 16 | Tra cứu qua chatbot | Hệ thống | BM16 | QĐ16 | Tra cứu dư nợ, tồn kho, doanh số |

# **2.2 Danh sách các biểu mẫu và quy định**

## **2.2.1 Xét yêu cầu Tiếp nhận đại lý**

### *2.2.1.1 Biểu mẫu 1 và quy định 1*

| BM1: Hồ Sơ Đại Lý |  |
| :---- | :---- |
| Mã đại lý**:** | Tên: |
| Loại đại lý: | Điện thoại: |
| Địa chỉ: | Quận: |
| Ngày tiếp nhận: | Email:  |
| Tình trạng: ☐ Đang hoạt động   ☐ Ngừng hợp tác |  |

**QĐ1:** Có 2 loại đại lý (1, 2). Có 20 quận. Trong mỗi quận có tối đa 4 đại lý đang hoạt động.

### *2.2.1.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image1]  
b. Mô tả các luồng dữ liệu

- D1: Danh sách Đại lý (Tên đại lý, loại đại lý, điện thoại, địa chỉ, quận, ngày tiếp nhận, email).  
- D2: Không có  
- D3: Danh sách các Loại đại lý (kèm Tình trạng), danh sách các Quận, số đại lý tối đa trong mỗi quận, danh sách Mã đại lý, danh sách Đại lý đang hoạt động tương ứng với quận (trong D1).  
- D4: D1 \+ Mã đại lý (tự sinh) \+ Tình trạng (= Đang hoạt động) \+ Dư nợ (= 0 VNĐ)  
- D5: D4  
- D6: Không có

c. Thuật toán

- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Kiểm tra Loại đại lý (D1) ∈ {1, 2} (D3) hay không?  
- B5:  Kiểm tra Loại đại lý (D1) có Tình trạng \= "Đang sử dụng" (D3) hay không?  
- B6:  Kiểm tra Quận (D1) ∈ danh sách 20 quận (D3) hay không?  
- B7:  Tính SoDaiLyHienCo \= số đại lý trong D3 có Quận \= Quận (D1) và Tình trạng \= "Đang hoạt động"  
  trong đó: đếm bản ghi đại lý (D3), không đếm đại lý "Ngừng hợp tác"  
  phạm vi:  theo quận (D1), tính trước khi thêm đại lý mới  
- B8:  Kiểm tra SoDaiLyHienCo \< 4 hay không?  
- B9:  Nếu không thỏa mãn 1 trong các điều kiện trên thì đến B14  
- B10: Gán Tình trạng \= "Đang hoạt động" và Dư nợ \= 0 VNĐ cho đại lý mới  
- B11: Hệ thống tự sinh Mã đại lý (duy nhất)  
- B12: Lưu D4 xuống bộ nhớ phụ  
- B13: Xuất D5 ra máy in  
- B14: Đóng kết nối cơ sở dữ liệu  
- B15: Kết thúc

## **2.2.2 Xét yêu cầu Lập phiếu nhập hàng**

### *2.2.2.1 Biểu mẫu 2 và quy định 2*

| BM2: Phiếu Nhập Hàng |  |  |  |  |  |  |
| ----- | ----- | ----- | :---- | ----- | ----- | ----- |
| Số phiếu:  |  |  | Ngày lập phiếu: |  |  |  |
| Trạng thái:  ☐ Hiệu lực   ☐ Đã hủy |  |  |   |  |  |  |
| **STT** | **Mặt Hàng** | **Đơn Vị Tính** |  | **Số Lượng** | **Đơn Giá** | **Thành Tiền** |
| 1 |   |   |  |   |   |   |
| 2 |   |   |  |   |   |   |
| Tổng tiền:………………… |  |  |  |  |  |  |

**QĐ2:** Có 5 mặt hàng, 3 đơn vị tính.

###  *2.2.2.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image2]  
b. Mô tả các luồng dữ liệu

- D1: Ngày lập phiếu, danh sách mặt hàng nhập (mặt hàng, số lượng, đơn giá).  
- D2: Không có  
- D3: Danh sách các Mặt hàng (kèm Tình trạng, Đơn vị tính, Tồn kho hiện tại, Đơn giá nhập hiện tại), danh sách các Đơn vị tính (kèm Tình trạng).  
- D4: D1 \+ Số phiếu (tự sinh) \+ Trạng thái (= Hiệu lực) \+ STT \+ Đơn vị tính \+ Thành tiền \+ Tổng tiền \+ Tồn kho mới \+ Đơn giá nhập hiện tại mới của các mặt hàng trên phiếu  
- D5: D4  
- D6: Không có

c. Thuật toán

- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Kiểm tra Mặt hàng(i) (D1) ∈ danh sách 5 mặt hàng (D3) hay không, với mỗi dòng i?  
- B5:  Kiểm tra Mặt hàng(i) (D1) có Tình trạng \= "Đang KD" (D3) hay không, với mỗi dòng i?  
- B6:  Kiểm tra Đơn vị tính của Mặt hàng(i) (D3) ∈ danh sách 3 đơn vị tính (D3) hay không, với mỗi dòng i?  
- B7:  Kiểm tra Đơn vị tính của Mặt hàng(i) (D3) có Tình trạng \= "Đang sử dụng" (D3) hay không, với mỗi dòng i?  
- B8:  Nếu không thỏa mãn 1 trong các điều kiện trên thì đến B17  
- B9:  Tính ThanhTien(i) \= SoLuong(i) × DonGia(i), với mỗi dòng i  
-          trong đó: SoLuong(i), DonGia(i) từ D1; đơn vị VNĐ  
-          phạm vi:  từng dòng i của phiếu  
- B10: Tính TongTien \= Σ ThanhTien(i), i \= 1…n  
-          trong đó: n là số dòng của phiếu; đơn vị VNĐ  
-          phạm vi:  toàn bộ phiếu  
- B11: Tính TonKhoMoi(m) \= TonKho(m) \+ Σ SoLuong(i), với i là các dòng có Mặt hàng(i) \= m  
  trong đó: TonKho(m) là tồn kho hiện tại của mặt hàng m (D3), SoLuong(i) từ D1; đơn vị là đơn vị tính của mặt hàng m  
  phạm vi:  từng mặt hàng m có trên phiếu, tính trước khi lưu  
- B12: Tính DonGiaNhapMoi(m) \= DonGia(i), với i là dòng có Mặt hàng(i) \= m  
  trong đó: DonGia(i) từ D1 ghi đè đơn giá nhập hiện tại của mặt hàng m (D3); đơn vị VNĐ  
  phạm vi:  từng mặt hàng m có trên phiếu  
- B13: Gán Trạng thái \= "Hiệu lực" cho phiếu nhập mới  
- B14: Hệ thống tự sinh Số phiếu (duy nhất)  
- B15: Lưu D4 xuống bộ nhớ phụ  
- B16: Xuất D5 ra máy in  
- B17: Đóng kết nối cơ sở dữ liệu  
- B18: Kết thúc

## **2.2.3 Xét yêu cầu Lập phiếu xuất hàng**

### *2.2.3.1 Biểu mẫu 3 và quy định 3*

| BM3: Phiếu Xuất Hàng |  |  |  |  |  |  |
| ----- | ----- | ----- | :---- | ----- | ----- | ----- |
| Số phiếu:  |  |  | Ngày lập phiếu: |  |  |  |
| Mã đại lý: |  |  | Trạng thái:  ☐ Hiệu lực   ☐ Đã hủy |  |  |  |
| **STT** | **Mặt Hàng** | **Đơn Vị Tính** |  | **Số Lượng** | **Đơn Giá** | **Thành Tiền** |
| 1 |   |   |  |   |   |   |
| 2 |   |   |  |   |   |   |
| Tổng tiền:…………………   Số tiền trả:…………………   Còn lại:………………… |  |  |  |  |  |  |

**QĐ3:** Đại lý loại 1 có tiền nợ tối đa là 10.000.000đ, loại 2 có tiền nợ tối đa là 5.000.000đ. Đơn giá xuất \= 102% Đơn giá nhập. Số tiền trả phải thỏa 0 ≤ Số tiền trả ≤ Tổng tiền phiếu xuất. Dư nợ mới \= Dư nợ hiện tại \+ Tổng tiền phiếu xuất − Số tiền trả và không được vượt tiền nợ tối đa của loại đại lý. Nếu số tiền trả lớn hơn 0, hệ thống tự sinh phiếu thu (BM5) liên kết với phiếu xuất.

### *2.2.3.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image3]  
b. Mô tả các luồng dữ liệu

- D1: Ngày lập phiếu, mã đại lý, danh sách mặt hàng xuất (mặt hàng, số lượng), số tiền trả.  
- D2: Không có  
- D3: Danh sách Mã đại lý và Tên đại lý, loại đại lý, tình trạng và dư nợ hiện tại của đại lý (có Mã trong D1), danh sách các Loại đại lý, tiền nợ tối đa của từng loại đại lý, danh sách các Mặt hàng (kèm Tình trạng, Đơn vị tính, Tồn kho hiện tại, Đơn giá nhập hiện tại), danh sách các Đơn vị tính (kèm Tình trạng), tỉ lệ tính đơn giá xuất.  
- D4: D1 \+ Số phiếu (tự sinh) \+ Trạng thái (= Hiệu lực) \+ STT \+ Đơn vị tính \+ Đơn giá (xuất) \+ Thành tiền \+ Tổng tiền \+ Còn lại \+ Tồn kho mới của các mặt hàng trên phiếu \+ Dư nợ mới của đại lý \+ Phiếu thu (nếu Số tiền trả \> 0\)  
  Phiếu thu (nếu Số tiền trả \> 0\) \= Số phiếu thu (tự sinh), Ngày thu tiền, Mã đại lý, Số tiền thu, Loại phiếu thu (= Tự sinh từ phiếu xuất), Phiếu xuất liên quan, Trạng thái (= Hiệu lực)  
- D5: D4  
- D6: Không có

c. Thuật toán 

- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Kiểm tra Mã đại lý (D1) ∈ danh sách Mã đại lý (D3) hay không?  
- B5:  Kiểm tra Tình trạng của đại lý (có Mã trong D1) (D3) \= "Đang hoạt động" hay không?  
- B6:  Kiểm tra Mặt hàng(i) (D1) ∈ danh sách 5 mặt hàng (D3) hay không, với mỗi dòng i?  
- B7:  Kiểm tra Mặt hàng(i) (D1) có Tình trạng \= "Đang KD" (D3) hay không, với mỗi dòng i?  
- B8:  Kiểm tra Đơn vị tính của Mặt hàng(i) (D3) ∈ danh sách 3 đơn vị tính (D3) hay không, với mỗi dòng i?  
- B9:  Kiểm tra Đơn vị tính của Mặt hàng(i) (D3) có Tình trạng \= "Đang sử dụng" (D3) hay không, với mỗi dòng i?  
- B10: Kiểm tra SoLuong(i) (D1) ≤ TonKho(m) (D3) hay không, với mỗi dòng i và m là mặt hàng của dòng i?  
  trong đó: TonKho(m) là tồn kho hiện tại của mặt hàng m, tính trước khi xuất  
- B11: Tính DonGiaXuat(i) \= DonGiaNhap(m) × 102%, với mỗi dòng i  
-          trong đó: DonGiaNhap(m) là đơn giá nhập hiện tại của mặt hàng m (D3) tại thời điểm lập phiếu; đơn vị VNĐ  
-          phạm vi:  từng dòng i của phiếu  
- B12: Tính ThanhTien(i) \= SoLuong(i) × DonGiaXuat(i), với mỗi dòng i  
-          trong đó: SoLuong(i) từ D1, DonGiaXuat(i) từ B11; đơn vị VNĐ  
-          phạm vi:  từng dòng i của phiếu  
- B13: Tính TongTien \= Σ ThanhTien(i), i \= 1…n  
-          trong đó: n là số dòng của phiếu; đơn vị VNĐ  
-          phạm vi:  toàn bộ phiếu  
- B14: Kiểm tra SoTienTra (D1) ≥ 0 hay không?  
- B15: Kiểm tra SoTienTra (D1) ≤ TongTien hay không?  
- B16: Tính ConLai \= TongTien − SoTienTra  
-          trong đó: SoTienTra từ D1; đơn vị VNĐ  
-          phạm vi:  toàn bộ phiếu  
- B17: Tính TienNoToiDa \= 10.000.000 nếu Loại đại lý (D3) \= 1; \= 5.000.000 nếu Loại đại lý (D3) \= 2  
-          trong đó: đơn vị VNĐ, theo tiền nợ tối đa của từng loại đại lý (D3)  
-          phạm vi:  loại của đại lý (có Mã trong D1)  
- B18: Tính DuNoMoi \= DuNoHienTai \+ ConLai  
-          trong đó: DuNoHienTai là dư nợ hiện tại của đại lý (có Mã trong D1) (D3), ConLai từ B16; đơn vị VNĐ  
-          phạm vi:  đại lý (D1), tính trước khi lưu  
- B19: Kiểm tra DuNoMoi ≤ TienNoToiDa hay không?  
- B20: Nếu không thỏa mãn 1 trong các điều kiện trên thì đến B27  
- B21: Tính TonKhoMoi(m) \= TonKho(m) − SoLuong(i), với i là dòng có Mặt hàng(i) \= m  
-          trong đó: TonKho(m) từ D3, SoLuong(i) từ D1; đơn vị là đơn vị tính của mặt hàng m  
-          phạm vi:  từng mặt hàng m có trên phiếu, tính trước khi lưu  
- B22: Gán Trạng thái \= "Hiệu lực" cho phiếu xuất mới  
- B23: Hệ thống tự sinh Số phiếu xuất (duy nhất)  
- B24: Nếu SoTienTra (D1) \> 0 thì tạo Phiếu thu tự sinh gồm:  
-          Số phiếu thu \= hệ thống tự sinh (duy nhất)  
-          Ngày thu tiền \= Ngày lập phiếu (D1)  
-          Mã đại lý \= Mã đại lý (D1)  
-          Số tiền thu \= SoTienTra (D1)  
-          Loại phiếu thu \= "Tự sinh từ phiếu xuất"  
-          Phiếu xuất liên quan \= Số phiếu xuất (B23)  
-          Trạng thái \= "Hiệu lực"  
- B25: Lưu D4 xuống bộ nhớ phụ  
- B26: Xuất D5 ra máy in  
- B27: Đóng kết nối cơ sở dữ liệu  
- B28: Kết thúc

## **2.2.4 Xét yêu cầu Tra cứu đại lý**

### *2.2.4.1 Biểu mẫu 4*

| BM4: Danh Sách Các Đại Lý |  |  |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| **STT** | **Mã Đại Lý** | **Tên** | **Loại** | **Quận** | **Tiền Nợ** | **Điện Thoại**  | **Tình Trạng** |
| 1 |   |   |   |   |   |   |   |
| 2 |   |   |   |   |   |   |   |

### *2.2.4.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image4]  
b. Mô tả các luồng dữ liệu

- D1: Mã đại lý, tên, loại, quận, điện thoại, tiền nợ từ, tiền nợ đến, tình trạng.  
- D2: Không có  
- D3: Danh sách các đại lý thỏa tiêu chuẩn D1 (STT, mã đại lý, tên, loại, quận, tiền nợ, điện thoại, tình trạng).  
- D4: Không có  
- D5: D3  
- D6: D5

c. Thuật toán 

- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Xuất D5 ra máy in  
- B5: Trả D6 cho người dùng  
- B6: Đóng kết nối cơ sở dữ liệu  
- B7: Kết thúc

## **2.2.5 Xét yêu cầu Lập phiếu thu tiền**

### *2.2.5.1 Biểu mẫu 5 và quy định 5*

| BM5: Phiếu Thu Tiền |  |
| :---- | :---- |
| Số phiếu: | Ngày thu tiền: |
| Mã đại lý: | Địa chỉ: |
| Điện thoại: | Email: |
| Số tiền thu: | Phương thức thanh toán:   ☐ Tiền mặt   ☐ Chuyển khoản   ☐ Trực tuyến |
| Loại phiếu thu:  ☐ Tự sinh từ phiếu xuất   ☐ Thu công nợ | Phiếu xuất liên quan (nếu có): |
| Trạng thái:  ☐ Hiệu lực   ☐ Đã hủy |   |

**QĐ5:** Số tiền thu không vượt quá số tiền đại lý đang nợ. Có 2 loại phiếu thu: tự sinh từ phiếu xuất khi có trả ngay và phiếu thu công nợ do kế toán lập sau đó. Phương thức "Trực tuyến" chỉ áp dụng khi giao dịch thanh toán (BM15) thành công.

### *2.2.5.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image5]  
b. Mô tả các luồng dữ liệu

- D1: Ngày thu tiền, mã đại lý, số tiền thu, phương thức thanh toán (Tiền mặt hoặc Chuyển khoản).  
- D2: Không có  
- D3: Danh sách Mã đại lý và Tên đại lý, dư nợ hiện tại, địa chỉ, điện thoại và email của đại lý (có Mã trong D1).  
- D4: D1 \+ Số phiếu (tự sinh) \+ Loại phiếu thu (= Thu công nợ) \+ Trạng thái (= Hiệu lực) \+ Dư nợ mới của đại lý  
- D5: D4 \+ địa chỉ, điện thoại, email của đại lý (D3)  
- D6: Không có

c. Thuật toán 

- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Kiểm tra Mã đại lý (D1) ∈ danh sách Mã đại lý (D3) hay không?  
- B5:  Kiểm tra Phương thức thanh toán (D1) ∈ {"Tiền mặt", "Chuyển khoản"} hay không?  
- B6:  Kiểm tra SoTienThu (D1) ≤ DuNoHienTai hay không?  
  trong đó: DuNoHienTai là dư nợ hiện tại của đại lý (có Mã trong D1) (D3), tính trước khi thu; đơn vị VNĐ  
- B7:  Nếu không thỏa mãn 1 trong các điều kiện trên thì đến B13  
- B8:  Tính DuNoMoi \= DuNoHienTai − SoTienThu  
  trong đó: DuNoHienTai từ D3, SoTienThu từ D1; đơn vị VNĐ  
  phạm vi:  đại lý (D1), tính trước khi lưu  
- B9:  Gán Loại phiếu thu \= "Thu công nợ" và Trạng thái \= "Hiệu lực" cho phiếu thu mới  
- B10: Hệ thống tự sinh Số phiếu thu (duy nhất)  
- B11: Lưu D4 xuống bộ nhớ phụ  
- B12: Xuất D5 ra máy in  
- B13: Đóng kết nối cơ sở dữ liệu  
- B14: Kết thúc

## **2.2.6 Xét yêu cầu Lập báo cáo tháng**

### *2.2.6.1 Biểu mẫu 6*

**Biểu mẫu 6.1**

| BM6.1: Báo Cáo Doanh Số |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Tháng năm: |  |  |  |  |  |
| **STT** | **Mã Đại Lý**  | **Tên** | **Số Phiếu Xuất** | **Tổng Trị Giá** | **Tỷ Lệ** |
| 1 |   |   |   |   |   |
| 2 |   |   |   |   |   |

**Biểu mẫu 6.2**

| BM6.2: Báo Cáo Công Nợ Đại Lý |  |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Tháng năm: |  |  |  |  |  |  |
| **STT** | **Mã Đại Lý**  | **Tên** | **Nợ Đầu** | **Phát Sinh** |  | **Nợ Cuối** |
|  |  |  |  | **Tăng**  | **Giảm**  |  |
| 1 |   |   |   |   |   |   |
| 2 |   |   |   |   |   |   |

**QĐ6:** BM6.1: Tỷ lệ \= Tổng trị giá của đại lý ÷ tổng trị giá tất cả đại lý × 100%. BM6.2: Phát sinh tách thành Tăng (giá trị hàng xuất) và Giảm (tiền đã thu); Nợ cuối \= Nợ đầu \+ Tăng − Giảm.

### *2.2.6.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image6]  
b. Mô tả các luồng dữ liệu 

* Lập báo cáo doanh số  
- D1: Tháng, năm.  
- D2: Không có  
- D3: Danh sách các phiếu xuất hiệu lực có tháng-năm của Ngày lập phiếu \= tháng-năm (D1) (mã đại lý, tổng tiền), danh sách Mã đại lý và Tên đại lý.  
- D4: D1 \+ danh sách đại lý có phiếu xuất hiệu lực trong tháng (STT, mã đại lý, tên, số phiếu xuất, tổng trị giá, tỷ lệ) \+ tổng trị giá tất cả đại lý  
- D5: D4  
- D6: D5  
* Lập báo cáo công nợ đại lý  
- D1: Tháng, năm.  
- D2: Không có  
- D3: Danh sách các phiếu xuất hiệu lực có Ngày lập phiếu trước hoặc trong tháng-năm (D1) (mã đại lý, tổng tiền, ngày lập phiếu), danh sách các phiếu thu hiệu lực có Ngày thu tiền trước hoặc trong tháng-năm (D1) (mã đại lý, số tiền thu, ngày thu tiền), danh sách Mã đại lý và Tên đại lý.  
- D4: D1 \+ danh sách đại lý có phát sinh trong tháng (STT, mã đại lý, tên, nợ đầu, tăng, giảm, nợ cuối)  
- D5: D4  
- D6: D5

c. Thuật toán 

* Lập báo cáo doanh số  
- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Tính SoPhieuXuat(a) \= số phiếu xuất trong D3 có Mã đại lý \= a  
-          trong đó: đếm bản ghi phiếu xuất (không đếm dòng chi tiết); chỉ phiếu có Trạng thái \= "Hiệu lực" và tháng-năm của Ngày lập phiếu \= tháng-năm (D1)  
-          phạm vi:  từng đại lý a có ít nhất một phiếu xuất như trên  
- B5:  Tính TongTriGia(a) \= Σ TongTien(p), p là các phiếu xuất trong D3 có Mã đại lý \= a  
-          trong đó: TongTien(p) là tổng tiền của phiếu xuất p; chỉ phiếu có Trạng thái \= "Hiệu lực" và tháng-năm của Ngày lập phiếu \= tháng-năm (D1); đơn vị VNĐ  
-          phạm vi:  từng đại lý a của B4  
- B6:  Tính TongTriGiaTatCa \= Σ TongTriGia(a), a là mọi đại lý của B4  
-          trong đó: đơn vị VNĐ  
-          phạm vi:  toàn bộ báo cáo  
- B7:  Tính TiLe(a) \= TongTriGia(a) / TongTriGiaTatCa × 100%  
-          trong đó: TongTriGia(a) từ B5, TongTriGiaTatCa từ B6; đơn vị %; nếu TongTriGiaTatCa \= 0 thì TiLe \= 0  
-          phạm vi:  từng đại lý a của B4  
- B8:  Lưu D4 xuống bộ nhớ phụ  
- B9:  Xuất D5 ra máy in  
- B10: Trả D6 cho người dùng  
- B11: Đóng kết nối cơ sở dữ liệu  
- B12: Kết thúc  
* Lập báo cáo công nợ đại lý  
- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Tính NoDau(a) \= Σ TongTien(p) − Σ SoTienThu(q)  
-          trong đó: p là các phiếu xuất Hiệu lực có Mã đại lý \= a và Ngày lập phiếu trước ngày 1 của tháng-năm (D1);  
-                    q là các phiếu thu Hiệu lực có Mã đại lý \= a và Ngày thu tiền trước ngày 1 của tháng-năm (D1); đơn vị VNĐ  
-          phạm vi:  từng đại lý a có phiếu trong D3 (dư nợ ban đầu của đại lý \= 0\)  
- B5:  Tính Tang(a) \= Σ TongTien(p)  
-          trong đó: p là các phiếu xuất Hiệu lực có Mã đại lý \= a và tháng-năm của Ngày lập phiếu \= tháng-năm (D1); đơn vị VNĐ  
-          phạm vi:  từng đại lý a của B4  
- B6:  Tính Giam(a) \= Σ SoTienThu(q)  
-          trong đó: q là các phiếu thu Hiệu lực có Mã đại lý \= a và tháng-năm của Ngày thu tiền \= tháng-năm (D1); đơn vị VNĐ  
-          phạm vi:  từng đại lý a của B4  
- B7:  Chọn các đại lý a có Tang(a) \> 0 hoặc Giam(a) \> 0 để đưa vào báo cáo  
- B8:  Tính NoCuoi(a) \= NoDau(a) \+ Tang(a) − Giam(a)  
-          trong đó: NoDau(a) từ B4, Tang(a) từ B5, Giam(a) từ B6; đơn vị VNĐ  
-          phạm vi:  từng đại lý a được chọn ở B7  
- B9:  Lưu D4 xuống bộ nhớ phụ  
- B10: Xuất D5 ra máy in  
- B11: Trả D6 cho người dùng  
- B12: Đóng kết nối cơ sở dữ liệu  
- B13: Kết thúc

## **2.2.7 Xét yêu cầu Thay đổi quy định**

### *2.2.7.1 Quy định 7*

**QĐ7:** Người dùng có thể thay đổi các quy định như sau:

●      QĐ1: Thay đổi số lượng các loại đại lý, thay đổi số đại lý tối đa trong quận.  
●      QĐ2: Thay đổi số lượng mặt hàng, thay đổi số lượng đơn vị tính.  
●      QĐ3: Thay đổi tiền nợ tối đa của từng loại đại lý, thay đổi tỉ lệ tính đơn giá xuất.

### *2.2.7.2 Sơ đồ luồng dữ liệu QĐ1*

a. Sơ đồ  
![][image7]  
b. Mô tả các luồng dữ liệu

* Thay đổi số lượng các loại đại lý  
- D1: Danh sách loại đại lý mới (loại đại lý, tiền nợ tối đa, tình trạng).  
- D2: Không có  
- D3: Danh sách các Loại đại lý (khóa: loại đại lý) đã có.  
- D4: D1 \+ STT \+ Nhật ký hệ thống (thời gian, người dùng, chức năng, thao tác, nội dung trước/sau)  
- D5: D4  
- D6: Không có  
* Thay đổi số đại lý tối đa trong quận  
- D1: Số đại lý tối đa trong mỗi quận (giá trị mới).  
- D2: Không có  
- D3: Số đại lý tối đa trong mỗi quận (giá trị hiện tại).  
- D4: D1 \+ Nhật ký hệ thống (thời gian, người dùng, chức năng, thao tác, nội dung trước/sau)  
- D5: Không có  
- D6: Không có

c. Thuật toán 

* Thay đổi số lượng các loại đại lý  
- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Kiểm tra các Loại đại lý (D1) có thuộc danh sách Loại đại lý (D3) hay không? Nếu có đến B7  
- B5: Lưu D4 xuống bộ nhớ phụ  
- B6: Xuất D5 ra máy in  
- B7: Đóng kết nối cơ sở dữ liệu  
- B8: Kết thúc  
* Thay đổi số đại lý tối đa trong quận  
- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Kiểm tra SoDaiLyToiDaTrongQuan (D1) ≠ 4 (D3) hay không?  
- B5: Nếu tất cả các tham số đều không thay đổi thì đến B7  
- B6: Lưu D4 xuống bộ nhớ phụ  
- B7: Đóng kết nối cơ sở dữ liệu  
- B8: Kết thúc

### *2.2.7.3 Sơ đồ luồng dữ liệu QĐ2*

a. Sơ đồ  
![][image8]  
b. Mô tả các luồng dữ liệu

* Thay đổi số lượng mặt hàng  
- D1: Danh sách mặt hàng mới (mặt hàng, đơn vị tính, tình trạng).  
- D2: Không có  
- D3: Danh sách các Mặt hàng (khóa: mặt hàng) đã có, danh sách các Đơn vị tính.  
- D4: D1 \+ STT \+ Tồn kho (= 0\) \+ Đơn giá nhập hiện tại (= 0 VNĐ) \+ Nhật ký hệ thống (thời gian, người dùng, chức năng, thao tác, nội dung trước/sau)  
- D5: D4  
- D6: Không có  
* Thay đổi số lượng đơn vị tính  
- D1: Danh sách đơn vị tính mới (đơn vị tính, tình trạng).  
- D2: Không có  
- D3: Danh sách các Đơn vị tính (khóa: đơn vị tính) đã có.  
- D4: D1 \+ STT \+ Nhật ký hệ thống (thời gian, người dùng, chức năng, thao tác, nội dung trước/sau)  
- D5: D4  
- D6: Không có

c. Thuật toán 

* Thay đổi số lượng mặt hàng  
- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Kiểm tra Đơn vị tính(i) (D1) ∈ danh sách Đơn vị tính (D3) hay không, với mỗi mặt hàng i?  
- B5:  Kiểm tra Mặt hàng(i) (D1) ∉ danh sách Mặt hàng (D3) hay không, với mỗi mặt hàng i?  
- B6:  Nếu không thỏa mãn 1 trong các điều kiện trên thì đến B10  
- B7:  Gán Tồn kho \= 0 và Đơn giá nhập hiện tại \= 0 VNĐ cho mỗi mặt hàng mới  
- B8:  Lưu D4 xuống bộ nhớ phụ  
- B9:  Xuất D5 ra máy in  
- B10: Đóng kết nối cơ sở dữ liệu  
- B11: Kết thúc  
* Thay đổi số lượng đơn vị tính  
- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Kiểm tra các Đơn vị tính (D1) có thuộc danh sách Đơn vị tính (D3) hay không? Nếu có đến B7  
- B5: Lưu D4 xuống bộ nhớ phụ  
- B6: Xuất D5 ra máy in  
- B7: Đóng kết nối cơ sở dữ liệu  
- B8: Kết thúc

### *2.2.7.4 Sơ đồ luồng dữ liệu QĐ3*

a. Sơ đồ  
![][image9]  
b. Mô tả các luồng dữ liệu

* Thay đổi tiền nợ tối đa của từng loại đại lý  
- D1: Tiền nợ tối đa của từng loại đại lý (loại 1, loại 2\) (giá trị mới).  
- D2: Không có  
- D3: Tiền nợ tối đa của từng loại đại lý (giá trị hiện tại).  
- D4: D1 \+ Nhật ký hệ thống (thời gian, người dùng, chức năng, thao tác, nội dung trước/sau)  
- D5: Không có  
- D6: Không có  
* Thay đổi tỉ lệ tính đơn giá xuất  
- D1: Tỉ lệ tính đơn giá xuất (giá trị mới).  
- D2: Không có  
- D3: Tỉ lệ tính đơn giá xuất (giá trị hiện tại).  
- D4: D1 \+ Nhật ký hệ thống (thời gian, người dùng, chức năng, thao tác, nội dung trước/sau)  
- D5: Không có  
- D6: Không có

c. Thuật toán 

* Thay đổi tiền nợ tối đa của từng loại đại lý  
- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Kiểm tra TienNoToiDa(loại 1\) (D1) ≠ 10.000.000 (D3) hay không?  
- B5: Kiểm tra TienNoToiDa(loại 2\) (D1) ≠ 5.000.000 (D3) hay không?  
- B6: Nếu tất cả các tham số đều không thay đổi thì đến B8  
- B7: Lưu D4 xuống bộ nhớ phụ  
- B8: Đóng kết nối cơ sở dữ liệu  
- B9: Kết thúc  
* Thay đổi tỉ lệ tính đơn giá xuất  
- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Kiểm tra TiLeDonGiaXuat (D1) ≠ 102% (D3) hay không?  
- B5: Nếu tất cả các tham số đều không thay đổi thì đến B7  
- B6: Lưu D4 xuống bộ nhớ phụ  
- B7: Đóng kết nối cơ sở dữ liệu  
- B8: Kết thúc

## **2.2.8 Xét yêu cầu Quản lý loại đại lý**

### *2.2.8.1 Biểu mẫu 8 và quy định 8*

| BM8: Danh Sách Loại Đại Lý |  |  |  |   |
| ----- | ----- | ----- | ----- | :---- |
| **STT** | **Loại Đại Lý** | **Tiền Nợ Tối Đa** | **Tình Trạng** |   |
| 1 |   |   |   |   |
| 2 |   |   |   |   |

**QĐ8:** Không xóa loại đại lý đã có đại lý đang sử dụng; chỉ chuyển trạng thái sang "Ngừng sử dụng". Loại đại lý ngừng sử dụng không được gán cho đại lý mới.

### *2.2.8.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image10]  
b. Mô tả các luồng dữ liệu

* Thêm loại đại lý

\- D1: Danh sách loại đại lý mới (loại đại lý, tiền nợ tối đa, tình trạng).  
\- D2: Không có  
\- D3: Danh sách các Loại đại lý (khóa: loại đại lý) đã có.  
\- D4: D1 \+ STT  
\- D5: D4  
\- D6: Không có

* Cập nhật loại đại lý

\- D1: Loại đại lý (chọn từ danh sách), tiền nợ tối đa, tình trạng (giá trị mới).  
\- D2: Không có  
\- D3: Danh sách các Loại đại lý (khóa: loại đại lý) đã có.  
\- D4: D1  
\- D5: D4  
\- D6: Không có

* Xóa loại đại lý

\- D1: Loại đại lý (chọn từ danh sách).  
\- D2: Không có  
\- D3: Danh sách các Loại đại lý (khóa: loại đại lý) đã có, danh sách các Đại lý tương ứng với loại đại lý (trong D1).  
\- D4: D1 (loại đại lý có Loại đại lý trong D1 bị xóa khỏi danh sách loại đại lý)  
\- D5: D4  
\- D6: Không có  
c. Thuật toán 

* Thêm loại đại lý  
- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Kiểm tra các Loại đại lý (D1) có thuộc danh sách Loại đại lý (D3) hay không? Nếu có đến B7  
- B5: Lưu D4 xuống bộ nhớ phụ  
- B6: Xuất D5 ra máy in  
- B7: Đóng kết nối cơ sở dữ liệu  
- B8: Kết thúc

* Cập nhật loại đại lý  
- B1: Nhận D1 từ người dùng  
- B2: Kết nối cơ sở dữ liệu  
- B3: Đọc D3 từ bộ nhớ phụ  
- B4: Kiểm tra Loại đại lý (D1) ∈ danh sách Loại đại lý (D3) hay không?  
- B5: Nếu không thỏa mãn điều kiện trên thì đến B8  
- B6: Lưu D4 xuống bộ nhớ phụ  
- B7: Xuất D5 ra máy in  
- B8: Đóng kết nối cơ sở dữ liệu  
- B9: Kết thúc

* Xóa loại đại lý  
- B1:  Nhận D1 từ người dùng  
- B2:  Kết nối cơ sở dữ liệu  
- B3:  Đọc D3 từ bộ nhớ phụ  
- B4:  Kiểm tra Loại đại lý (D1) ∈ danh sách Loại đại lý (D3) hay không?  
- B5:  Tính SoDaiLySuDung \= số đại lý trong D3 có Loại đại lý \= Loại đại lý (D1)  
-          trong đó: đếm bản ghi đại lý (D3), gồm cả đại lý "Ngừng hợp tác"  
-          phạm vi:  theo loại đại lý (D1)  
- B6:  Kiểm tra SoDaiLySuDung \= 0 hay không?  
- B7:  Nếu không thỏa mãn 1 trong các điều kiện trên thì đến B10  
- B8:  Lưu D4 xuống bộ nhớ phụ  
- B9:  Xuất D5 ra máy in  
- B10: Đóng kết nối cơ sở dữ liệu  
- B11: Kết thúc

## **2.2.9 Xét yêu cầu Quản lý mặt hàng và đơn vị tính**

### *2.2.9.1 Biểu mẫu 9 và quy định 9*

**Biểu mẫu 9.1**

| BM9.1: Danh Sách Mặt Hàng |  |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| **STT** | **Mặt Hàng** | **Đơn Vị Tính** | **Đơn Giá Nhập** | **Đơn Giá Xuất** | **Tồn Kho** | **Tình Trạng \*** |
| 1 |   |   |   |   |   |   |
| 2 |   |   |   |   |   |   |

**Biểu mẫu 9.2** 

| BM9.2: Danh Sách Đơn Vị Tính |  |  |   |
| ----- | ----- | ----- | :---- |
| **STT** | **Đơn Vị Tính** | **Tình Trạng** |   |
| 1 |   |   |   |
| 2 |   |   |   |

**QĐ9:** Ban đầu có 5 mặt hàng, 3 đơn vị tính. Mỗi mặt hàng có một đơn vị tính và một đơn giá nhập hiện tại. Đơn giá xuất hiện tại được hệ thống tự động tính theo tỷ lệ quy định tại QĐ3 từ đơn giá nhập hiện tại, không nhập tay. Không xóa mặt hàng hoặc đơn vị tính đã phát sinh sử dụng; mặt hàng chỉ chuyển trạng thái sang "Ngừng KD", đơn vị tính chỉ chuyển trạng thái sang "Ngừng sử dụng". Mặt hàng hoặc đơn vị tính đã ngừng sử dụng không được chọn khi lập phiếu nhập, phiếu xuất mới.

### *2.2.9.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image11]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán 

- 

## **2.2.10 Xét yêu cầu Sửa / hủy phiếu nhập, phiếu xuất, phiếu thu**

### *2.2.10.1 Biểu mẫu 10 và quy định 10*

| BM10: Sửa / Hủy Phiếu |  |
| :---- | :---- |
| Loại phiếu:  ☐ Nhập   ☐ Xuất   ☐ Thu | Số phiếu: |
| Thao tác:  ☐ Sửa   ☐ Hủy | Lý do: |
| Nội dung trước khi sửa: | Nội dung sau khi sửa: |

**QĐ10:** Không xóa vật lý phiếu nhập, phiếu xuất, phiếu thu. Hủy phiếu là chuyển trạng thái sang "Đã hủy" và bắt buộc nhập lý do. Khi sửa hoặc hủy phiếu, hệ thống phải tính lại các dữ liệu liên quan gồm tồn kho, đơn giá nhập hiện tại, doanh số và công nợ trong cùng một thao tác. Đối với phiếu nhập, đơn giá nhập hiện tại của mặt hàng được xác định lại theo phiếu nhập còn hiệu lực gần nhất. Không cho phép sửa/hủy nếu làm tồn kho âm, làm dư nợ đại lý vượt hạn mức hoặc làm dư nợ âm. Không được thay đổi đại lý trên phiếu xuất hoặc phiếu thu đã lập. Phiếu thu tự sinh từ phiếu xuất không sửa/hủy riêng mà thay đổi theo phiếu xuất liên kết. Mọi thao tác sửa/hủy phải được tự động ghi nhận vào nhật ký hệ thống (BM14).

### *2.2.10.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image12]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán 

- 

##  **2.2.11 Xét yêu cầu Quản lý tài khoản**

### *2.2.11.1 Biểu mẫu 11 và quy định 11*

| BM11: Tài Khoản Người Dùng |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- |
| **STT** | **Họ Tên** | **Email** | **Nhóm Người Dùng** | **Tình Trạng** |
| 1 |   |   |   |   |
| 2 |   |   |   |   |

**QĐ11:** Tên đăng nhập là email và không được trùng. Mật khẩu phải được băm (hash), không lưu mật khẩu dạng rõ; mật khẩu chỉ được nhập khi tạo mới hoặc đặt lại và không hiển thị lại dưới bất kỳ hình thức nào. Tài khoản bị khóa không đăng nhập được.

 *2.2.11.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image13]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán 

- 

## **2.2.12 Xét yêu cầu Quản lý nhóm người dùng**

### *2.2.12.1 Biểu mẫu 12 và quy định 12*

| BM12: Nhóm Người Dùng |  |  |
| ----- | ----- | ----- |
| **STT** | **Mã Nhóm** | **Tên Nhóm** |
| 1 |   |   |
| 2 |   |   |

**QĐ12:** Ban đầu có 4 nhóm người dùng: Quản lý, Kinh doanh, Kho, Kế toán. Không xóa nhóm đang có người dùng.

*2.2.12.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image14]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán 

- 

## **2.2.13 Xét yêu cầu Phân quyền chức năng**

### *2.2.13.1 Biểu mẫu 13 và quy định 13*

| BM13: Phân Quyền Chức Năng |  |  |  |
| ----- | ----- | :---- | :---: |
| Nhóm người dùng: |  |   |  |
| Người thực hiện: \* |  | Thời gian: \* |  |
| **STT** | **Chức Năng** |  | **Được Phép** |
| 1 |   |  | ☐ |
| 2 |   |  | ☐ |

**QĐ13:** Mỗi nhóm người dùng được cấp quyền truy cập các chức năng tương ứng. Người dùng chỉ thấy và sử dụng được những chức năng thuộc quyền của nhóm mình.

*2.2.13.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image15]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán 

- 

## **2.2.14 Xét yêu cầu Quản lý nhật ký hệ thống**

### *2.2.14.1 Biểu mẫu 14 và quy định 14*

| BM14: Nhật Ký Hệ Thống |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- |
| **Thời Gian** | **Người Dùng** | **Chức Năng** | **Thao Tác** | **Nội Dung** |
|   |   |   |   |   |
|   |   |   |   |   |

**QĐ14:** Ghi nhận người thực hiện, thời gian, chức năng, thao tác và nội dung (trước/sau) đối với các thao tác quan trọng: sửa/hủy phiếu, thay đổi quy định, quản lý tài khoản, nhóm và phân quyền. Nhật ký chỉ được xem, không được sửa hoặc xóa.

### *2.2.14.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image16]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán

-  

## **2.2.15 Xét yêu cầu Thanh toán trực tuyến**

### *2.2.15.1 Biểu mẫu 15 và quy định 15*

| BM15: Giao Dịch Thanh Toán Trực Tuyến |  |
| :---- | :---- |
| Mã giao dịch: | Phiếu thu liên quan (sau khi thành công): |
| Số tiền: | Trạng thái:  ☐ Chờ thanh toán   ☐ Thành công   ☐ Thất bại   ☐ Hết hạn |
| Thời gian thanh toán: | Mã đại lý: \* |

**QĐ15:** Thanh toán trực tuyến áp dụng cho việc thanh toán công nợ và được thực hiện qua môi trường sandbox. Khi khởi tạo thanh toán, hệ thống tạo giao dịch (BM15) ở trạng thái "Chờ thanh toán". Chỉ khi giao dịch được xác nhận "Thành công", hệ thống mới tạo phiếu thu tương ứng (BM5), liên kết giao dịch với phiếu thu và giảm công nợ đại lý. Giao dịch "Thất bại" hoặc "Hết hạn" không tạo phiếu thu và không làm thay đổi công nợ.

### *2.2.15.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image17]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán 

- 

## **2.2.16 Xét yêu cầu Tra cứu qua chatbot**

### *2.2.16.1 Biểu mẫu 16 và quy định 16*

| BM16: Yêu Cầu Tra Cứu Qua Chatbot |  |
| :---- | :---- |
| Người dùng: | Nội dung hỏi: |
| Loại tra cứu:  ☐ Dư nợ đại lý   ☐ Tồn kho   ☐ Doanh số | Kết quả trả lời: |

**QĐ16:** Chatbot chỉ hỗ trợ tra cứu (dư nợ đại lý, tồn kho, doanh số). Kết quả trả về giới hạn theo đúng quyền của người dùng đang đăng nhập. Khi tên đại lý trùng nhiều đại lý, chatbot trả danh sách (Mã – Tên – Quận) để người dùng chọn theo Mã.

 

###  *2.2.16.2 Sơ đồ luồng dữ liệu* 

a. Sơ đồ  
![][image18]  
b. Mô tả các luồng dữ liệu

- 

c. Thuật toán 

- 

 

# **4\. Thiết kế dữ liệu:**

## 4.1 Thuật toán thiết kế dữ liệu:

4.1.1 Bước 1: Xét yêu cầu phần mềm “Tiếp nhận đại lý”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM1  
\- **Sơ đồ luồng dữ liệu:** SĐ1 \- Tiếp nhận đại lý  
\- **Các thuộc tính mới:** AgencyName, AgencyTypeID, Phone, Address, DistrictID, AcceptedDate, Email, CurrentDebt, Status; TypeName; DistrictName.  
\- **Thiết kế dữ liệu:** Tạo ba bảng AGENCY, AGENCYTYPE và DISTRICT. AGENCY lưu hồ sơ đại lý; AGENCYTYPE và DISTRICT tách các giá trị danh mục được dùng lặp lại. CurrentDebt được lưu như thuộc tính tính toán/hiện trạng để tra cứu nhanh và phải tự động cập nhật khi phát sinh xuất hàng, thu tiền hoặc sửa/hủy phiếu.  
\- **Các thuộc tính trừu tượng:** AgencyID, AgencyTypeID, DistrictID.  
\- **Sơ đồ Logic:** AGENCY \-\> AGENCYTYPE; AGENCY \-\> DISTRICT.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ1, QĐ7  
\- **Các thuộc tính mới:** Status của AGENCYTYPE để chỉ cho phép gán loại đang sử dụng.  
\- **Các tham số mới:** MaxAgenciesPerDistrict \= 4\.  
\- **Thiết kế dữ liệu:** Tạo bảng PARAMETER để lưu MaxAgenciesPerDistrict vì đây là giá trị dùng để kiểm tra nhưng không gắn với một đối tượng dữ liệu cụ thể. Việc thay đổi số loại đại lý được thực hiện bằng thêm/ngừng sử dụng record của AGENCYTYPE, không lưu thành tham số.  
\- **Sơ đồ Logic:** Bổ sung PARAMETER; các liên kết AGENCY \- AGENCYTYPE \- DISTRICT giữ nguyên.  
4.1.2 Bước 2: Xét yêu cầu phần mềm “Lập phiếu nhập hàng”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM2  
\- **Sơ đồ luồng dữ liệu:** SĐ2 \- Lập phiếu nhập hàng  
\- **Các thuộc tính mới:** ReceiptDate, Status, ProductName, UnitID, Quantity, UnitPurchasePrice, LineAmount, TotalAmount, CurrentPurchasePrice, CurrentStock.  
\- **Thiết kế dữ liệu:** Tạo UNIT, PRODUCT, STOCKRECEIPT và STOCKRECEIPTDETAIL. STOCKRECEIPT lưu thông tin chung của phiếu; STOCKRECEIPTDETAIL lưu các dòng mặt hàng để loại bỏ nhóm lặp trên biểu mẫu. PRODUCT tham chiếu UNIT. CurrentPurchasePrice, CurrentStock, LineAmount và TotalAmount là các thuộc tính tính toán/hiện trạng nhằm tăng tốc truy xuất và phải được tự động cập nhật khi dữ liệu liên quan thay đổi.  
\- **Các thuộc tính trừu tượng:** UnitID, ProductID, StockReceiptID, StockReceiptDetailID.  
\- **Sơ đồ Logic:** PRODUCT \-\> UNIT; STOCKRECEIPTDETAIL \-\> STOCKRECEIPT; STOCKRECEIPTDETAIL \-\> PRODUCT.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ2, QĐ7  
\- **Các thuộc tính mới:** Status của PRODUCT và UNIT để hỗ trợ ngừng sử dụng mà không xóa dữ liệu đã phát sinh.  
\- **Các tham số mới:** Không phát sinh tham số mới.  
\- **Thiết kế dữ liệu:** Số lượng mặt hàng và đơn vị tính thay đổi bằng cách thêm/ngừng sử dụng record trong PRODUCT và UNIT. Không lưu “số lượng mặt hàng” hoặc “số lượng đơn vị tính” trong PARAMETER vì các giá trị này phụ thuộc trực tiếp số record của đối tượng dữ liệu.  
\- **Sơ đồ Logic:** Giữ nguyên các bảng; dữ liệu danh mục tiến hóa bằng thêm/cập nhật record.  
4.1.3 Bước 3: Xét yêu cầu phần mềm “Lập phiếu xuất hàng”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM3  
\- **Sơ đồ luồng dữ liệu:** SĐ3 \- Lập phiếu xuất hàng  
\- **Các thuộc tính mới:** IssueDate, AgencyID, Quantity, UnitSellingPrice, LineAmount, TotalAmount, AmountPaid, RemainingAmount, MaxDebt, ReceiptDate, Amount, ReceiptType, RelatedIssueID.  
\- Thiết kế dữ liệu: Tạo STOCKISSUE và STOCKISSUEDETAIL. UnitSellingPrice được lưu cố định ở STOCKISSUEDETAIL để phiếu cũ không thay đổi khi giá nhập hoặc tỷ lệ giá xuất thay đổi. Tạo PAYMENTRECEIPT để lưu phiếu thu tự sinh chỉ khi AmountPaid \> 0\. Nếu AmountPaid \= 0 thì không tạo phiếu thu; toàn bộ TotalAmount làm tăng CurrentDebt của đại lý. Phần công nợ còn lại được thu về sau bằng một hoặc nhiều PAYMENTRECEIPT có ReceiptType \= DEBT\_COLLECTION và không bắt buộc liên kết với một STOCKISSUE cụ thể. MaxDebt được bổ sung vào AGENCYTYPE vì hạn mức nợ gắn trực tiếp với từng loại đại lý. TotalAmount, RemainingAmount và LineAmount là các thuộc tính tính toán phải cập nhật đồng bộ.  
\- **Các thuộc tính trừu tượng:** StockIssueID, StockIssueDetailID, PaymentReceiptID.  
\- Sơ đồ Logic: STOCKISSUE \-\> AGENCY; STOCKISSUEDETAIL \-\> STOCKISSUE; STOCKISSUEDETAIL \-\> PRODUCT; PAYMENTRECEIPT \-\> AGENCY. Liên kết PAYMENTRECEIPT \-\> STOCKISSUE là tùy chọn và chỉ dùng cho ReceiptType \= AUTO\_FROM\_ISSUE.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ3, QĐ7  
\- **Các thuộc tính mới:** MaxDebt trong AGENCYTYPE.  
\- **Các tham số mới:** SellingPriceRate \= 1.02.  
\- **Thiết kế dữ liệu:** Lưu SellingPriceRate trong PARAMETER vì tỷ lệ 102% là giá trị quy định dùng trong công thức nhưng không thuộc riêng một đối tượng. Khi thay đổi tỷ lệ, chỉ phiếu xuất mới dùng giá trị mới; UnitSellingPrice của phiếu cũ vẫn giữ nguyên.  
\- **Sơ đồ Logic:** Bổ sung MaxDebt vào AGENCYTYPE và record SellingPriceRate trong PARAMETER.  
4.1.4 Bước 4: Xét yêu cầu phần mềm “Tra cứu đại lý”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM4  
\- **Sơ đồ luồng dữ liệu:** SĐ4 \- Tra cứu đại lý  
\- **Các thuộc tính mới:** Không phát sinh thuộc tính lưu trữ mới; các tiêu chí tra cứu sử dụng AgencyID, AgencyName, AgencyTypeID, DistrictID, Phone, CurrentDebt, Status.  
\- **Thiết kế dữ liệu:** Không tạo bảng mới. Dữ liệu tra cứu lấy từ AGENCY kết hợp AGENCYTYPE và DISTRICT. Giá trị tiền nợ hiển thị sử dụng CurrentDebt của AGENCY.  
\- **Các thuộc tính trừu tượng:** Không phát sinh.  
\- **Sơ đồ Logic:** Không thay đổi sơ đồ logic.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ4  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Các tiêu chí tra cứu là điều kiện truy vấn, không phải dữ liệu nghiệp vụ cần lưu riêng.  
\- **Sơ đồ Logic:** Không thay đổi.  
4.1.5 Bước 5: Xét yêu cầu phần mềm “Lập phiếu thu tiền”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM5  
\- **Sơ đồ luồng dữ liệu:** SĐ5 \- Lập phiếu thu tiền  
\- **Các thuộc tính mới:** PaymentMethod, ReceiptType, RelatedIssueID, Status của PAYMENTRECEIPT.  
\- Thiết kế dữ liệu: Hoàn thiện PAYMENTRECEIPT. Địa chỉ, điện thoại và email trên phiếu thu được lấy từ AGENCY tại thời điểm hiển thị/in, không lặp lại trong PAYMENTRECEIPT. Khi ReceiptType \= AUTO\_FROM\_ISSUE, RelatedIssueID bắt buộc có giá trị và một STOCKISSUE chỉ được tự sinh tối đa một PAYMENTRECEIPT tại thời điểm lập phiếu xuất. Khi ReceiptType \= DEBT\_COLLECTION, RelatedIssueID cho phép NULL; một đại lý có thể lập nhiều phiếu thu công nợ ở các thời điểm khác nhau cho đến khi CurrentDebt về 0\.  
\- **Các thuộc tính trừu tượng:** Không phát sinh thêm ngoài PaymentReceiptID đã có.  
\- Sơ đồ Logic: PAYMENTRECEIPT \-\> AGENCY (N:1). Riêng phiếu thu AUTO\_FROM\_ISSUE có liên kết tùy chọn PAYMENTRECEIPT \-\> STOCKISSUE; mỗi STOCKISSUE có tối đa một phiếu thu tự sinh. Phiếu DEBT\_COLLECTION không bắt buộc liên kết STOCKISSUE.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ5, QĐ15  
\- **Các thuộc tính mới:** PaymentMethod cho phép giá trị ONLINE khi giao dịch trực tuyến thành công.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Luồng trực tuyến chỉ tạo PAYMENTRECEIPT sau khi giao dịch thành công; bảng giao dịch trực tuyến sẽ được bổ sung ở bước 15\.  
\- **Sơ đồ Logic:** Chưa phát sinh bảng mới ở bước này.  
4.1.6 Bước 6: Xét yêu cầu phần mềm “Lập báo cáo tháng”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM6.1, BM6.2  
\- **Sơ đồ luồng dữ liệu:** SĐ6 \- Lập báo cáo tháng  
\- **Các thuộc tính mới:** Các giá trị báo cáo: NumberOfIssues, SalesAmount, SalesRate, OpeningDebt, DebtIncrease, DebtDecrease, ClosingDebt là dữ liệu tổng hợp.  
\- **Thiết kế dữ liệu:** Không tạo bảng báo cáo vật lý. BM6.1 được tổng hợp từ STOCKISSUE, STOCKISSUEDETAIL và AGENCY; BM6.2 được tổng hợp từ STOCKISSUE, PAYMENTRECEIPT và AGENCY. Chỉ dùng phiếu có Status \= ACTIVE. Các giá trị tổng hợp được tính bằng truy vấn/View để tránh dư thừa dữ liệu.  
\- **Các thuộc tính trừu tượng:** Không phát sinh.  
\- **Sơ đồ Logic:** Không thêm bảng; sử dụng các quan hệ giao dịch hiện có.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ6  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Công thức báo cáo được thực hiện ở lớp truy vấn; không tạo bản sao dữ liệu theo tháng.  
\- **Sơ đồ Logic:** Không thay đổi.  
4.1.7 Bước 7: Xét yêu cầu phần mềm “Thay đổi quy định”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** Không có biểu mẫu nghiệp vụ riêng  
\- **Sơ đồ luồng dữ liệu:** SĐ7 \- Thay đổi quy định  
\- **Các thuộc tính mới:** Không phát sinh thuộc tính đối tượng mới ngoài các thuộc tính đã bố trí ở AGENCYTYPE, PRODUCT, UNIT.  
\- **Thiết kế dữ liệu:** Yêu cầu này sử dụng các bảng danh mục đã có và PARAMETER. Các giá trị gắn với đối tượng (ví dụ MaxDebt của loại đại lý) lưu tại bảng đối tượng tương ứng; các giá trị không gắn với đối tượng nhưng dùng để kiểm tra/tính toán lưu tại PARAMETER.  
\- **Các thuộc tính trừu tượng:** ParameterName được dùng làm khóa của PARAMETER theo cấu trúc bảng tham số.  
\- **Sơ đồ Logic:** PARAMETER là bảng độc lập; AGENCYTYPE, PRODUCT và UNIT được cập nhật theo nghiệp vụ.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ7  
\- **Các thuộc tính mới:** Không phát sinh thêm.  
\- **Các tham số mới:** MaxAgenciesPerDistrict, SellingPriceRate.  
\- **Thiết kế dữ liệu:** PARAMETER chỉ cho phép đọc và cập nhật sau khi hoàn tất thiết kế; không dùng thao tác xóa/thêm tùy ý ở phía người dùng cuối. Việc thay đổi số lượng loại đại lý/mặt hàng/đơn vị tính được thực hiện trên các bảng danh mục.  
\- **Sơ đồ Logic:** Giữ nguyên.  
4.1.8 Bước 8: Xét yêu cầu phần mềm “Quản lý loại đại lý”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM8  
\- **Sơ đồ luồng dữ liệu:** SĐ8 \- Quản lý loại đại lý  
\- **Các thuộc tính mới:** TypeName, MaxDebt, Status đã thuộc AGENCYTYPE.  
\- **Thiết kế dữ liệu:** Không tạo bảng mới. AGENCYTYPE là bảng dữ liệu chính của yêu cầu. Khi loại đã được sử dụng thì không xóa vật lý; chuyển Status \= INACTIVE.  
\- **Các thuộc tính trừu tượng:** AgencyTypeID đã được tạo ở bước 1\.  
\- **Sơ đồ Logic:** AGENCY \-\> AGENCYTYPE.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ8  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Loại ngừng sử dụng vẫn được giữ để bảo toàn dữ liệu lịch sử và không được gán cho đại lý mới.  
\- **Sơ đồ Logic:** Không thay đổi.  
4.1.9 Bước 9: Xét yêu cầu phần mềm “Quản lý mặt hàng và đơn vị tính”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM9.1, BM9.2  
\- **Sơ đồ luồng dữ liệu:** SĐ9 \- Quản lý mặt hàng và đơn vị tính  
\- **Các thuộc tính mới:** CurrentSellingPrice và Status của PRODUCT; Status của UNIT.  
\- **Thiết kế dữ liệu:** Không tạo bảng mới. PRODUCT và UNIT đã hình thành ở bước 2\. CurrentSellingPrice là thuộc tính tính toán \= CurrentPurchasePrice x SellingPriceRate, dùng để hiển thị nhanh và phải tự động cập nhật khi giá nhập hiện tại hoặc tỷ lệ thay đổi.  
\- **Các thuộc tính trừu tượng:** ProductID, UnitID đã có.  
\- **Sơ đồ Logic:** PRODUCT \-\> UNIT.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ9  
\- **Các thuộc tính mới:** Status hỗ trợ ngừng kinh doanh/ngừng sử dụng mà vẫn giữ lịch sử giao dịch.  
\- **Các tham số mới:** Sử dụng SellingPriceRate đã có trong PARAMETER.  
\- **Thiết kế dữ liệu:** Không xóa PRODUCT/UNIT đã phát sinh; chỉ đổi trạng thái. Các phiếu mới chỉ chọn record đang hoạt động.  
\- **Sơ đồ Logic:** Không thay đổi.  
4.1.10 Bước 10: Xét yêu cầu phần mềm “Sửa / hủy phiếu nhập, phiếu xuất, phiếu thu”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM10  
\- **Sơ đồ luồng dữ liệu:** SĐ10 \- Sửa / hủy phiếu  
\- **Các thuộc tính mới:** CancelReason cho STOCKRECEIPT, STOCKISSUE, PAYMENTRECEIPT; ActionTime, UserID, FunctionID, ActionType, EntityName, EntityID, OldData, NewData.  
\- **Thiết kế dữ liệu:** Bổ sung CancelReason vào các bảng phiếu. Tạo AUDITLOG để lưu người thực hiện, thời gian, chức năng, thao tác và dữ liệu trước/sau. Không tạo bảng BM10 riêng vì BM10 là giao diện thao tác; dữ liệu cần lưu bền vững nằm ở trạng thái/lý do hủy của phiếu và AUDITLOG.  
\- **Các thuộc tính trừu tượng:** AuditLogID.  
\- **Sơ đồ Logic:** AUDITLOG sẽ liên kết USERACCOUNT và FUNCTION sau khi hai bảng này được hình thành; hiện tại lưu khóa tham chiếu dự kiến.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ10  
\- **Các thuộc tính mới:** Các thuộc tính hiện trạng CurrentStock, CurrentPurchasePrice, CurrentDebt và các tổng tiền phải được tính lại trong cùng transaction khi sửa/hủy.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Phiếu không bị xóa vật lý; Status chuyển CANCELLED. Phiếu thu tự sinh không sửa/hủy độc lập mà thay đổi theo phiếu xuất liên kết.  
\- **Sơ đồ Logic:** Bổ sung AUDITLOG và CancelReason.  
4.1.11 Bước 11: Xét yêu cầu phần mềm “Quản lý tài khoản”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM11  
\- **Sơ đồ luồng dữ liệu:** SĐ11 \- Quản lý tài khoản  
\- **Các thuộc tính mới:** FullName, Email, PasswordHash, UserGroupID, Status.  
\- **Thiết kế dữ liệu:** Tạo USERACCOUNT và USERGROUP. USERACCOUNT tham chiếu USERGROUP; Email là tên đăng nhập và không trùng. Chỉ lưu PasswordHash, không lưu mật khẩu rõ.  
\- **Các thuộc tính trừu tượng:** UserID, UserGroupID.  
\- **Sơ đồ Logic:** USERACCOUNT \-\> USERGROUP.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ11  
\- **Các thuộc tính mới:** Status cho phép khóa tài khoản.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Tài khoản bị khóa vẫn được giữ để bảo toàn nhật ký; không cần xóa dữ liệu liên quan.  
\- **Sơ đồ Logic:** AUDITLOG có thể tham chiếu UserID.  
4.1.12 Bước 12: Xét yêu cầu phần mềm “Quản lý nhóm người dùng”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM12  
\- **Sơ đồ luồng dữ liệu:** SĐ12 \- Quản lý nhóm người dùng  
\- **Các thuộc tính mới:** GroupName đã thuộc USERGROUP.  
\- **Thiết kế dữ liệu:** Không tạo bảng mới. USERGROUP được dùng làm danh mục nhóm; ban đầu có Quản lý, Kinh doanh, Kho, Kế toán.  
\- **Các thuộc tính trừu tượng:** UserGroupID đã có.  
\- **Sơ đồ Logic:** USERACCOUNT \-\> USERGROUP.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ12  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Không xóa USERGROUP đang được USERACCOUNT tham chiếu.  
\- **Sơ đồ Logic:** Không thay đổi.  
4.1.13 Bước 13: Xét yêu cầu phần mềm “Phân quyền chức năng”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM13  
\- **Sơ đồ luồng dữ liệu:** SĐ13 \- Phân quyền chức năng  
\- **Các thuộc tính mới:** FunctionName, UserGroupID, FunctionID, IsAllowed.  
\- **Thiết kế dữ liệu:** Tạo FUNCTION và PERMISSION. Quan hệ USERGROUP \- FUNCTION là n-n nên tách bằng PERMISSION. Theo hướng dẫn về khóa, dùng PermissionID là thuộc tính trừu tượng làm khóa chính; đồng thời đặt UNIQUE(UserGroupID, FunctionID) để ngăn trùng cặp phân quyền. Người thực hiện và thời gian thay đổi quyền được ghi trong AUDITLOG, không lặp vào PERMISSION.  
\- **Các thuộc tính trừu tượng:** FunctionID, PermissionID.  
\- **Sơ đồ Logic:** PERMISSION \-\> USERGROUP; PERMISSION \-\> FUNCTION.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ13  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Thêm/bỏ quyền bằng cập nhật IsAllowed; mọi thay đổi quyền được ghi nhật ký.  
\- **Sơ đồ Logic:** Bổ sung FUNCTION và PERMISSION.  
4.1.14 Bước 14: Xét yêu cầu phần mềm “Quản lý nhật ký hệ thống”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM14  
\- **Sơ đồ luồng dữ liệu:** SĐ14 \- Quản lý nhật ký hệ thống  
\- **Các thuộc tính mới:** Các thuộc tính của AUDITLOG đã được xác định tại bước 10\.  
\- **Thiết kế dữ liệu:** Hoàn thiện liên kết AUDITLOG \-\> USERACCOUNT và AUDITLOG \-\> FUNCTION. Nhật ký lưu nội dung trước/sau cho các thao tác quan trọng; người dùng chỉ được xem, không được sửa hoặc xóa.  
\- **Các thuộc tính trừu tượng:** AuditLogID đã có.  
\- **Sơ đồ Logic:** AUDITLOG \-\> USERACCOUNT; AUDITLOG \-\> FUNCTION.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ14  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** AUDITLOG là dữ liệu lịch sử bất biến đối với người dùng cuối.  
\- **Sơ đồ Logic:** Hoàn thiện hai khóa ngoại của AUDITLOG.  
4.1.15 Bước 15: Xét yêu cầu phần mềm “Thanh toán trực tuyến”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM15  
\- **Sơ đồ luồng dữ liệu:** SĐ15 \- Thanh toán trực tuyến  
\- **Các thuộc tính mới:** TransactionID, AgencyID, Amount, Status, PaymentTime, PaymentReceiptID.  
\- Thiết kế dữ liệu: Tạo ONLINEPAYMENT. Giao dịch được tạo ở trạng thái PENDING. Khi SUCCESS, hệ thống tạo đúng một PAYMENTRECEIPT tương ứng, liên kết PaymentReceiptID và giảm CurrentDebt; FAILED/EXPIRED không tạo phiếu thu. PaymentReceiptID cho phép NULL trước khi thành công và phải UNIQUE khi có giá trị để một phiếu thu không bị liên kết với nhiều giao dịch trực tuyến.  
\- **Các thuộc tính trừu tượng:** TransactionID là mã giao dịch duy nhất do hệ thống/cổng sandbox sinh.  
\- Sơ đồ Logic: ONLINEPAYMENT \-\> AGENCY; ONLINEPAYMENT \-\> PAYMENTRECEIPT (0..1), trong đó PaymentReceiptID là UNIQUE khi có giá trị.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ15  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Các trạng thái giao dịch được lưu để bảo toàn lịch sử thanh toán; phiếu thu chỉ tồn tại sau thành công.  
\- **Sơ đồ Logic:** Bổ sung ONLINEPAYMENT.  
4.1.16 Bước 16: Xét yêu cầu phần mềm “Tra cứu qua chatbot”

a. Thiết kế dữ liệu với tính đúng đắn

\- **Biểu mẫu liên quan:** BM16  
\- **Sơ đồ luồng dữ liệu:** SĐ16 \- Tra cứu qua chatbot  
\- **Các thuộc tính mới:** Không phát sinh thuộc tính lưu trữ bắt buộc; QuestionText, QueryType và Response chỉ là dữ liệu phiên tra cứu theo yêu cầu hiện tại.  
\- **Thiết kế dữ liệu:** Không tạo bảng CHATBOTLOG vì yêu cầu chỉ quy định tra cứu, không yêu cầu lưu lịch sử hội thoại. Chatbot đọc dữ liệu từ AGENCY, PRODUCT, STOCKISSUE, PAYMENTRECEIPT và kiểm tra quyền qua USERACCOUNT \- USERGROUP \- PERMISSION \- FUNCTION.  
\- **Các thuộc tính trừu tượng:** Không phát sinh.  
\- **Sơ đồ Logic:** Không thêm bảng; sử dụng sơ đồ logic hiện có.  
b. Thiết kế dữ liệu với tính tiến hóa

\- **Quy định liên quan:** QĐ16  
\- **Các thuộc tính mới:** Không phát sinh.  
\- **Các tham số mới:** Không phát sinh.  
\- **Thiết kế dữ liệu:** Khi tên đại lý trùng, truy vấn trả AgencyID, AgencyName và District để người dùng chọn đúng đại lý; quyền truy xuất được kiểm tra trước khi trả kết quả.  
\- **Sơ đồ Logic:** Không thay đổi.  
4.1.17 Kiểm tra chuẩn hóa dữ liệu đến 2NF

\- **Dạng chuẩn 1NF:** Tất cả thuộc tính trong các bảng đều có giá trị nguyên tố; các nhóm lặp của phiếu nhập và phiếu xuất được tách thành bảng chi tiết.  
\- Dạng chuẩn 2NF: Các bảng đều sử dụng khóa chính đơn là thuộc tính trừu tượng, vì vậy không tồn tại thuộc tính không khóa phụ thuộc vào một phần của khóa chính. STOCKRECEIPTDETAIL và STOCKISSUEDETAIL dùng khóa chính lần lượt là StockReceiptDetailID và StockIssueDetailID; không đặt UNIQUE(StockReceiptID, ProductID) hay UNIQUE(StockIssueID, ProductID) vì Danh sách yêu cầu không quy định một mặt hàng chỉ được xuất hiện một lần trên cùng một phiếu. Riêng PERMISSION vẫn đặt UNIQUE(UserGroupID, FunctionID) để tránh lặp cùng một chức năng trong cùng một nhóm người dùng.  
\- **Giảm dư thừa:** Các danh mục lặp lại được tách thành AGENCYTYPE, DISTRICT, UNIT, USERGROUP và FUNCTION; bảng giao dịch chỉ lưu mã tham chiếu.  
\- **Thuộc tính tính toán:** CurrentDebt, CurrentStock, CurrentPurchasePrice, CurrentSellingPrice, LineAmount, TotalAmount và RemainingAmount được lưu để tăng hiệu quả truy xuất theo hướng dẫn chương 6 và phải tự động cập nhật khi dữ liệu nguồn thay đổi.  
 

## 4.2 Sơ đồ logic hoàn chỉnh.

![][image19]  
*Ghi chú: thuộc tính được gạch dưới là khóa chính; (FK) là khóa ngoại. PARAMETER là bảng độc lập dùng cho các giá trị quy định không gắn trực tiếp với một đối tượng dữ liệu. Liên kết PAYMENTRECEIPT \- STOCKISSUE chỉ áp dụng cho ReceiptType \= AUTO\_FROM\_ISSUE: một STOCKISSUE có tối đa một phiếu thu tự sinh. Các phiếu ReceiptType \= DEBT\_COLLECTION liên kết với AGENCY và RelatedIssueID có thể NULL, vì đại lý được phép trả công nợ nhiều lần. Liên kết ONLINEPAYMENT \- PAYMENTRECEIPT là 0..1 và PaymentReceiptID là UNIQUE khi có giá trị.*  
 

## 4.3 Danh sách các bảng dữ liệu (table) trong sơ đồ:

| STT | Tên bảng dữ liệu | Diễn giải |
| :---: | ----- | ----- |
| 1 | DISTRICT | Lưu danh mục quận. |
| 2 | AGENCYTYPE | Lưu loại đại lý, hạn mức nợ và trạng thái sử dụng. |
| 3 | AGENCY | Lưu hồ sơ đại lý, dư nợ hiện tại và tình trạng hợp tác. |
| 4 | UNIT | Lưu danh mục đơn vị tính. |
| 5 | PRODUCT | Lưu mặt hàng, giá hiện tại, tồn kho và trạng thái kinh doanh. |
| 6 | STOCKRECEIPT | Lưu thông tin chung của phiếu nhập hàng. |
| 7 | STOCKRECEIPTDETAIL | Lưu các dòng mặt hàng của phiếu nhập. |
| 8 | STOCKISSUE | Lưu thông tin chung của phiếu xuất hàng cho đại lý. |
| 9 | STOCKISSUEDETAIL | Lưu các dòng mặt hàng của phiếu xuất và đơn giá xuất lịch sử. |
| 10 | PAYMENTRECEIPT | Lưu phiếu thu tự sinh từ phiếu xuất hoặc phiếu thu công nợ. |
| 11 | PARAMETER | Lưu các tham số quy định không gắn với đối tượng dữ liệu cụ thể. |
| 12 | USERGROUP | Lưu nhóm người dùng. |
| 13 | USERACCOUNT | Lưu tài khoản đăng nhập và trạng thái tài khoản. |
| 14 | FUNCTION | Lưu danh mục chức năng dùng cho phân quyền. |
| 15 | PERMISSION | Lưu quyền của từng nhóm đối với từng chức năng. |
| 16 | AUDITLOG | Lưu nhật ký thao tác quan trọng và nội dung trước/sau. |
| 17 | ONLINEPAYMENT | Lưu giao dịch thanh toán trực tuyến qua sandbox. |

 

## 4.4 Mô tả từng bảng dữ liệu:

4.4.1 Bảng DISTRICT:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | DistrictID | INT | PK, IDENTITY, NOT NULL | Mã quận \- thuộc tính trừu tượng. |
| 2 | DistrictName | NVARCHAR(100) | UNIQUE, NOT NULL | Tên quận. |

   
4.4.2 Bảng AGENCYTYPE:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | AgencyTypeID | INT | PK, IDENTITY, NOT NULL | Mã loại đại lý \- thuộc tính trừu tượng. |
| 2 | TypeName | NVARCHAR(100) | UNIQUE, NOT NULL | Tên loại đại lý. |
| 3 | MaxDebt | DECIMAL(18,2) | NOT NULL, \>= 0 | Tiền nợ tối đa của loại đại lý. |
| 4 | Status | VARCHAR(20) | NOT NULL | ACTIVE / INACTIVE. |

   
4.4.3 Bảng AGENCY:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | AgencyID | VARCHAR(20) | PK, NOT NULL | Mã đại lý do hệ thống tự sinh, không thay đổi và không tái sử dụng. |
| 2 | AgencyName | NVARCHAR(150) | NOT NULL | Tên đại lý; không bắt buộc duy nhất. |
| 3 | AgencyTypeID | INT | FK \-\> AGENCYTYPE, NOT NULL | Loại đại lý hiện tại. |
| 4 | Phone | VARCHAR(20) | NULL | Điện thoại liên hệ. |
| 5 | Address | NVARCHAR(255) | NULL | Địa chỉ đại lý. |
| 6 | DistrictID | INT | FK \-\> DISTRICT, NOT NULL | Quận của đại lý. |
| 7 | AcceptedDate | DATE | NOT NULL | Ngày tiếp nhận. |
| 8 | Email | VARCHAR(255) | NOT NULL | Email liên hệ. |
| 9 | CurrentDebt | DECIMAL(18,2) | NOT NULL, DEFAULT 0, \>= 0 | Dư nợ hiện tại \- thuộc tính tính toán/hiện trạng, tự động cập nhật. |
| 10 | Status | VARCHAR(20) | NOT NULL | ACTIVE / TERMINATED. |

   
4.4.4 Bảng UNIT:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | UnitID | INT | PK, IDENTITY, NOT NULL | Mã đơn vị tính \- thuộc tính trừu tượng. |
| 2 | UnitName | NVARCHAR(100) | UNIQUE, NOT NULL | Tên đơn vị tính. |
| 3 | Status | VARCHAR(20) | NOT NULL | ACTIVE / INACTIVE. |

   
4.4.5 Bảng PRODUCT:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | ProductID | VARCHAR(20) | PK, NOT NULL | Mã mặt hàng do hệ thống tự sinh. |
| 2 | ProductName | NVARCHAR(150) | NOT NULL | Tên mặt hàng. |
| 3 | UnitID | INT | FK \-\> UNIT, NOT NULL | Đơn vị tính của mặt hàng. |
| 4 | CurrentPurchasePrice | DECIMAL(18,2) | NOT NULL, DEFAULT 0, \>= 0 | Đơn giá nhập hiện tại; lấy từ phiếu nhập hiệu lực gần nhất. |
| 5 | CurrentSellingPrice | DECIMAL(18,2) | NOT NULL, DEFAULT 0, \>= 0 | Thuộc tính tính toán \= CurrentPurchasePrice x SellingPriceRate. |
| 6 | CurrentStock | DECIMAL(18,2) | NOT NULL, DEFAULT 0, \>= 0 | Tồn kho hiện tại \- thuộc tính tính toán/hiện trạng. |
| 7 | Status | VARCHAR(20) | NOT NULL | ACTIVE / INACTIVE. |

   
4.4.6 Bảng STOCKRECEIPT:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | StockReceiptID | VARCHAR(20) | PK, NOT NULL | Số phiếu nhập do hệ thống tự sinh. |
| 2 | ReceiptDate | DATE | NOT NULL | Ngày lập phiếu nhập. |
| 3 | TotalAmount | DECIMAL(18,2) | NOT NULL, DEFAULT 0, \>= 0 | Tổng tiền \- thuộc tính tính toán từ các dòng chi tiết. |
| 4 | Status | VARCHAR(20) | NOT NULL | ACTIVE / CANCELLED. |
| 5 | CancelReason | NVARCHAR(500) | NULL; bắt buộc khi CANCELLED | Lý do hủy phiếu. |

   
4.4.7 Bảng STOCKRECEIPTDETAIL:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | StockReceiptDetailID | BIGINT | PK, IDENTITY, NOT NULL | Mã dòng chi tiết \- thuộc tính trừu tượng. |
| 2 | StockReceiptID | VARCHAR(20) | FK \-\> STOCKRECEIPT, NOT NULL | Phiếu nhập chứa dòng chi tiết. |
| 3 | ProductID | VARCHAR(20) | FK \-\> PRODUCT, NOT NULL | Mặt hàng nhập. |
| 4 | Quantity | DECIMAL(18,2) | NOT NULL, \> 0 | Số lượng nhập. |
| 5 | UnitPurchasePrice | DECIMAL(18,2) | NOT NULL, \>= 0 | Đơn giá nhập của dòng. |
| 6 | LineAmount | DECIMAL(18,2) | NOT NULL, \>= 0 | Thuộc tính tính toán \= Quantity x UnitPurchasePrice. |

   
4.4.8 Bảng STOCKISSUE:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | StockIssueID | VARCHAR(20) | PK, NOT NULL | Số phiếu xuất do hệ thống tự sinh. |
| 2 | IssueDate | DATE | NOT NULL | Ngày lập phiếu xuất. |
| 3 | AgencyID | VARCHAR(20) | FK \-\> AGENCY, NOT NULL | Đại lý nhận hàng. |
| 4 | TotalAmount | DECIMAL(18,2) | NOT NULL, DEFAULT 0, \>= 0 | Tổng trị giá phiếu \- thuộc tính tính toán. |
| 5 | AmountPaid | DECIMAL(18,2) | NOT NULL, DEFAULT 0, 0 \<= AmountPaid \<= TotalAmount | Số tiền trả ngay. |
| 6 | RemainingAmount | DECIMAL(18,2) | NOT NULL, DEFAULT 0, \>= 0 | Thuộc tính tính toán \= TotalAmount \- AmountPaid. |
| 7 | Status | VARCHAR(20) | NOT NULL | ACTIVE / CANCELLED. |
| 8 | CancelReason | NVARCHAR(500) | NULL; bắt buộc khi CANCELLED | Lý do hủy phiếu. |

   
4.4.9 Bảng STOCKISSUEDETAIL:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | StockIssueDetailID | BIGINT | PK, IDENTITY, NOT NULL | Mã dòng chi tiết \- thuộc tính trừu tượng. |
| 2 | StockIssueID | VARCHAR(20) | FK \-\> STOCKISSUE, NOT NULL | Phiếu xuất chứa dòng chi tiết. |
| 3 | ProductID | VARCHAR(20) | FK \-\> PRODUCT, NOT NULL | Mặt hàng xuất. |
| 4 | Quantity | DECIMAL(18,2) | NOT NULL, \> 0 | Số lượng xuất; không vượt tồn kho. |
| 5 | UnitSellingPrice | DECIMAL(18,2) | NOT NULL, \>= 0 | Đơn giá xuất tại thời điểm lập; lưu cố định trên phiếu. |
| 6 | LineAmount | DECIMAL(18,2) | NOT NULL, \>= 0 | Thuộc tính tính toán \= Quantity x UnitSellingPrice. |

   
4.4.10 Bảng PAYMENTRECEIPT:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | PaymentReceiptID | VARCHAR(20) | PK, NOT NULL | Số phiếu thu do hệ thống tự sinh. |
| 2 | ReceiptDate | DATE | NOT NULL | Ngày thu tiền. |
| 3 | AgencyID | VARCHAR(20) | FK \-\> AGENCY, NOT NULL | Đại lý thanh toán. |
| 4 | Amount | DECIMAL(18,2) | NOT NULL, \> 0 | Số tiền thu; không vượt dư nợ theo quy định. |
| 5 | PaymentMethod | VARCHAR(30) | NOT NULL | CASH / BANK\_TRANSFER / ONLINE. |
| 6 | ReceiptType | VARCHAR(30) | NOT NULL | AUTO\_FROM\_ISSUE / DEBT\_COLLECTION. |
| 7 | RelatedIssueID | VARCHAR(20) | FK \-\> STOCKISSUE, NULL; AUTO\_FROM\_ISSUE: bắt buộc | Phiếu xuất liên quan. Với AUTO\_FROM\_ISSUE: bắt buộc có giá trị và mỗi phiếu xuất chỉ tự sinh tối đa một phiếu thu. Với DEBT\_COLLECTION: có thể NULL; đại lý được lập nhiều phiếu thu công nợ. |
| 8 | Status | VARCHAR(20) | NOT NULL | ACTIVE / CANCELLED. |
| 9 | CancelReason | NVARCHAR(500) | NULL; bắt buộc khi CANCELLED | Lý do hủy phiếu thu. |

   
4.4.11 Bảng PARAMETER:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | ParameterName | VARCHAR(100) | PK, NOT NULL | Tên tham số theo quy ước đặt tên thuộc tính. |
| 2 | Value | DECIMAL(18,4) | NOT NULL | Giá trị tham số. Dữ liệu ban đầu gồm MaxAgenciesPerDistrict \= 4 và SellingPriceRate \= 1.02. |

   
4.4.12 Bảng USERGROUP:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | UserGroupID | VARCHAR(20) | PK, NOT NULL | Mã nhóm người dùng \- thuộc tính trừu tượng. |
| 2 | GroupName | NVARCHAR(100) | UNIQUE, NOT NULL | Tên nhóm người dùng. |

   
4.4.13 Bảng USERACCOUNT:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | UserID | VARCHAR(20) | PK, NOT NULL | Mã người dùng \- thuộc tính trừu tượng. |
| 2 | FullName | NVARCHAR(150) | NOT NULL | Họ tên người dùng. |
| 3 | Email | VARCHAR(255) | UNIQUE, NOT NULL | Tên đăng nhập. |
| 4 | PasswordHash | VARCHAR(255) | NOT NULL | Mật khẩu đã băm; không lưu mật khẩu rõ. |
| 5 | UserGroupID | VARCHAR(20) | FK \-\> USERGROUP, NOT NULL | Nhóm người dùng. |
| 6 | Status | VARCHAR(20) | NOT NULL | ACTIVE / LOCKED. |

   
4.4.14 Bảng FUNCTION:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | FunctionID | VARCHAR(20) | PK, NOT NULL | Mã chức năng \- thuộc tính trừu tượng. |
| 2 | FunctionName | NVARCHAR(150) | UNIQUE, NOT NULL | Tên chức năng hệ thống. |

   
4.4.15 Bảng PERMISSION:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | PermissionID | BIGINT | PK, IDENTITY, NOT NULL | Mã phân quyền \- thuộc tính trừu tượng. |
| 2 | UserGroupID | VARCHAR(20) | FK \-\> USERGROUP, NOT NULL | Nhóm người dùng. |
| 3 | FunctionID | VARCHAR(20) | FK \-\> FUNCTION, NOT NULL | Chức năng được phân quyền. |
| 4 | IsAllowed | BIT | NOT NULL | 1: được phép; 0: không được phép. |
| 5 | (UserGroupID, FunctionID) | \- | UNIQUE | Không lặp một chức năng trong cùng một nhóm. |

   
4.4.16 Bảng AUDITLOG:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | AuditLogID | BIGINT | PK, IDENTITY, NOT NULL | Mã nhật ký \- thuộc tính trừu tượng. |
| 2 | UserID | VARCHAR(20) | FK \-\> USERACCOUNT, NOT NULL | Người thực hiện. |
| 3 | FunctionID | VARCHAR(20) | FK \-\> FUNCTION, NOT NULL | Chức năng phát sinh thao tác. |
| 4 | ActionTime | DATETIME2 | NOT NULL | Thời gian thao tác. |
| 5 | ActionType | VARCHAR(50) | NOT NULL | Loại thao tác: UPDATE, CANCEL, RULE\_CHANGE, PERMISSION\_CHANGE... |
| 6 | EntityName | VARCHAR(100) | NULL | Tên loại đối tượng bị tác động. |
| 7 | EntityID | VARCHAR(50) | NULL | Mã bản ghi bị tác động. |
| 8 | OldData | NVARCHAR(MAX) | NULL | Nội dung trước khi thay đổi. |
| 9 | NewData | NVARCHAR(MAX) | NULL | Nội dung sau khi thay đổi. |

   
4.4.17 Bảng ONLINEPAYMENT:

| STT | Thuộc tính | Kiểu dữ liệu | Ràng buộc | Diễn giải |
| :---: | ----- | ----- | ----- | ----- |
| 1 | TransactionID | VARCHAR(50) | PK, NOT NULL | Mã giao dịch duy nhất do hệ thống/cổng sandbox sinh. |
| 2 | AgencyID | VARCHAR(20) | FK \-\> AGENCY, NOT NULL | Đại lý thanh toán công nợ. |
| 3 | Amount | DECIMAL(18,2) | NOT NULL, \> 0 | Số tiền thanh toán. |
| 4 | Status | VARCHAR(20) | NOT NULL | PENDING / SUCCESS / FAILED / EXPIRED. |
| 5 | PaymentTime | DATETIME2 | NULL | Thời điểm hoàn tất giao dịch nếu có. |
| 6 | PaymentReceiptID | VARCHAR(20) | FK, UNIQUE, NULL | Có khi SUCCESS; mỗi phiếu thu chỉ thuộc một giao dịch. |

 

# **Tài liệu tổng quan và đặc tả nghiệp vụ website Quản lý các đại lý**

Tài liệu này được xây dựng dựa trên đúng nội dung đề tài **Quản lý các đại lý** trong tài liệu của giảng viên. Những điểm giảng viên chưa quy định được tách riêng thành **đề xuất của nhóm**, tránh xem các giả định là yêu cầu chính thức.

## **Quy ước**

* **Yêu cầu gốc:** Có trong tài liệu giảng viên.  
* **Đề xuất:** Nhóm cần bổ sung để website vận hành logic.  
* **Cần xác nhận:** Tài liệu giảng viên chưa làm rõ, nhóm nên hỏi lại trước khi chốt SRS và thiết kế cơ sở dữ liệu.

---

# **1\. Tổng quan đề tài**

## **1.1. Tên hệ thống**

**Website quản lý các đại lý và hoạt động phân phối hàng hóa**

## **1.2. Bài toán hệ thống giải quyết**

Doanh nghiệp có một kho hàng và phân phối hàng hóa cho nhiều đại lý. Website hỗ trợ doanh nghiệp:

* Tiếp nhận và quản lý hồ sơ đại lý.  
* Phân loại đại lý.  
* Quản lý hạn mức nợ của từng loại đại lý.  
* Quản lý danh mục mặt hàng và đơn vị tính.  
* Ghi nhận hàng nhập vào kho.  
* Xuất hàng cho đại lý.  
* Kiểm tra tồn kho trước khi xuất.  
* Tự động tính đơn giá xuất.  
* Ghi nhận số tiền đại lý trả ngay.  
* Theo dõi phần tiền đại lý còn nợ.  
* Thu công nợ vào những lần sau.  
* Tra cứu đại lý và giao dịch.  
* Báo cáo doanh số.  
* Báo cáo công nợ.  
* Thay đổi các quy định nghiệp vụ.

## **1.3. Bản chất của hệ thống**

Đây là một hệ thống quản lý nội bộ của doanh nghiệp, không phải website thương mại điện tử.

flowchart LR

    A\["Hàng nhập vào"\] \--\> B\["Kho doanh nghiệp"\]

    B \--\> C\["Xuất hàng"\]

    C \--\> D\["Đại lý"\]

    D \--\> E\["Trả tiền"\]

    E \--\> F\["Doanh nghiệp"\]

Website tập trung vào ba trục chính:

1. Quản lý đại lý.  
2. Quản lý nhập, xuất và tồn kho.  
3. Quản lý tiền thu, doanh số và công nợ.

## **1.4. Phạm vi không thực hiện**

Nhóm đã quyết định không mở rộng quản lý nhà cung cấp. Vì vậy hệ thống không cần:

* Hồ sơ nhà cung cấp.  
* Đơn đặt mua hàng.  
* Công nợ nhà cung cấp.  
* Phiếu chi.  
* Thanh toán cho nhà cung cấp.  
* Cổng đăng nhập dành cho nhà cung cấp.

Để tránh phạm vi quá lớn, phiên bản chính cũng chưa cần:

* Đại lý tự đăng nhập.  
* Đại lý tự đặt hàng.  
* Quản lý giao hàng và vận chuyển.  
* Quản lý nhiều kho.  
* Quản lý nhiều chi nhánh.  
* Quản lý nhân sự, lương và chấm công.  
* Quản lý thuế và hóa đơn điện tử.  
* AI dự báo doanh số.  
* Tích hợp cổng thanh toán.

---

# **2\. Các yêu cầu gốc từ giảng viên**

Tài liệu giảng viên đưa ra 7 nhóm yêu cầu:

| STT | Yêu cầu | Biểu mẫu | Quy định |
| ----- | ----- | ----- | ----- |
| 1 | Tiếp nhận đại lý | BM1 | QĐ1 |
| 2 | Lập phiếu nhập hàng | BM2 | QĐ2 |
| 3 | Lập phiếu xuất hàng | BM3 | QĐ3 |
| 4 | Tra cứu đại lý | BM4 | Không nêu |
| 5 | Lập phiếu thu tiền | BM5 | QĐ5 |
| 6 | Lập báo cáo tháng | BM6.1, BM6.2 | Không nêu |
| 7 | Thay đổi quy định | Không có | QĐ7 |

## **2.1. Quy định gốc**

### **QĐ1 — Đại lý**

* Có 2 loại đại lý: loại 1 và loại 2\.  
* Có 20 quận.  
* Trong mỗi quận có tối đa 4 đại lý.

### **QĐ2 — Hàng hóa**

* Có 5 mặt hàng.  
* Có 3 đơn vị tính.

### **QĐ3 — Xuất hàng và công nợ**

* Đại lý loại 1 có tiền nợ tối đa 10.000.000 đồng.  
* Đại lý loại 2 có tiền nợ tối đa 5.000.000 đồng.  
* Đơn giá xuất bằng 102% đơn giá nhập.

### **QĐ5 — Thu tiền**

* Số tiền thu không vượt quá số tiền đại lý đang nợ.

### **QĐ7 — Thay đổi quy định**

Người dùng có thể thay đổi:

* Số lượng các loại đại lý.  
* Số đại lý tối đa trong một quận.  
* Số lượng mặt hàng.  
* Số lượng đơn vị tính.  
* Tiền nợ tối đa của từng loại đại lý.  
* Tỷ lệ tính đơn giá xuất.

---

# **3\. Mô hình nghiệp vụ tổng thể**

flowchart TD

    A\["Thiết lập danh mục và quy định"\] \--\> B\["Tiếp nhận đại lý"\]

    A \--\> C\["Nhập hàng vào kho"\]

    B \--\> D\["Lập phiếu xuất hàng"\]

    C \--\> D

    D \--\> E{"Kiểm tra điều kiện"}

    E \--\>|Không hợp lệ| F\["Từ chối và thông báo lỗi"\]

    E \--\>|Hợp lệ| G\["Xác nhận xuất kho"\]

    G \--\> H\["Giảm tồn kho"\]

    G \--\> I\["Ghi nhận doanh số"\]

    G \--\> J\["Ghi nhận tiền trả và công nợ"\]

    J \--\> K\["Thu công nợ các lần sau"\]

    H \--\> L\["Báo cáo"\]

    I \--\> L

    K \--\> L

Hệ thống được chia thành 7 luồng nghiệp vụ:

1. Thiết lập danh mục và quy định.  
2. Tiếp nhận đại lý.  
3. Nhập hàng vào kho.  
4. Xuất hàng cho đại lý.  
5. Thu tiền và quản lý công nợ.  
6. Tra cứu.  
7. Báo cáo.

---

# **4\. Các role trong website**

Tài liệu giảng viên không quy định số lượng role. Phương án phù hợp nhất cho nhóm là **4 role nội bộ**:

1. Quản lý hệ thống.  
2. Nhân viên kinh doanh.  
3. Nhân viên kho.  
4. Kế toán.

Đại lý không phải role vì đại lý không đăng nhập website trong phạm vi hiện tại.

## **4.1. Quản lý hệ thống**

Đây là role có quyền cao nhất, gộp vai trò quản trị viên và quản lý doanh nghiệp.

### **Quyền hạn**

* Quản lý tài khoản.  
* Phân quyền người dùng.  
* Khóa và mở khóa tài khoản.  
* Quản lý loại đại lý.  
* Quản lý quận.  
* Quản lý mặt hàng.  
* Quản lý đơn vị tính.  
* Thay đổi hạn mức nợ.  
* Thay đổi tỷ lệ giá xuất.  
* Thay đổi số đại lý tối đa trong quận.  
* Xem toàn bộ phiếu nhập.  
* Xem toàn bộ phiếu xuất.  
* Xem toàn bộ phiếu thu.  
* Xem doanh số và công nợ.  
* Xem báo cáo.  
* Duyệt hoặc hủy chứng từ.  
* Xem nhật ký hoạt động.

## **4.2. Nhân viên kinh doanh**

Phụ trách đại lý và hoạt động bán hàng.

### **Quyền hạn**

* Tiếp nhận đại lý.  
* Cập nhật hồ sơ đại lý.  
* Tra cứu đại lý.  
* Xem loại và hạn mức nợ.  
* Xem dư nợ hiện tại.  
* Xem hạn mức còn lại.  
* Lập phiếu xuất.  
* Thêm mặt hàng vào phiếu xuất.  
* Nhập số tiền đại lý trả ngay.  
* Xem trạng thái xuất kho.  
* Xem lịch sử mua hàng của đại lý.  
* In phiếu xuất.

### **Không được thực hiện**

* Không tự điều chỉnh tồn kho.  
* Không xác nhận tiền đã thu.  
* Không thay đổi quy định.  
* Không tự hủy chứng từ đã xác nhận.

## **4.3. Nhân viên kho**

Phụ trách nhập, xuất và tồn kho.

### **Quyền hạn**

* Lập phiếu nhập.  
* Xác nhận nhập kho.  
* Xem tồn kho.  
* Kiểm tra phiếu xuất.  
* Xác nhận xuất kho.  
* Xem lịch sử nhập – xuất.  
* Kiểm kê kho.  
* Lập yêu cầu điều chỉnh tồn kho.  
* Xem cảnh báo hàng sắp hết.  
* In phiếu nhập và phiếu xuất kho.

### **Không được thực hiện**

* Không thay đổi hạn mức nợ.  
* Không xác nhận đại lý đã trả tiền.  
* Không lập phiếu thu.  
* Không thay đổi quy định hệ thống.

## **4.4. Kế toán**

Phụ trách tiền thu và công nợ đại lý.

### **Quyền hạn**

* Xem dư nợ đại lý.  
* Xem các phiếu xuất chưa thanh toán.  
* Lập phiếu thu.  
* Xác nhận phiếu thu.  
* Theo dõi thanh toán từng phiếu xuất.  
* Đối chiếu công nợ.  
* Xem lịch sử thu tiền.  
* In phiếu thu.  
* Lập báo cáo doanh số.  
* Lập báo cáo công nợ.

### **Không được thực hiện**

* Không điều chỉnh tồn kho.  
* Không sửa số lượng hàng đã xuất.  
* Không thay đổi hạn mức nợ.  
* Không tự ý hủy phiếu thu đã xác nhận.

## **4.5. Ma trận phân quyền**

| Chức năng | Quản lý | Kinh doanh | Kho | Kế toán |
| ----- | ----- | ----- | ----- | ----- |
| Quản lý tài khoản | ✓ |  |  |  |
| Thay đổi quy định | ✓ |  |  |  |
| Quản lý đại lý | ✓ | ✓ | Xem | Xem |
| Quản lý mặt hàng | ✓ | Xem | ✓ | Xem |
| Lập phiếu nhập | ✓ |  | ✓ |  |
| Xác nhận nhập kho | ✓ |  | ✓ |  |
| Lập phiếu xuất | ✓ | ✓ | Xem | Xem |
| Xác nhận xuất kho | ✓ |  | ✓ |  |
| Lập phiếu thu | ✓ |  |  | ✓ |
| Xác nhận phiếu thu | ✓ |  |  | ✓ |
| Điều chỉnh tồn kho | Duyệt |  | Lập |  |
| Hủy chứng từ | ✓ |  |  | Theo quyền |
| Xem doanh số | ✓ | Giới hạn |  | ✓ |
| Xem công nợ | ✓ | Giới hạn |  | ✓ |
| Xem báo cáo kho | ✓ | Xem tồn | ✓ |  |
| Xem nhật ký | ✓ |  |  |  |

---

# **5\. Luồng thiết lập danh mục và quy định**

## **5.1. Mục đích**

Tạo dữ liệu nền trước khi phát sinh nhập hàng, tiếp nhận đại lý và xuất hàng.

## **5.2. Dữ liệu cần thiết lập**

### **Loại đại lý**

* Mã loại.  
* Tên loại.  
* Hạn mức nợ.  
* Trạng thái.  
* Mô tả.

### **Quận**

* Mã quận.  
* Tên quận.  
* Số đại lý tối đa.  
* Trạng thái.

### **Mặt hàng**

* Mã mặt hàng.  
* Tên mặt hàng.  
* Đơn vị tính.  
* Giá nhập hiện tại.  
* Tỷ lệ giá xuất.  
* Giá xuất dự kiến.  
* Mức tồn kho cảnh báo.  
* Trạng thái.

### **Đơn vị tính**

* Mã đơn vị.  
* Tên đơn vị.  
* Mô tả.  
* Trạng thái.

### **Phương thức thanh toán — đề xuất**

* Tiền mặt.  
* Chuyển khoản.  
* Phương thức khác.

## **5.3. Nguyên tắc**

* Không xóa loại đại lý đã được sử dụng.  
* Không xóa quận đã có đại lý.  
* Không xóa mặt hàng đã phát sinh nhập hoặc xuất.  
* Không xóa đơn vị tính đã gắn với mặt hàng.  
* Chỉ chuyển các đối tượng này sang trạng thái ngừng sử dụng.

---

# **6\. Luồng tiếp nhận đại lý**

## **6.1. Người thực hiện**

* Nhân viên kinh doanh.  
* Quản lý hệ thống.

## **6.2. Thông tin đầu vào**

Theo BM1, hồ sơ có:

* Tên đại lý.  
* Loại đại lý.  
* Điện thoại.  
* Địa chỉ.  
* Quận.  
* Ngày tiếp nhận.

Nhóm nên bổ sung:

* Mã đại lý.  
* Người đại diện.  
* Email.  
* Ghi chú.  
* Trạng thái.

Các trường bổ sung là đề xuất để website dễ quản lý, không phải yêu cầu gốc.

## **6.3. Luồng chính**

flowchart TD

    A\["Nhập hồ sơ đại lý"\] \--\> B\["Kiểm tra dữ liệu bắt buộc"\]

    B \--\> C\["Kiểm tra quận"\]

    C \--\> D{"Đã đủ số đại lý tối đa?"}

    D \--\>|Có| E\["Từ chối tiếp nhận"\]

    D \--\>|Chưa| F\["Chọn loại đại lý"\]

    F \--\> G\["Gán hạn mức nợ"\]

    G \--\> H\["Lưu hồ sơ"\]

    H \--\> I\["Đại lý hoạt động"\]

## **6.4. Quy tắc kiểm tra**

* Tên đại lý không được để trống.  
* Loại đại lý phải tồn tại.  
* Quận phải tồn tại.  
* Ngày tiếp nhận phải hợp lệ.  
* Số đại lý trong quận không được vượt giới hạn.  
* Số điện thoại phải đúng định dạng.  
* Email phải đúng định dạng nếu được nhập.  
* Không nên cho phép trùng hoàn toàn tên, địa chỉ và số điện thoại.

## **6.5. Kết quả**

* Đại lý được cấp mã.  
* Đại lý được gán loại.  
* Đại lý nhận hạn mức nợ tương ứng.  
* Dư nợ ban đầu bằng 0\.  
* Đại lý có thể được chọn khi lập phiếu xuất.

## **6.6. Trạng thái đại lý — đề xuất**

* Đang hoạt động.  
* Tạm ngưng.  
* Ngừng hợp tác.

Đại lý tạm ngưng hoặc ngừng hợp tác không được lập phiếu xuất mới.

## **6.7. Luồng ngoại lệ**

| Trường hợp | Cách xử lý |
| ----- | ----- |
| Quận đã đủ số lượng | Không cho lưu |
| Loại đại lý không tồn tại | Yêu cầu chọn lại |
| Trùng số điện thoại | Cảnh báo người dùng |
| Thiếu trường bắt buộc | Hiển thị lỗi tại trường |
| Đại lý đã có giao dịch | Không cho xóa, chỉ đổi trạng thái |

---

# **7\. Luồng nhập hàng**

## **7.1. Mục đích**

Ghi nhận hàng hóa được đưa vào kho.

Vì không quản lý nhà cung cấp nên phiếu nhập không theo dõi:

* Nhà cung cấp.  
* Số tiền đã trả cho nhà cung cấp.  
* Công nợ nhà cung cấp.  
* Phiếu chi.

## **7.2. Người thực hiện**

* Nhân viên kho.  
* Quản lý hệ thống.

## **7.3. Thông tin phiếu nhập**

Theo BM2:

* Số phiếu.  
* Ngày lập phiếu.  
* Mặt hàng.  
* Đơn vị tính.  
* Số lượng.  
* Đơn giá.  
* Thành tiền.  
* Tổng tiền.

Nhóm có thể bổ sung:

* Người lập.  
* Người xác nhận.  
* Ghi chú.  
* Trạng thái.  
* Thời gian tạo.  
* Thời gian xác nhận.

## **7.4. Công thức**

Thaˋnh tieˆˋn nhập=Soˆˊ lượng×Đơn giaˊ nhập\\text{Thành tiền nhập} \= \\text{Số lượng}\\times\\text{Đơn giá nhập} Tổng tieˆˋn nhập=∑Thaˋnh tieˆˋn của caˊc doˋng\\text{Tổng tiền nhập} \= \\sum \\text{Thành tiền của các dòng}

## **7.5. Luồng xử lý**

flowchart TD

    A\["Tạo phiếu nhập"\] \--\> B\["Thêm mặt hàng"\]

    B \--\> C\["Nhập số lượng và đơn giá"\]

    C \--\> D\["Tính thành tiền"\]

    D \--\> E\["Lưu nháp"\]

    E \--\> F{"Xác nhận nhập?"}

    F \--\>|Chưa| E

    F \--\>|Có| G\["Kiểm tra dữ liệu"\]

    G \--\> H\["Tăng tồn kho"\]

    H \--\> I\["Cập nhật giá nhập"\]

    I \--\> J\["Hoàn tất phiếu nhập"\]

## **7.6. Quy tắc kiểm tra**

* Phiếu phải có ít nhất một mặt hàng.  
* Không được lặp một mặt hàng nhiều lần trong cùng phiếu, hoặc phải tự động gộp dòng.  
* Số lượng phải lớn hơn 0\.  
* Đơn giá phải lớn hơn 0\.  
* Đơn vị tính phải phù hợp với mặt hàng.  
* Mặt hàng phải đang hoạt động.  
* Chỉ phiếu được xác nhận mới làm tăng tồn kho.  
* Phiếu nháp không ảnh hưởng đến tồn kho.

## **7.7. Cập nhật giá nhập**

Tài liệu giảng viên không nói rõ nếu một mặt hàng được nhập nhiều lần với giá khác nhau thì lấy giá nào để tính giá xuất.

Đây là điểm **cần xác nhận với giảng viên**.

### **Phương án đơn giản được đề xuất**

> Giá nhập hiện tại là đơn giá trên phiếu nhập gần nhất đã được xác nhận.

Ví dụ:

| Lần nhập | Đơn giá |
| ----- | ----- |
| Lần 1 | 100.000 |
| Lần 2 | 105.000 |

Sau lần nhập thứ hai:

Giaˊ nhập hiện tại=105.000\\text{Giá nhập hiện tại}=105.000 Giaˊ xuaˆˊt dự kieˆˊn=105.000×102%\\text{Giá xuất dự kiến}=105.000\\times102\\%

Các phiếu xuất cũ vẫn giữ nguyên đơn giá đã lưu trên phiếu.

---

# **8\. Luồng xuất hàng**

## **8.1. Mục đích**

Ghi nhận hàng được bán và xuất khỏi kho cho một đại lý.

## **8.2. Người thực hiện**

* Nhân viên kinh doanh lập phiếu.  
* Nhân viên kho xác nhận xuất.  
* Quản lý có thể can thiệp nếu được phân quyền.

## **8.3. Thông tin phiếu xuất**

Theo BM3:

* Đại lý.  
* Ngày lập phiếu.  
* Mặt hàng.  
* Đơn vị tính.  
* Số lượng.  
* Đơn giá.  
* Thành tiền.  
* Tổng tiền.  
* Số tiền trả.  
* Số tiền còn lại.

Nhóm nên bổ sung:

* Số phiếu xuất.  
* Người lập.  
* Người xác nhận xuất kho.  
* Ghi chú.  
* Trạng thái xuất kho.  
* Trạng thái thanh toán.

## **8.4. Công thức**

Đơn giaˊ xuaˆˊt=Đơn giaˊ nhập×102%\\text{Đơn giá xuất} \= \\text{Đơn giá nhập}\\times102\\% Thaˋnh tieˆˋn=Soˆˊ lượng×Đơn giaˊ xuaˆˊt\\text{Thành tiền} \= \\text{Số lượng}\\times\\text{Đơn giá xuất} Tổng tieˆˋn=∑Thaˋnh tieˆˋn từng doˋng\\text{Tổng tiền} \= \\sum \\text{Thành tiền từng dòng} Coˋn lại=Tổng tieˆˋn−Soˆˊ tieˆˋn trả\\text{Còn lại} \= \\text{Tổng tiền}-\\text{Số tiền trả}

## **8.5. Kiểm tra hạn mức nợ**

Dư nợ mới=Dư nợ hiện tại+Tổng tieˆˋn phieˆˊu xuaˆˊt−Soˆˊ tieˆˋn trả ngay\\text{Dư nợ mới} \= \\text{Dư nợ hiện tại} \+ \\text{Tổng tiền phiếu xuất} \- \\text{Số tiền trả ngay}

Phiếu chỉ hợp lệ nếu:

Dư nợ mới≤Hạn mức nợ\\text{Dư nợ mới}\\leq\\text{Hạn mức nợ}

## **8.6. Luồng chi tiết**

flowchart TD

    A\["Chọn đại lý"\] \--\> B\["Hiển thị loại và dư nợ"\]

    B \--\> C\["Thêm mặt hàng"\]

    C \--\> D\["Kiểm tra tồn kho"\]

    D \--\> E\["Tính đơn giá xuất"\]

    E \--\> F\["Nhập số tiền trả ngay"\]

    F \--\> G\["Tính dư nợ mới"\]

    G \--\> H{"Đủ điều kiện?"}

    H \--\>|Không| I\["Thông báo lý do"\]

    H \--\>|Có| J\["Chuyển chờ xuất kho"\]

    J \--\> K\["Kho xác nhận xuất"\]

    K \--\> L\["Giảm tồn kho"\]

    L \--\> M\["Ghi nhận doanh số và công nợ"\]

## **8.7. Các điều kiện bắt buộc**

* Đại lý phải đang hoạt động.  
* Phiếu phải có ít nhất một mặt hàng.  
* Số lượng xuất phải lớn hơn 0\.  
* Mặt hàng phải đang hoạt động.  
* Tồn kho phải đủ.  
* Đơn giá xuất phải hợp lệ.  
* Số tiền trả ngay không được âm.  
* Số tiền trả ngay không vượt tổng tiền.  
* Dư nợ mới không vượt hạn mức.

## **8.8. Ví dụ**

Đại lý loại 1:

* Hạn mức: 10.000.000 đồng.  
* Dư nợ hiện tại: 8.000.000 đồng.  
* Tổng phiếu xuất mới: 4.000.000 đồng.  
* Trả ngay: 3.000.000 đồng.

8.000.000+4.000.000−3.000.000=9.000.0008.000.000+4.000.000-3.000.000=9.000.000

Phiếu hợp lệ.

Nếu đại lý trả ngay 1.000.000 đồng:

8.000.000+4.000.000−1.000.000=11.000.0008.000.000+4.000.000-1.000.000=11.000.000

Phiếu không hợp lệ vì vượt hạn mức 1.000.000 đồng.

## **8.9. Kết quả sau khi xác nhận**

* Tồn kho giảm.  
* Doanh số tăng.  
* Khoản trả ngay được ghi nhận.  
* Phần còn lại trở thành công nợ.  
* Phiếu chuyển sang trạng thái đã xuất kho.  
* Trạng thái thanh toán được cập nhật.

---

# **9\. Luồng thu tiền và quản lý công nợ**

## **9.1. Mục đích**

Ghi nhận tiền đại lý thanh toán sau khi đã nhận hàng.

## **9.2. Người thực hiện**

* Kế toán.  
* Quản lý hệ thống.

## **9.3. Thông tin phiếu thu**

Theo BM5:

* Đại lý.  
* Địa chỉ.  
* Điện thoại.  
* Email.  
* Ngày thu tiền.  
* Số tiền thu.

Nhóm nên bổ sung:

* Số phiếu thu.  
* Phương thức thanh toán.  
* Nội dung thu.  
* Phiếu xuất liên quan.  
* Người lập.  
* Người xác nhận.  
* Ghi chú.  
* Trạng thái.

## **9.4. Quy tắc gốc**

Soˆˊ tieˆˋn thu≤Dư nợ hiện tại\\text{Số tiền thu}\\leq\\text{Dư nợ hiện tại}

Đồng thời cần kiểm tra:

Soˆˊ tieˆˋn thu\>0\\text{Số tiền thu}\>0

## **9.5. Công thức cập nhật**

Dư nợ mới=Dư nợ cu˜−Soˆˊ tieˆˋn thu\\text{Dư nợ mới} \= \\text{Dư nợ cũ}-\\text{Số tiền thu}

## **9.6. Luồng thu tiền**

flowchart TD

    A\["Chọn đại lý"\] \--\> B\["Hiển thị dư nợ"\]

    B \--\> C\["Hiển thị phiếu chưa thanh toán"\]

    C \--\> D\["Nhập số tiền thu"\]

    D \--\> E{"Tiền thu hợp lệ?"}

    E \--\>|Không| F\["Thông báo lỗi"\]

    E \--\>|Có| G\["Lập phiếu thu"\]

    G \--\> H\["Xác nhận thu tiền"\]

    H \--\> I\["Giảm công nợ"\]

    I \--\> J\["Cập nhật trạng thái thanh toán"\]

## **9.7. Thanh toán nhiều lần**

Một phiếu xuất có thể được thanh toán nhiều lần.

Ví dụ:

| Giao dịch | Số tiền |
| ----- | ----- |
| Tổng phiếu xuất | 12.000.000 |
| Trả ngay | 5.000.000 |
| Thu lần 2 | 4.000.000 |
| Còn nợ | 3.000.000 |

Trạng thái thanh toán:

* Sau khi xuất: Thanh toán một phần.  
* Sau lần thu thứ hai: Vẫn thanh toán một phần.  
* Khi thu đủ 3.000.000 đồng còn lại: Đã thanh toán.

## **9.8. Tiền trả ngay trên phiếu xuất**

BM3 có trường “Số tiền trả”, nhưng tài liệu chưa nói khoản tiền này có đồng thời tạo BM5 hay không.

Đây là điểm **cần xác nhận với giảng viên**.

### **Đề xuất logic**

* Nhân viên kinh doanh nhập số tiền đại lý trả ngay.  
* Khi kho xác nhận xuất, hệ thống tạo một giao dịch thu tương ứng.  
* Kế toán xác nhận tiền thực tế đã nhận.  
* Chỉ khoản tiền đã xác nhận mới được tính vào tổng tiền đã thu.

Phương án này giúp tránh trường hợp nhân viên kinh doanh nhập “đã trả” nhưng kế toán chưa nhận tiền.

---

# **10\. Luồng tồn kho**

## **10.1. Công thức cơ bản**

Toˆˋn cuoˆˊi=Toˆˋn đaˆˋu+Nhập−Xuaˆˊt+Đieˆˋu chỉnh\\text{Tồn cuối} \= \\text{Tồn đầu} \+ \\text{Nhập} \- \\text{Xuất} \+ \\text{Điều chỉnh}

## **10.2. Các sự kiện ảnh hưởng tồn kho**

| Sự kiện | Ảnh hưởng |
| ----- | ----- |
| Xác nhận phiếu nhập | Tăng tồn |
| Xác nhận phiếu xuất | Giảm tồn |
| Hủy phiếu nhập | Giảm lại tồn |
| Hủy phiếu xuất | Tăng lại tồn |
| Điều chỉnh tăng | Tăng tồn |
| Điều chỉnh giảm | Giảm tồn |

## **10.3. Quy tắc đề xuất**

* Không cho tồn kho âm.  
* Phiếu nháp không ảnh hưởng tồn.  
* Chỉ chứng từ đã xác nhận mới ảnh hưởng tồn.  
* Mỗi thay đổi tồn phải có chứng từ.  
* Không cho người dùng sửa trực tiếp con số tồn kho.  
* Điều chỉnh kho phải có lý do.  
* Mọi điều chỉnh phải lưu người thực hiện và thời gian.

---

# **11\. Luồng tiền của hệ thống**

Vì không quản lý nhà cung cấp nên hệ thống chỉ quản lý tiền vào từ đại lý.

flowchart TD

    A\["Xuất hàng"\] \--\> B\["Ghi nhận doanh số"\]

    B \--\> C{"Đại lý trả tiền"}

    C \--\>|Trả đủ| D\["Không còn nợ"\]

    C \--\>|Trả một phần| E\["Phát sinh công nợ"\]

    C \--\>|Chưa trả| F\["Nợ toàn bộ phiếu"\]

    E \--\> G\["Thu tiền lần sau"\]

    F \--\> G

    G \--\> H\["Giảm công nợ"\]

## **11.1. Phân biệt các khái niệm**

| Khái niệm | Ý nghĩa |
| ----- | ----- |
| Giá trị phiếu xuất | Tổng giá trị hàng đã giao |
| Doanh số | Tổng giá trị hàng đã xuất hợp lệ |
| Tiền đã thu | Tiền thực tế doanh nghiệp nhận |
| Công nợ | Phần tiền đại lý chưa trả |
| Hạn mức nợ | Số tiền tối đa đại lý được phép nợ |

## **11.2. Quan hệ**

Coˆng nợ phaˊt sinh=Giaˊ trị xuaˆˊt−Tieˆˋn trả ngay\\text{Công nợ phát sinh} \= \\text{Giá trị xuất} \- \\text{Tiền trả ngay} Dư nợ cuoˆˊi=Dư nợ đaˆˋu+Giaˊ trị xuaˆˊt−Tổng tieˆˋn thu\\text{Dư nợ cuối} \= \\text{Dư nợ đầu} \+ \\text{Giá trị xuất} \- \\text{Tổng tiền thu}

---

# **12\. Trạng thái nghiệp vụ**

## **12.1. Phiếu nhập**

stateDiagram-v2

    \[\*\] \--\> Nhap

    Nhap \--\> DaXacNhan

    Nhap \--\> DaHuy

    DaXacNhan \--\> DaHuy: Hủy có kiểm soát

* Nháp: chưa ảnh hưởng kho.  
* Đã xác nhận: đã tăng tồn kho.  
* Đã hủy: đã hoàn tác ảnh hưởng.

## **12.2. Phiếu xuất**

stateDiagram-v2

    \[\*\] \--\> Nhap

    Nhap \--\> ChoXuatKho

    ChoXuatKho \--\> DaXuatKho

    Nhap \--\> DaHuy

    ChoXuatKho \--\> DaHuy

    DaXuatKho \--\> DaHuy: Hủy có kiểm soát

* Nháp: kinh doanh đang lập.  
* Chờ xuất kho: đã kiểm tra điều kiện.  
* Đã xuất kho: kho đã giao hàng.  
* Đã hủy: phiếu không còn hiệu lực.

## **12.3. Thanh toán phiếu xuất**

stateDiagram-v2

    \[\*\] \--\> ChuaThanhToan

    ChuaThanhToan \--\> ThanhToanMotPhan

    ChuaThanhToan \--\> DaThanhToan

    ThanhToanMotPhan \--\> DaThanhToan

## **12.4. Phiếu thu**

* Chờ xác nhận.  
* Đã xác nhận.  
* Đã hủy.

Trạng thái xuất kho và trạng thái thanh toán phải tách riêng.

Ví dụ:

* Trạng thái nghiệp vụ: Đã xuất kho.  
* Trạng thái thanh toán: Thanh toán một phần.

---

# **13\. Chức năng đầy đủ của website**

## **13.1. Đăng nhập và bảo mật**

* Đăng nhập.  
* Đăng xuất.  
* Đổi mật khẩu.  
* Quên mật khẩu.  
* Khóa tài khoản.  
* Kiểm tra quyền truy cập.  
* Tự động hết phiên đăng nhập.  
* Không cho tài khoản bị khóa đăng nhập.

## **13.2. Quản lý người dùng**

* Thêm tài khoản.  
* Cập nhật thông tin.  
* Gán role.  
* Thay đổi role.  
* Khóa hoặc mở khóa.  
* Đặt lại mật khẩu.  
* Tìm kiếm tài khoản.  
* Xem lịch sử đăng nhập.

## **13.3. Quản lý loại đại lý**

* Thêm loại đại lý.  
* Cập nhật tên loại.  
* Thiết lập hạn mức nợ.  
* Ngừng sử dụng.  
* Xem số đại lý theo loại.  
* Xem lịch sử thay đổi hạn mức.

## **13.4. Quản lý quận**

* Thêm quận.  
* Cập nhật tên.  
* Thiết lập số đại lý tối đa.  
* Xem số đại lý hiện tại.  
* Ngừng sử dụng.  
* Không cho thêm đại lý khi đã đạt giới hạn.

## **13.5. Quản lý đại lý**

* Tiếp nhận đại lý.  
* Cập nhật hồ sơ.  
* Thay đổi loại đại lý.  
* Tạm ngưng hoạt động.  
* Ngừng hợp tác.  
* Tra cứu.  
* Xem lịch sử xuất hàng.  
* Xem lịch sử thanh toán.  
* Xem dư nợ.  
* Xem hạn mức còn lại.

## **13.6. Quản lý đơn vị tính**

* Thêm đơn vị tính.  
* Cập nhật tên.  
* Ngừng sử dụng.  
* Xem mặt hàng đang sử dụng.

## **13.7. Quản lý mặt hàng**

* Thêm mặt hàng.  
* Cập nhật thông tin.  
* Gán đơn vị tính.  
* Xem giá nhập hiện tại.  
* Xem giá xuất dự kiến.  
* Xem tồn kho.  
* Thiết lập tồn cảnh báo.  
* Ngừng kinh doanh.

## **13.8. Quản lý phiếu nhập**

* Tạo phiếu.  
* Thêm dòng hàng.  
* Xóa dòng hàng.  
* Tự động tính thành tiền.  
* Tự động tính tổng tiền.  
* Lưu nháp.  
* Xác nhận nhập kho.  
* In phiếu.  
* Tra cứu.  
* Hủy phiếu có kiểm soát.

## **13.9. Quản lý phiếu xuất**

* Tạo phiếu.  
* Chọn đại lý.  
* Hiển thị hạn mức và dư nợ.  
* Chọn mặt hàng.  
* Hiển thị tồn kho.  
* Tính giá xuất.  
* Tính tổng tiền.  
* Nhập số tiền trả ngay.  
* Tính dư nợ mới.  
* Kiểm tra hạn mức.  
* Chuyển chờ xuất kho.  
* Xác nhận xuất kho.  
* In phiếu.  
* Theo dõi thanh toán.  
* Hủy phiếu có kiểm soát.

## **13.10. Quản lý tồn kho**

* Xem tồn kho hiện tại.  
* Xem số lượng đã nhập.  
* Xem số lượng đã xuất.  
* Xem lịch sử biến động.  
* Xem thẻ kho.  
* Cảnh báo tồn thấp.  
* Kiểm kê kho.  
* Điều chỉnh tồn.  
* Không cho xuất âm kho.

## **13.11. Quản lý phiếu thu**

* Tạo phiếu thu.  
* Chọn đại lý.  
* Hiển thị dư nợ.  
* Chọn phiếu xuất cần thanh toán.  
* Nhập số tiền.  
* Chọn phương thức thanh toán.  
* Xác nhận phiếu.  
* In phiếu.  
* Tra cứu.  
* Hủy phiếu có kiểm soát.

## **13.12. Quản lý công nợ**

* Xem tổng dư nợ.  
* Xem dư nợ từng đại lý.  
* Xem công nợ theo loại đại lý.  
* Xem lịch sử phát sinh tăng.  
* Xem lịch sử phát sinh giảm.  
* Xem phiếu chưa thanh toán.  
* Xem phiếu thanh toán một phần.  
* Đối chiếu công nợ.  
* Xuất bảng công nợ.

## **13.13. Tra cứu**

Cho phép tìm theo:

* Mã đại lý.  
* Tên đại lý.  
* Số điện thoại.  
* Loại đại lý.  
* Quận.  
* Trạng thái.  
* Khoảng dư nợ.  
* Số phiếu nhập.  
* Số phiếu xuất.  
* Số phiếu thu.  
* Khoảng ngày.  
* Mặt hàng.  
* Trạng thái chứng từ.  
* Trạng thái thanh toán.

## **13.14. Báo cáo**

* Báo cáo doanh số tháng.  
* Báo cáo công nợ tháng.  
* Báo cáo nhập xuất tồn.  
* Doanh số theo đại lý.  
* Doanh số theo mặt hàng.  
* Số phiếu xuất theo đại lý.  
* Tổng tiền đã thu.  
* Đại lý có dư nợ cao.  
* Mặt hàng bán nhiều.  
* Mặt hàng tồn thấp.  
* Xuất Excel.  
* Xuất PDF.

## **13.15. Thay đổi quy định**

* Thay đổi số loại đại lý.  
* Thay đổi hạn mức nợ từng loại.  
* Thay đổi số đại lý tối đa trong quận.  
* Quản lý số lượng mặt hàng.  
* Quản lý đơn vị tính.  
* Thay đổi tỷ lệ tính giá xuất.  
* Lưu lịch sử thay đổi.

---

# **14\. Báo cáo doanh số**

Theo BM6.1, báo cáo gồm:

* Tháng.  
* Đại lý.  
* Số phiếu xuất.  
* Tổng trị giá.  
* Tỷ lệ.

## **14.1. Công thức**

Doanh soˆˊ đại lyˊ=∑Giaˊ trị phieˆˊu xuaˆˊt hợp lệ\\text{Doanh số đại lý} \= \\sum \\text{Giá trị phiếu xuất hợp lệ} Tỷ lệ=Doanh soˆˊ đại lyˊTổng doanh soˆˊ taˆˊt cả đại lyˊ×100%\\text{Tỷ lệ} \= \\frac{\\text{Doanh số đại lý}} {\\text{Tổng doanh số tất cả đại lý}} \\times100\\%

## **14.2. Điều kiện tính**

Chỉ tính phiếu:

* Đã xuất kho.  
* Không bị hủy.  
* Có ngày xuất thuộc tháng báo cáo.

Doanh số không phụ thuộc việc đại lý đã thanh toán hay chưa.

---

# **15\. Báo cáo công nợ**

Theo BM6.2, báo cáo gồm:

* Tháng.  
* Đại lý.  
* Nợ đầu.  
* Phát sinh.  
* Nợ cuối.

Để rõ ràng hơn, nhóm nên hiển thị:

| Đại lý | Nợ đầu | Phát sinh tăng | Phát sinh giảm | Nợ cuối |
| :---: | :---: | :---: | :---: | :---: |

Trong đó:

* Phát sinh tăng: giá trị hàng xuất.  
* Phát sinh giảm: tiền đại lý đã trả.

Nợ cuoˆˊi=Nợ đaˆˋu+Phaˊt sinh ta˘ng−Phaˊt sinh giảm\\text{Nợ cuối} \= \\text{Nợ đầu} \+ \\text{Phát sinh tăng} \- \\text{Phát sinh giảm}

Nếu buộc phải giữ đúng một cột “Phát sinh”:

Phaˊt sinh roˋng=Phaˊt sinh ta˘ng−Phaˊt sinh giảm\\text{Phát sinh ròng} \= \\text{Phát sinh tăng} \- \\text{Phát sinh giảm} Nợ cuoˆˊi=Nợ đaˆˋu+Phaˊt sinh roˋng\\text{Nợ cuối} \= \\text{Nợ đầu} \+ \\text{Phát sinh ròng}

---

# **16\. Báo cáo nhập xuất tồn — đề xuất bổ sung**

Tài liệu gốc không có biểu mẫu này, nhưng đây là báo cáo hợp lý vì hệ thống có nhập và xuất kho.

| Mặt hàng | Tồn đầu | Nhập | Xuất | Điều chỉnh | Tồn cuối |
| :---: | :---: | :---: | :---: | :---: | :---: |

Toˆˋn cuoˆˊi=Toˆˋn đaˆˋu+Nhập−Xuaˆˊt+Đieˆˋu chỉnh\\text{Tồn cuối} \= \\text{Tồn đầu} \+ \\text{Nhập} \- \\text{Xuất} \+ \\text{Điều chỉnh}

Đây là chức năng bổ sung, không phải yêu cầu bắt buộc từ tài liệu giảng viên.

---

# **17\. Các quy tắc nghiệp vụ**

## **17.1. Quy tắc từ đề bài**

| Mã | Quy tắc |
| ----- | ----- |
| BR01 | Ban đầu có 2 loại đại lý |
| BR02 | Ban đầu có 20 quận |
| BR03 | Mỗi quận tối đa 4 đại lý |
| BR04 | Ban đầu có 5 mặt hàng |
| BR05 | Ban đầu có 3 đơn vị tính |
| BR06 | Đại lý loại 1 nợ tối đa 10 triệu đồng |
| BR07 | Đại lý loại 2 nợ tối đa 5 triệu đồng |
| BR08 | Giá xuất bằng 102% giá nhập |
| BR09 | Tiền thu không vượt dư nợ |
| BR10 | Người dùng được phép thay đổi các quy định nêu trong QĐ7 |

## **17.2. Quy tắc đề xuất để hệ thống hoạt động logic**

| Mã | Quy tắc |
| ----- | ----- |
| BR11 | Không cho xuất vượt tồn kho |
| BR12 | Không cho tồn kho âm |
| BR13 | Số lượng nhập, xuất phải lớn hơn 0 |
| BR14 | Đơn giá phải lớn hơn 0 |
| BR15 | Phiếu phải có ít nhất một mặt hàng |
| BR16 | Phiếu nháp không ảnh hưởng kho hoặc công nợ |
| BR17 | Chỉ phiếu được xác nhận mới cập nhật dữ liệu |
| BR18 | Đại lý ngừng hoạt động không được xuất hàng mới |
| BR19 | Dư nợ mới không được vượt hạn mức |
| BR20 | Không xóa đại lý đã phát sinh giao dịch |
| BR21 | Không xóa mặt hàng đã phát sinh giao dịch |
| BR22 | Không sửa trực tiếp chứng từ đã xác nhận |
| BR23 | Hủy chứng từ phải nhập lý do |
| BR24 | Mọi thay đổi quan trọng phải ghi nhật ký |
| BR25 | Quy định mới không làm thay đổi chứng từ cũ |
| BR26 | Phiếu thu chỉ giảm nợ khi đã xác nhận |
| BR27 | Giá trên phiếu xuất phải được lưu cố định tại thời điểm lập |
| BR28 | Hủy chứng từ phải hoàn tác ảnh hưởng liên quan |

---

# **18\. Xử lý hủy chứng từ**

## **18.1. Hủy phiếu nhập**

Hệ thống cần:

* Kiểm tra hàng đã nhập có đủ để hoàn tác không.  
* Giảm lại tồn kho.  
* Ghi lý do hủy.  
* Lưu người hủy.  
* Lưu thời gian hủy.

Không được hủy nếu hoàn tác làm tồn kho âm, trừ khi xử lý các phiếu xuất liên quan trước.

## **18.2. Hủy phiếu xuất**

Hệ thống cần:

* Tăng lại tồn kho.  
* Giảm doanh số.  
* Giảm công nợ phát sinh.  
* Kiểm tra các phiếu thu liên quan.  
* Ghi lý do hủy.  
* Lưu người hủy.

Nếu phiếu đã có tiền thu, phải xử lý khoản thu trước khi hủy.

## **18.3. Hủy phiếu thu**

Hệ thống cần:

* Tăng lại dư nợ đại lý.  
* Cập nhật trạng thái thanh toán của phiếu xuất.  
* Ghi lý do.  
* Lưu người hủy và thời gian.

---

# **19\. Mô hình dữ liệu khái niệm**

Đây là mô hình đề xuất để biểu diễn các quan hệ nghiệp vụ, chưa phải lược đồ cơ sở dữ liệu cuối cùng.

erDiagram

    AGENCY\_TYPE ||--o{ AGENCY : "phân loại"

    DISTRICT ||--o{ AGENCY : "thuộc"

    AGENCY ||--o{ EXPORT\_RECEIPT : "nhận hàng"

    EXPORT\_RECEIPT ||--|{ EXPORT\_DETAIL : "gồm"

    PRODUCT ||--o{ EXPORT\_DETAIL : "được xuất"

    PRODUCT ||--o{ IMPORT\_DETAIL : "được nhập"

    IMPORT\_RECEIPT ||--|{ IMPORT\_DETAIL : "gồm"

    AGENCY ||--o{ PAYMENT\_RECEIPT : "thanh toán"

    EXPORT\_RECEIPT ||--o{ PAYMENT\_ALLOCATION : "được trả"

    PAYMENT\_RECEIPT ||--o{ PAYMENT\_ALLOCATION : "phân bổ"

## **19.1. Các nhóm bảng chính**

### **Người dùng và phân quyền**

* Người dùng.  
* Role.  
* Quyền.  
* Role – quyền.  
* Nhật ký hoạt động.

### **Danh mục**

* Loại đại lý.  
* Quận.  
* Mặt hàng.  
* Đơn vị tính.  
* Quy định hệ thống.

### **Đại lý**

* Đại lý.  
* Lịch sử thay đổi loại.  
* Lịch sử thay đổi trạng thái.

### **Kho**

* Phiếu nhập.  
* Chi tiết phiếu nhập.  
* Phiếu xuất.  
* Chi tiết phiếu xuất.  
* Giao dịch tồn kho.  
* Phiếu điều chỉnh kho.

### **Thanh toán**

* Phiếu thu.  
* Phân bổ thanh toán.  
* Giao dịch công nợ.

---

# **20\. Cấu trúc menu website**

Tổng quan

Đại lý

├── Danh sách đại lý

├── Tiếp nhận đại lý

├── Chi tiết đại lý

├── Lịch sử nhận hàng

└── Lịch sử thanh toán

Hàng hóa

├── Danh sách mặt hàng

├── Đơn vị tính

└── Giá nhập và giá xuất

Kho hàng

├── Phiếu nhập

├── Phiếu xuất

├── Tồn kho

├── Thẻ kho

└── Kiểm kê và điều chỉnh

Thu tiền

├── Phiếu thu

├── Công nợ đại lý

└── Đối chiếu công nợ

Báo cáo

├── Báo cáo doanh số

├── Báo cáo công nợ

└── Báo cáo nhập xuất tồn

Quản trị

├── Người dùng

├── Loại đại lý

├── Quận

├── Quy định

└── Nhật ký hệ thống

Mỗi role chỉ nhìn thấy những mục được cấp quyền.

---

# **21\. Dashboard tổng quan**

Dashboard nên hiển thị:

* Tổng số đại lý.  
* Số đại lý đang hoạt động.  
* Tổng số mặt hàng.  
* Tổng giá trị hàng đã nhập trong tháng.  
* Tổng doanh số tháng.  
* Tổng tiền đã thu trong tháng.  
* Tổng công nợ hiện tại.  
* Số phiếu xuất chờ xử lý.  
* Số mặt hàng dưới mức tồn cảnh báo.  
* Đại lý có dư nợ cao.  
* Biểu đồ doanh số theo tháng.  
* Biểu đồ công nợ theo đại lý.  
* Biểu đồ mặt hàng bán nhiều.

Các chỉ số trên dashboard phải lấy từ dữ liệu thật, không nhập thủ công.

---

# **22\. Yêu cầu phi chức năng**

Ngoài chức năng nghiệp vụ, website nên đáp ứng:

## **22.1. Bảo mật**

* Mật khẩu phải được mã hóa.  
* Người dùng chỉ được truy cập chức năng đúng quyền.  
* Không hiển thị dữ liệu nhạy cảm không cần thiết.  
* Kiểm tra dữ liệu đầu vào.  
* Chống truy cập trực tiếp vào API không có quyền.

## **22.2. Toàn vẹn dữ liệu**

* Xác nhận phiếu phải được xử lý trong một giao dịch.  
* Nếu cập nhật tồn kho thất bại thì không ghi nhận phiếu thành công.  
* Nếu ghi nhận công nợ thất bại thì không hoàn tất phiếu xuất.  
* Không tạo trùng mã chứng từ.

## **22.3. Hiệu năng**

* Danh sách cần có phân trang.  
* Có bộ lọc và tìm kiếm.  
* Không tải toàn bộ dữ liệu cùng lúc.  
* Báo cáo theo tháng phải có thời gian phản hồi hợp lý.

## **22.4. Khả dụng**

* Giao diện dễ đọc.  
* Thông báo lỗi rõ ràng.  
* Các nút xác nhận và hủy phải dễ phân biệt.  
* Các trường bắt buộc phải được đánh dấu.  
* Có hộp thoại xác nhận trước thao tác quan trọng.

## **22.5. Truy vết**

Hệ thống nên lưu:

* Người tạo.  
* Thời gian tạo.  
* Người cập nhật.  
* Thời gian cập nhật.  
* Người xác nhận.  
* Người hủy.  
* Lý do hủy.  
* Giá trị trước và sau khi thay đổi quy định.

---

# **23\. Các tình huống kiểm thử quan trọng**

## **TC01 — Tiếp nhận đại lý hợp lệ**

* Quận còn chỗ.  
* Thông tin đầy đủ.  
* Đại lý được lưu thành công.  
* Dư nợ ban đầu bằng 0\.

## **TC02 — Quận đã đủ số đại lý**

* Quận đã có số đại lý bằng giới hạn.  
* Hệ thống từ chối thêm mới.  
* Hiển thị lý do rõ ràng.

## **TC03 — Nhập hàng thành công**

* Phiếu có mặt hàng hợp lệ.  
* Số lượng và đơn giá lớn hơn 0\.  
* Sau xác nhận, tồn kho tăng đúng.

## **TC04 — Xuất vượt tồn kho**

* Tồn kho có 10 sản phẩm.  
* Người dùng xuất 15\.  
* Hệ thống từ chối xác nhận.

## **TC05 — Xuất làm vượt hạn mức nợ**

* Dư nợ mới lớn hơn hạn mức.  
* Hệ thống từ chối.  
* Hiển thị số tiền cần trả thêm.

## **TC06 — Thu tiền hợp lệ**

* Đại lý nợ 5 triệu đồng.  
* Thu 3 triệu đồng.  
* Dư nợ còn 2 triệu đồng.

## **TC07 — Thu vượt dư nợ**

* Đại lý nợ 5 triệu đồng.  
* Người dùng nhập 6 triệu đồng.  
* Hệ thống từ chối.

## **TC08 — Thanh toán nhiều lần**

* Phiếu xuất 10 triệu đồng.  
* Thu lần 1 là 4 triệu đồng.  
* Thu lần 2 là 3 triệu đồng.  
* Dư nợ còn 3 triệu đồng.  
* Trạng thái là thanh toán một phần.

## **TC09 — Hủy phiếu xuất chưa thu tiền**

* Hệ thống tăng lại tồn kho.  
* Giảm doanh số.  
* Giảm công nợ.

## **TC10 — Hủy phiếu xuất đã thu tiền**

* Hệ thống không cho hủy trực tiếp.  
* Yêu cầu xử lý phiếu thu liên quan trước.

## **TC11 — Thay đổi tỷ lệ giá xuất**

* Phiếu xuất cũ giữ nguyên giá.  
* Phiếu mới áp dụng tỷ lệ mới.

## **TC12 — Người dùng không có quyền**

* Kinh doanh truy cập trang quản lý tài khoản.  
* Hệ thống từ chối truy cập.

---

# **24\. Các điểm cần hỏi lại giảng viên**

Để không tự đặt nghiệp vụ sai, nhóm nên xác nhận các câu sau:

1. Nếu một mặt hàng có nhiều lần nhập với nhiều đơn giá, đơn giá xuất lấy theo lần nhập gần nhất hay giá nhập bình quân? tôi muốn 1 mặt hàng có 1 giá nhập thôi, vì tôi ko muốn nhập nhằng với các nhà cung cấp  
2. Số tiền trả trên BM3 có tự động được xem là tiền đã thu không, hay bắt buộc phải lập BM5? bắt buộc  
3. Khi thay đổi hạn mức nợ, các đại lý đang có dư nợ vượt hạn mức mới sẽ được xử lý như thế nào? bạn recommend cho tôi hướng thử đi   
4. Báo cáo công nợ BM6.2 dùng “Phát sinh” là phát sinh tăng, phát sinh ròng hay cần tách tăng và giảm? tăng và giảm, muốn tách riêng để rõ ràng  
5. Có cho phép sửa hoặc hủy phiếu đã xác nhận không? tôi vẫn chưa hiểu rõ câu hỏi này, nếu sửa hoặc huỷ phiếu đã xác nhận sẽ gây ra trường hợp nào tồi tệ lắm ko, theo bạn, tôi có nên sửa hoặc huỷ phiếu đã xác nhận hay ko?  
6. Có yêu cầu theo dõi tồn kho cụ thể hay chỉ ghi nhận phiếu nhập và phiếu xuất? bạn recommend câu trả lời cho tôi thử  
7. Hệ thống quản lý một kho duy nhất hay có nhiều kho? 1 kho   
8. Việc thay đổi loại đại lý có áp dụng hạn mức mới ngay lập tức không? áp dụng ngay lập tức, nếu ko thì có ảnh hưởng gì nặng nề ko, nếu ko thì tôi nghĩ là nên áp dụng hạn mức mới ngay lập tức

Trước khi có phản hồi, nhóm có thể dùng các đề xuất trong tài liệu này làm phương án tạm thời nhưng phải ghi rõ trong SRS là giả định nghiệp vụ.

---

# **25\. Phạm vi triển khai cuối cùng được đề xuất**

## **Bắt buộc**

* Đăng nhập và phân quyền 4 role.  
* Quản lý tài khoản.  
* Quản lý loại đại lý.  
* Quản lý quận.  
* Quản lý đại lý.  
* Quản lý mặt hàng.  
* Quản lý đơn vị tính.  
* Lập và xác nhận phiếu nhập.  
* Lập và xác nhận phiếu xuất.  
* Quản lý tồn kho.  
* Lập phiếu thu.  
* Quản lý công nợ.  
* Tra cứu.  
* Báo cáo doanh số.  
* Báo cáo công nợ.  
* Thay đổi quy định.

## **Nên thực hiện**

* Dashboard.  
* Báo cáo nhập xuất tồn.  
* Lưu nháp và xác nhận chứng từ.  
* Hủy chứng từ có kiểm soát.  
* Cảnh báo tồn kho thấp.  
* Cảnh báo gần vượt hạn mức.  
* Nhật ký hoạt động.  
* Xuất Excel hoặc PDF.

## **Có thể để hướng phát triển**

* Đại lý tự đăng nhập.  
* Đại lý gửi yêu cầu đặt hàng.  
* Email nhắc công nợ.  
* Quản lý nhiều kho.  
* Quản lý giao hàng.  
* Quản lý nhà cung cấp.  
* Phân tích và dự báo doanh số.

---

# **26\. Kết luận**

Website được xây dựng quanh một chu trình nghiệp vụ hoàn chỉnh:

flowchart LR

    A\["Nhập hàng"\] \--\> B\["Tồn kho"\]

    B \--\> C\["Xuất cho đại lý"\]

    C \--\> D\["Doanh số"\]

    C \--\> E\["Công nợ"\]

    E \--\> F\["Thu tiền"\]

    F \--\> G\["Giảm công nợ"\]

    D \--\> H\["Báo cáo"\]

    G \--\> H

Bốn role phù hợp nhất là:

| Role | Trách nhiệm chính |
| ----- | ----- |
| Quản lý hệ thống | Tài khoản, quy định, kiểm soát và báo cáo |
| Nhân viên kinh doanh | Đại lý và phiếu xuất |
| Nhân viên kho | Phiếu nhập, xuất kho và tồn kho |
| Kế toán | Phiếu thu và công nợ |

Những nội dung chắc chắn từ đề giảng viên là tiếp nhận đại lý, nhập hàng, xuất hàng, tra cứu, thu tiền, báo cáo tháng và thay đổi quy định. Các phần như trạng thái chứng từ, kiểm tra tồn kho, phân quyền, hủy chứng từ và nhật ký là đề xuất cần thiết để biến yêu cầu sơ bộ thành một website có thể vận hành logic.

# **Danh sách các yêu cầu**

| STT | Tên yêu cầu | Loại yêu cầu | Biểu mẫu | Quy định | Ghi chú |
| ----- | ----- | ----- | ----- | ----- | ----- |
| 1 | Tiếp nhận đại lý | Nghiệp vụ | BM1 | QĐ1 | Gồm cập nhật hồ sơ, đổi loại, ngừng hợp tác (không mở lại; muốn hợp tác lại thì lập đại lý mới); chỉ xóa khi chưa phát sinh giao dịch |
| 2 | Lập phiếu nhập hàng | Nghiệp vụ | BM2 | QĐ2 |   |
| 3 | Lập phiếu xuất hàng | Nghiệp vụ | BM3 | QĐ3 | Tự sinh phiếu thu nếu có trả ngay |
| 4 | Tra cứu đại lý | Nghiệp vụ | BM4 | QĐ4 |   |
| 5 | Lập phiếu thu tiền | Nghiệp vụ | BM5 | QĐ5 |   |
| 6 | Lập báo cáo tháng | Nghiệp vụ | BM6.1 BM6.2 | QĐ6 |   |
| 7 | Thay đổi quy định | Nghiệp vụ |   | QĐ7 |   |
| 8 | Quản lý loại đại lý | Nghiệp vụ | BM8 | QĐ8 |   |
| 9 | Quản lý mặt hàng và đơn vị tính | Nghiệp vụ | BM9.1 BM9.2 | QĐ9 | Không quản lý danh mục (nhóm hàng) |
| 10 | Sửa / hủy phiếu nhập, phiếu xuất, phiếu thu | Nghiệp vụ | BM10 | QĐ10 | Không xóa vật lý |
| 11 | Quản lý tài khoản | Hệ thống | BM11 | QĐ11 | Gồm đăng nhập, đổi mật khẩu |
| 12 | Quản lý nhóm người dùng | Hệ thống | BM12 | QĐ12 |   |
| 13 | Phân quyền chức năng | Hệ thống | BM13 | QĐ13 |   |
| 14 | Quản lý nhật ký hệ thống | Hệ thống | BM14 | QĐ14 |   |
| 15 | Thanh toán trực tuyến | Nghiệp vụ | BM15 | QĐ15 | Qua môi trường sandbox |
| 16 | Tra cứu qua chatbot | Hệ thống | BM16 | QĐ16 | Tính năng mở rộng; tra cứu dư nợ, tồn kho, doanh số |

# **Danh sách các biểu mẫu và quy định**

## **Biểu mẫu 1 và quy định 1**

| BM1: Hồ Sơ Đại Lý |  |
| :---- | :---- |
| Mã đại lý**: \*** (hệ thống tự sinh, không nhập tay) |   |
| Tên: | Loại đại lý: |
| Điện thoại: | Địa chỉ: |
| Quận: | Ngày tiếp nhận: |
| Email: \* | Tình trạng: \*  ☐ Đang hoạt động   ☐ Ngừng hợp tác |

**QĐ1:** Có 2 loại đại lý (1, 2). Có 20 quận. Trong mỗi quận có tối đa 4 đại lý đang hoạt động (đại lý ngừng hợp tác không tính). Mỗi đại lý có Mã đại lý do hệ thống tự sinh, duy nhất và không thay đổi; Tên đại lý không cần duy nhất và có thể sửa. Đại lý mới có dư nợ ban đầu bằng 0 và nhận hạn mức nợ theo loại đại lý. Loại đại lý được gán hoặc đổi sang phải đang ở trạng thái "Đang sử dụng". Chỉ được đổi loại đại lý khi dư nợ hiện tại không vượt tiền nợ tối đa của loại đại lý mới. Đại lý chưa phát sinh giao dịch (kể cả phiếu đã hủy) có thể xóa; nếu đã phát sinh giao dịch thì không xóa, chỉ chuyển trạng thái sang "Ngừng hợp tác". Đại lý ngừng hợp tác không được lập phiếu xuất mới nhưng vẫn được lập phiếu thu công nợ để thu hồi khoản nợ còn lại. Đại lý ngừng hợp tác không được mở lại; muốn hợp tác trở lại thì lập hồ sơ đại lý mới với Mã đại lý mới.

 

## **Biểu mẫu 2 và quy định 2**

| BM2: Phiếu Nhập Hàng |  |  |  |  |  |  |
| ----- | ----- | ----- | :---- | ----- | ----- | ----- |
| Số phiếu: \* |  |  | Ngày lập phiếu: |  |  |  |
| Trạng thái: \*  ☐ Hiệu lực   ☐ Đã hủy |  |  |   |  |  |  |
| **STT** | **Mặt Hàng** | **Đơn Vị Tính** |  | **Số Lượng** | **Đơn Giá** | **Thành Tiền** |
| 1 |   |   |  |   |   |   |
| 2 |   |   |  |   |   |   |
| Tổng tiền:………………… |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

**QĐ2:** Có 5 mặt hàng, 3 đơn vị tính. Mỗi mặt hàng chỉ có một đơn giá nhập hiện tại; đơn giá trên phiếu nhập mới sẽ ghi đè đơn giá nhập hiện tại của mặt hàng.

 

## **Biểu mẫu 3 và quy định 3**

| BM3: Phiếu Xuất Hàng |  |  |  |  |  |  |
| ----- | ----- | ----- | :---- | ----- | ----- | ----- |
| Số phiếu: \* |  |  | Ngày lập phiếu: |  |  |  |
| Mã đại lý: |  |  | Trạng thái: \*  ☐ Hiệu lực   ☐ Đã hủy |  |  |  |
| **STT** | **Mặt Hàng** | **Đơn Vị Tính** |  | **Số Lượng** | **Đơn Giá** | **Thành Tiền** |
| 1 |   |   |  |   |   |   |
| 2 |   |   |  |   |   |   |
| Tổng tiền:…………………   Số tiền trả:…………………   Còn lại:………………… |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

**QĐ3:** Đại lý loại 1 có tiền nợ tối đa là 10.000.000đ, loại 2 có tiền nợ tối đa là 5.000.000đ. Đơn giá xuất \= 102% đơn giá nhập hiện tại tại thời điểm lập phiếu và được lưu cố định trên phiếu xuất. Số lượng xuất không được vượt tồn kho. Số tiền trả phải thỏa 0 ≤ Số tiền trả ≤ Tổng tiền phiếu xuất. Dư nợ mới \= Dư nợ hiện tại \+ Tổng tiền phiếu xuất − Số tiền trả và không được vượt tiền nợ tối đa của loại đại lý. Nếu số tiền trả lớn hơn 0, hệ thống tự sinh phiếu thu (BM5) liên kết với phiếu xuất.

 

## **Biểu mẫu 4**

| BM4: Danh Sách Các Đại Lý |  |  |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| **STT** | **Mã Đại Lý \*** | **Tên** | **Loại** | **Quận** | **Tiền Nợ** | **Điện Thoại \*** | **Tình Trạng \*** |
| 1 |   |   |   |   |   |   |   |
| 2 |   |   |   |   |   |   |   |

**QĐ4:** Cho phép tra cứu kết hợp nhiều tiêu chí: mã đại lý (khớp chính xác), tên, loại, quận, điện thoại, khoảng tiền nợ, tình trạng. Tiền nợ hiển thị là dư nợ hiện tại của đại lý.

 

## **Biểu mẫu 5 và quy định 5**

| BM5: Phiếu Thu Tiền |  |
| :---- | :---- |
| Số phiếu: \* | Ngày thu tiền: |
| Mã đại lý: | Địa chỉ: |
| Điện thoại: | Email: |
| Số tiền thu: | Phương thức thanh toán: \*  ☐ Tiền mặt   ☐ Chuyển khoản   ☐ Trực tuyến |
| Loại phiếu thu: \*  ☐ Tự sinh từ phiếu xuất   ☐ Thu công nợ | Phiếu xuất liên quan (nếu có): |
| Trạng thái: \*  ☐ Hiệu lực   ☐ Đã hủy |   |

**QĐ5:** Số tiền thu không vượt quá số tiền đại lý đang nợ. Có 2 loại phiếu thu: tự sinh từ phiếu xuất khi có trả ngay (không sửa/hủy riêng, chỉ thay đổi theo phiếu xuất liên kết) và phiếu thu công nợ do kế toán lập sau đó. Phương thức "Trực tuyến" chỉ áp dụng khi giao dịch thanh toán (BM15) thành công.

 

## **Biểu mẫu 6**

**Biểu mẫu 6.1**

| BM6.1: Báo Cáo Doanh Số |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Tháng năm: |  |  |  |  |  |
| **STT** | **Mã Đại Lý \*** | **Tên** | **Số Phiếu Xuất** | **Tổng Trị Giá** | **Tỷ Lệ** |
| 1 |   |   |   |   |   |
| 2 |   |   |   |   |   |

**Biểu mẫu 6.2**

| BM6.2: Báo Cáo Công Nợ Đại Lý |  |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Tháng năm: |  |  |  |  |  |  |
| **STT** | **Mã Đại Lý \*** | **Tên** | **Nợ Đầu** | **Phát Sinh** |  | **Nợ Cuối** |
|  |  |  |  | **Tăng \*** | **Giảm \*** |  |
| 1 |   |   |   |   |   |   |
| 2 |   |   |   |   |   |   |

**QĐ6:** Báo cáo chọn theo tháng và năm, chỉ tính phiếu còn hiệu lực. BM6.1: Tỷ lệ \= Tổng trị giá của đại lý ÷ tổng trị giá tất cả đại lý × 100%. BM6.2: Phát sinh tách thành Tăng (giá trị hàng xuất) và Giảm (tiền đã thu); Nợ cuối \= Nợ đầu \+ Tăng − Giảm. Báo cáo chỉ liệt kê đại lý có phát sinh trong tháng: BM6.1 gồm đại lý có ít nhất một phiếu xuất hiệu lực trong tháng; BM6.2 gồm đại lý có Tăng \> 0 hoặc Giảm \> 0\. Báo cáo nhận diện đại lý theo Mã đại lý, không gộp các đại lý trùng Tên.

 

## **Quy định 7**

**QĐ7:** Người dùng có thể thay đổi các quy định như sau:

●      QĐ1: Thay đổi số lượng các loại đại lý, thay đổi số đại lý tối đa trong quận.  
●      QĐ2: Thay đổi số lượng mặt hàng, thay đổi số lượng đơn vị tính.  
●      QĐ3: Thay đổi tiền nợ tối đa của từng loại đại lý, thay đổi tỉ lệ tính đơn giá xuất.

Quy định mới chỉ áp dụng cho phiếu lập từ thời điểm thay đổi, không ảnh hưởng đến phiếu cũ.

 

## **Biểu mẫu 8 và quy định 8**

| BM8: Danh Sách Loại Đại Lý |  |  |  |   |
| ----- | ----- | ----- | :---- | :---- |
| **STT** | **Loại Đại Lý** | **Tiền Nợ Tối Đa** | **Tình Trạng** |   |
| 1 |   |   |   |   |
| 2 |   |   |   |   |

**QĐ8:** Ban đầu có 2 loại đại lý. Không xóa loại đại lý đã có đại lý đang sử dụng; chỉ chuyển trạng thái sang "Ngừng sử dụng". Loại đại lý ngừng sử dụng không được gán cho đại lý mới.

 

## **Biểu mẫu 9 và quy định 9**

**Biểu mẫu 9.1** \*

| BM9.1: Danh Sách Mặt Hàng |  |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| **STT** | **Mặt Hàng** | **Đơn Vị Tính** | **Đơn Giá Nhập** | **Đơn Giá Xuất** | **Tồn Kho** | **Tình Trạng \*** |
| 1 |   |   |   |   |   |   |
| 2 |   |   |   |   |   |   |

**Biểu mẫu 9.2** \*

| BM9.2: Danh Sách Đơn Vị Tính |  |  |   |
| ----- | ----- | :---- | :---- |
| **STT** | **Đơn Vị Tính** | **Tình Trạng** |   |
| 1 |   |   |   |
| 2 |   |   |   |

**QĐ9:** Ban đầu có 5 mặt hàng, 3 đơn vị tính. Mỗi mặt hàng có một đơn vị tính và một đơn giá nhập hiện tại. Đơn giá xuất hiện tại được hệ thống tự động tính theo tỷ lệ quy định tại QĐ3 từ đơn giá nhập hiện tại, không nhập tay. Không xóa mặt hàng hoặc đơn vị tính đã phát sinh sử dụng; mặt hàng chỉ chuyển trạng thái sang "Ngừng KD", đơn vị tính chỉ chuyển trạng thái sang "Ngừng sử dụng". Mặt hàng hoặc đơn vị tính đã ngừng sử dụng không được chọn khi lập phiếu nhập, phiếu xuất mới.

 

## **Biểu mẫu 10 và quy định 10**

| BM10: Sửa / Hủy Phiếu |  |
| :---- | :---- |
| Loại phiếu:  ☐ Nhập   ☐ Xuất   ☐ Thu | Số phiếu: |
| Thao tác:  ☐ Sửa   ☐ Hủy | Lý do: |
| Nội dung trước khi sửa: | Nội dung sau khi sửa: |

**QĐ10:** Không xóa vật lý phiếu nhập, phiếu xuất, phiếu thu. Hủy phiếu là chuyển trạng thái sang "Đã hủy" và bắt buộc nhập lý do. Khi sửa hoặc hủy phiếu, hệ thống phải tính lại các dữ liệu liên quan gồm tồn kho, đơn giá nhập hiện tại, doanh số và công nợ trong cùng một thao tác. Đối với phiếu nhập, đơn giá nhập hiện tại của mặt hàng được xác định lại theo phiếu nhập còn hiệu lực gần nhất. Không cho phép sửa/hủy nếu làm tồn kho âm, làm dư nợ đại lý vượt hạn mức hoặc làm dư nợ âm. Không được thay đổi đại lý trên phiếu xuất hoặc phiếu thu đã lập. Phiếu thu tự sinh từ phiếu xuất không sửa/hủy riêng mà thay đổi theo phiếu xuất liên kết. Mọi thao tác sửa/hủy phải được tự động ghi nhận vào nhật ký hệ thống (BM14).

 

## **Biểu mẫu 11 và quy định 11**

| BM11: Tài Khoản Người Dùng |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- |
| **STT** | **Họ Tên** | **Email** | **Nhóm Người Dùng** | **Tình Trạng** |
| 1 |   |   |   |   |
| 2 |   |   |   |   |

**QĐ11:** Tên đăng nhập là email và không được trùng. Mật khẩu phải được băm (hash), không lưu mật khẩu dạng rõ; mật khẩu chỉ được nhập khi tạo mới hoặc đặt lại và không hiển thị lại dưới bất kỳ hình thức nào. Tài khoản bị khóa không đăng nhập được.

 

## **Biểu mẫu 12 và quy định 12**

| BM12: Nhóm Người Dùng |  |  |
| ----- | ----- | ----- |
| **STT** | **Mã Nhóm** | **Tên Nhóm** |
| 1 |   |   |
| 2 |   |   |

**QĐ12:** Ban đầu có 4 nhóm người dùng: Quản lý, Kinh doanh, Kho, Kế toán. Không xóa nhóm đang có người dùng.

 

## **Biểu mẫu 13 và quy định 13**

| BM13: Phân Quyền Chức Năng |  |  |  |
| ----- | ----- | :---- | ----- |
| Nhóm người dùng: |  |   |  |
| Người thực hiện: \* |  | Thời gian: \* |  |
| **STT** | **Chức Năng** |  | **Được Phép** |
| 1 |   |  | ☐ |
| 2 |   |  | ☐ |
|  |  |  |  |

**QĐ13:** Mỗi nhóm người dùng được cấp quyền truy cập các chức năng tương ứng. Người dùng chỉ thấy và sử dụng được những chức năng thuộc quyền của nhóm mình.

 

## **Biểu mẫu 14 và quy định 14**

| BM14: Nhật Ký Hệ Thống |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- |
| **Thời Gian** | **Người Dùng** | **Chức Năng** | **Thao Tác** | **Nội Dung** |
|   |   |   |   |   |
|   |   |   |   |   |

**QĐ14:** Ghi nhận người thực hiện, thời gian, chức năng, thao tác và nội dung (trước/sau) đối với các thao tác quan trọng: sửa/hủy phiếu, thay đổi quy định, quản lý tài khoản, nhóm và phân quyền. Nhật ký chỉ được xem, không được sửa hoặc xóa.

 

## **Biểu mẫu 15 và quy định 15**

| BM15: Giao Dịch Thanh Toán Trực Tuyến |  |
| :---- | :---- |
| Mã giao dịch: | Phiếu thu liên quan (sau khi thành công): |
| Số tiền: | Trạng thái:  ☐ Chờ thanh toán   ☐ Thành công   ☐ Thất bại   ☐ Hết hạn |
| Thời gian thanh toán: | Mã đại lý: \* |

**QĐ15:** Thanh toán trực tuyến áp dụng cho việc thanh toán công nợ và được thực hiện qua môi trường sandbox. Khi khởi tạo thanh toán, hệ thống tạo giao dịch (BM15) ở trạng thái "Chờ thanh toán". Chỉ khi giao dịch được xác nhận "Thành công", hệ thống mới tạo phiếu thu tương ứng (BM5), liên kết giao dịch với phiếu thu và giảm công nợ đại lý. Giao dịch "Thất bại" hoặc "Hết hạn" không tạo phiếu thu và không làm thay đổi công nợ.

 

## **Biểu mẫu 16 và quy định 16**

| BM16: Yêu Cầu Tra Cứu Qua Chatbot |  |
| :---- | :---- |
| Người dùng: | Nội dung hỏi: |
| Loại tra cứu:  ☐ Dư nợ đại lý   ☐ Tồn kho   ☐ Doanh số | Kết quả trả lời: |

**QĐ16:** Chatbot chỉ hỗ trợ tra cứu (dư nợ đại lý, tồn kho, doanh số). Kết quả trả về giới hạn theo đúng quyền của người dùng đang đăng nhập. Khi tên đại lý trùng nhiều đại lý, chatbot trả danh sách (Mã – Tên – Quận) để người dùng chọn theo Mã.

 

 

   


[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAhUAAAFJCAYAAAAsQN9vAAAc8UlEQVR4Xu3dXYxc9ZUg8B4DNvaYj9imbdz0h3EUooFA0M5kNEgzdngg80BkzezMaGCxRYJGm2RZkkiJdrKBjR9W4IfwEbKDpV0Jsh8EXhZNrLyQRcLjkRhA3hBpEWKwmCjMyJjYGLDNRzBJbZ12/831obvd7a6uW1X395P+6qpbdW/de/6n7jl9q9oeGgK6pWXUNgBgoLTovoh7nggA6He53tEFEfc8EQDQ73K9owsi7nkiAKDf5XpHF0Tc80QAQL/L9Y4uiLjniQCAfpfrHV0Qcc8TAQD9Ltc7uiDinicCAPpdrnd0QcQ9TwQA9Ltc7+iCiHueCADod7ne0QUR9zwRANDvcr2jCyLueSIAoN/lekcXRNzzRABAv8v1ji6IuOeJAIB+l+sdXRBxzxMBAP0u17uetG3btrxozvbu3dsaHR2d/NkrIu55IgCg3+V61xH79+9vjY2NnVLId+zYUXnG4iqvv2vXrvxQT4i454kAgH6X611HRFG/6qqrWps2bWodPXp0clm1qYjbK1asaG3ZsmXyKkQ8pzQgse7OnTsn14/bIfYzRjw3nrdv377JbeemIbYTz4vHSlNR3U7Zn9hOvHZ5biwrjUhZtphXNqaOBwAGSq53HVFtKkrhL01F+TiiFPHpmoq4ffvtt0/eLh99lOfHdg4cODBtU1G2Fcvj2GZrKsqVlGhu4nmxrLxWvIamAgDmJ9e7jihNRRTrKN5xvzQV8bNavKdrKuIqQqxbtlPE82Of4/m5qSjLqrdnayrK61aflxubxRLHkCcCAPpdrncdUW0GypWJaBTCXJqK6u3cVORmoJhvUxHbys+bbh8WQ8Q9TwQA9Ltc7zpiumagvNZMH3+UKxlR4KsFPX/8EY9P11SE0ihUP/4oH2+UdWZqKnz8AQALk+tdR+SmonoVIUTRjgbh1ltvPVnIo/jH/sQVjWpBj3VjeYzSeMzUVJTnxmPlI5TS0MT2Z2sqStMSz4390lQAwPzkerfoylWEGKWh6AXRXJT9igZkMU29DgAMlFzv6IKIe54IAOh3ud7RBRH3PBEA0O9yvaMLIu55IgCg3+V6RxdE3PNEAEC/y/WOLoi454kAgH6X6x1dEHHPEwEA/S7XO7og4p4nAgD6Xa53dEHEPU8EAPS7XO/ogoh7nggA6He53tEFEfc8EQDQ73K9owsi7nkiAKDf5XpHF0Tc80QAQL/L9Y4uiLjniQCAfpfrHV0Qcc8TAQD9Ltc7uiDinicCAPpdKXBG9wcAAADA3MSVhIN5IQDAfGxvj6NT46FTHwIAmLvq9x5crQAAzsj2oRNXKEpT4WoFADBv24dOXJmIn2GiPe5tj1eHNBYAwDxszwumTLTHzWkZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9JTWPOX165T37XTy+gBAB+XCezp5/TrlfTudvD4A0EFRbLdt2xYF9+TYtWvXKcU47h89erTnCvPp9r08VpadujYA0FGl+Fbt2LFj8mcU47gdo5ebiqqyr1u2bGnt3bv3lMfy+gBAB0WxzYW5emUi9FNTEft+4MCByaYiRjzNlQoA6IKZCnM/NxX79u1rjY2NnbziErf379/fU/sOAAMnF+b4yGDFihUn74d+aSqq+x77XB7TVABAF5TCHDfLyF/U7PWmIm6WUfY99nfTpk2Ty8p3K05dGwDoqKm+Yc7y+nXK+3Y6eX0AoINy4T2dvH6d8r6dTl4fAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAG0c15wZSJ9tielgEAzGiiPQ62x7vt8UZ7tCoDAGBevjF0akMRDcbN1ScAAMzFxNCJqxWuUgAACzYx9GFjAQCwIPExyM15YcXvtMcftceftsdfnXfeefesXr36f1x00UU/bo/n2rdfuvDCC//5/PPP/+W55557bOnSpe+dffbZx5csWfLrocpVkLgfy+PxeF48P9aL9WM7sb3Ybnv7d8frTL1evG68PgDQByba4w/a4y/bxf5b7eL+gzVr1vxju7gfjkZgdHT0zU9/+tOHr7vuujduuummI3fddddvHnjggdbDDz/cevLJJ1vPPvts6/nnn2+9/PLLrUOHDrWOHDnSevfdd1vHjx9vVcX9WB6Px/Pi+bFerB/bie3Fdtvbb23duvVIvF68brx+7EfsT3u/XhoeHv5BuzH5Vuzv1H4DADW4qD3+sF2cH1i3bt3frVq16pVzzjnn/csvv/zw5z//+Te+/vWvv3P//fe3nnnmmdYrr7zykcagLrEfsT+xX7F/sZ/XX3/94djv2P84jjieOK44vqnjBAAW4PeXLVt22/r16//2rLPO+uCyyy47fMMNN7zxve997zevvvpqrtUDLY73vvvu+00cf8Qh4hFxifhEnHLgAKDp1rbHn7SL5X9bu3btC+3i+frNN9/8xoMPPphrLG0Rl4hPxCniFXGL+E3FEQAaZ7g9/uKSSy754cqVK9+59tprD915552/2rNnT66hzCLiFXGL+EUcR0ZGHom4TsUXAAbOunbzsDv+YuLqq68+9PTTT+fayCKIOEe8I+4R/5iHPDEA0A82rlu37j9dfPHFz8dv0I8++mjrzTffzHWPLoi4R/xjHmI+2vNyR8xPnjAA6DXj7aL1nTVr1hy55ZZbXn/iiSdyjaNGMR8xLzE/MU8xX3kCAaBuvz0yMvKzCy+88NgXv/jFQ7mY0XtinmK+Yt5i/vKEAkC3rG77lyuuuOLgAw888N6xY8dyzaKPxPzt3LnzvZjPmNeY3zzhANBpn5mYmPjR0qVL39+7d2+uTQyAmNeY35jnmO+cAACwYJdccslzY2Njh+++++5j77zzTq5FDJCY3+9+97vHYr5j3nMuAMAZGR4e/lJ7/Pyxxx7LtYcGiHmP+Y88yLkBAKe1fv36r6xevXp//D8VUEQ+RF6sW7fuKzlnAOAUF1xwwZ+vXbv2nzZt2vTaU089lWsKtCIvIj8iTyJfcg4BQPjdK6+88uDjjz+e6wh8RORJ5EvkTU4kABpq5cqVR7761a8e/OCDD3LdgNOKvIn8iTzKuQVAc2wcHx//h+eeey7XCZi3yKPIp8irnGgADLBLL730W8uWLXvv7rvvPpKLA5ype+6550jkVeRXzjkABtCGDRv+/pprrjmwb9++XBNgwSKv2vn1WuRZzj0ABsRll132NyMjI2/kIgCLJfIt8i7nIgD9a0X7t8Y9n/vc5w74Pzropsi3yLvIv8jDnJgA9Jnh4eFffOMb3ziYT/jQLZF/kYc5NwHoE6OjozcvX7783XyCh7pEPkZe5lwFoIdt2LDh369ateqI/0mUXhL5GHk5Pj5+a85ZAHrU8PDwmy+88EI+p0PtIi8jP3POAtCDRkdHv/Tiiy/mczn0jMjPsbGxf5tzFwZBzne6IOKeJ4IF+72lS5f+as+ePTnc0HMiTyNfI29zIrNgOdx0QcRd8GtSgk/HrFm1atVrjzzyyHs51tCrIl8jbyN/c0KzIDnUdEHEXfBrUoJPZ4yNjT17++23H85xhl53xx13HI78zTnNguQw0wURd8GvSQl+3fJ+zSav20Oue+utt/LuQt+I/I08zondK/L+ziavW5O8W3RBxF3wa1KCX7e8X7PJ6/aI31q9evX+vK/QbyKPI59zgveCvK+zyevWJO8WXRBxF/yalODXbdu2bWVfJseuXbvyPrZWrFgx+ff1p6zYIzZu3PjQ1q1bf1kJLfSlyONLL730wZzjvWC288TUuWFyTD2vF1QiS7dE3AW/JiX4dYuTQIwQJ4doIOKEsX///sn7YceOHfHnbz2xv8nVK1eufNtHHwyCyOPI58jrnOh1q54nQjlPhPh59OjRk4/ldWtycn/onoi74NekBL9u+WQRJ4hNmzadcpKIpqKHfgM5aXx83BczGTiR1znX6zbTeeLAgQOTP4d674pmJaJ0S8Rd8GtSgl+3mU4Wpamo3s/r1u0HP/jBByd3HAZEO6+P51yv2+nOE2VZD13RPLlfdE/EXfBrUoJft3yyKFcl8u2Q163ZZ07uGAyYyO+c8HWa7TxRxFWK0dHRXjlPnLJvdEfEXfBrUoJft+rJovqdihAnjqq8bp3Gx8f/9yk7BwMk8jvnfJ1yU1HOE3GlYsuWLZPL4nwx9VFILzi5r3RPxF3wa1KCX7e8X7PJ69bohs9+9rMH8/7BoNi8efPByPOc+HXJ+zebvG5N8m7RBRF3wa9JCX7d8n7NJq9bl9HR0f/z4IMP/ibvHwyKyO/I85z7dcn7N5u8bk3ybtEFEXfBr0kJft3yfs0mr1uXc8899+34k1cYVJHfkec59+uS9282ed2a5N0aOOWLsb10Loy4D3zw4/iq/1BLryjBZ96+dOONN76R40nn5C/gdVP+7L7JIs8j3/MbgDnJ4Rw48b2W/L23ukXcawt+nDimdmByRMe1b9++yS/6zLcJuOqqq6bt1uJLRDt37pzx8TqV4DM/F1988cPf//73G/3RR/lC7VDl/ROjE2Lb1T8TnI/qe3q69/BMf4YYy0K8dnzp70xff9C087zVzvcfVvOfOcvh7Kp4/eqo1rdOKbWt/COFvVDnpo63vuBHACLY5QQUJ5NONxXl53SP16kEn2ltbo/tadmk4eHh//uTn/wkh7ORyrfte6kIR2Mxn/dvtangVJHnke/5PcBJm4dmOE8M1VjXipnqWydMV9tmqoPdFHGvNfgzBf3b3/725M7lSzvl8akdP3mZNIJ56623Ti4rXVuI9WNZ+ZfeyrbLb3l1KsFnWhPtEd9+vzctH7rgggteffHFF3M4Gyk3FfF+uPLKK0++d6rvlekaj/L+KO+z0hCU91n5TSiWl+fE8tw0VN+XcaWhPF5eO0Ysm+1KRfWEGD/rPjn2gsjzyPcPs59kYujEeSJGlsPZdTPVt1J/cn0r771Q/h2Q6vsttlfqWyyLbcSI2/FY3K77OxZT+1Rf8GcKevUkVw18tdOLdculn/gHV0qw80krVCeour08qd1Ugs+MJoY+LErx2fLkiWPJkiW/Pn78eA5nI03XVEz3fYR4PDcC+b1VllWbivKc2ZqK6vuwuo2q0jjM1lTE9qvve1qtyPPI98p7go+aGDpxfqieJ+KXkRzOrpupvhXTvQejKY96Vtapvt+qTUVRfU+5UtGaOejlfg76TE1FNZglwNXfnmLkri/kCe2msl/t8Z2YhCl52fbKsqIsi59FeU5ZFj9n2lb19fKycn+mZUVZVt3WYqyXx5PxkxOmayqqOV393kUu9LFezv/pmoqyfLamIpaV91+1qajOXVmvur+hLCvfp3jppZcm73PCNO8B4/Qj/pnzHMqum6m+Ffn9GvJ7pPp+qzYVsW453vJ8TUVr5qBHoKu3i/k0FeWEG8pvW9XtlefUpQSfWVVPFK5UJLM1FdX8jtu5qZjuhJabiuma++r7Ncx0pSJGeU+WE2U+YVYfi2XRVMTHk6WZaTpXKuasXKko54ntcbtuM9W36u38Hoxl8VH+dE18vMdixP3Ybqi+fzQVrZmDXr5TkU+E82kqyrZjxGfDsTxGtcOrUwk+M4oTxfa80HcqPjRbUxGGpvI8Ly/Ke6E8Vt4zsc3qdyPK8nhuPDbT+zIeL+vFsrgfV0vKdzNmaypCfi83ne9UzMnJj0aTHM6um6m+lSuI+X1UfY+W90L8LM+PZiPuV7dT/evGUu/qfP/EfvZE8LtluhNiXUrwmdbmoWkaijA8PPxTf/0xmMoVRU6Y+uuPn+b3ACdtHprhPDHUoLrWSyLuAx/86t+9ayr639q1a/9X/P0+vS9+Y4r33Fx+c4pmou7fsnpN5Hnke34PMCc5nHRBxF3wa1KCz/wsWbLkyzfccMPhHE8YNDfeeOPhc8455yv5PcCc5HDSBRF3wa9JCT7z5//+YNBFfvfS//3Rh3JI6YKIu+DXpASf+RsZGYn/pTSHFAZG5Hfkec595iyHlC6IuAt+TUrwmb+zzjrr32zevPlgjikMisjvdp7fmHOfOcshpQsi7oJfkxJ8zsz4+PhjOaYwKCYmJh7LOc+85JDSBRF3wa9JCT5n7DM5pjAoIr9zwjMvOaR0QcRd8GtSgs+Ze+ihh97PcYV+F3mdc515y2GlCyLugl+TEnzO3Pj4uD8tZeBEXudcZ95yWOmCiLvg16QEnwW5euXKlW+/9dZbObzQdyKPI58jr3OiM285vHRBxF3wa1KCz8Js3Ljxoa1bt76W4wv95qabbnot8jnnOGckh5cuiLgLfk1K8Fmw31q9erV/CYu+F3kc+ZwTnDOSw0sXRNwFvyYl+Czc2Wef/TkfgdDPIn+XLVv2xzm3OWM5xHRBxF3wa1KCT2eMjY09e/vtt7+e4wy97o477ng98jfnNAuSw0wXRNwFvyYl+HTMmlWrVr32yCOP+DNT+sYPf/jD9yNvI39zQrMgOdR0QcRd8GtSgk9H/d7SpUt/tWfPnhxu6DmRp5Gvkbc5kVmwHG66IOKeJwL63sTExJdffPHFnO/QMyI/23n6pZy7APSg4eHhN1944YV8LofaRV5GfuacBaBHbdy48bZVq1Yd2bt3bz6nQ20iHyMvJyYmbss5C0APW7du3bbly5e/m0/sUJfIx8jLnKsA9Inh4eFffPOb3zyUT/DQLZF/kYc5NwHoPys2bNjw99ddd92BY8eO5fM9LJrIt8i7yL/Iw5yYAPSpT3ziE38zMjLyRj7xw2KJfGvn3X/JuQjAgIjfGq+55prX9u3bl2sALFjkVeTX1NUJAAbdxz/+8f+4bNmy9+655x7/aQgdE/kUeRX5lXMOgMG2cXx8/B+ee+65XBtg3iKP2vn0VORVTjQAGmLlypVHbrvttoMffPBBrhNwWpE3kT+RRzm3AGiu3/3Upz71y8cffzzXDfiIyJPIl8ibnEgAEFct/mzt2rX/tGnTpteeeuqpXEegFXkR+RF5snz58n+dcwgATrF+/fp/t3r16v3PPPNMrik0WORD5EXkR84ZADitdevWfXl4ePjnjz32WK4xNEDMe8x/5EHODQA4IyMjIz8dGxs7fPfdd7/9zjvv5NrDAIn5jXmO+Y55z7kAAJ3wmQ0bNvxo6dKl7/sfUAdTzGvMb8xzzHdOAADotNVt/3LFFVcc3Llz56/8nyL9LeYv5jHmM+Y15jdPOAB0y2+vX7/+ZxdeeOGxW2655fVctOg9MU8xXzFvMX95QgGgbuPtIvWd9m+7R6JoPfHEE7mWUaOYj5iXmJ/2PG2P+coTCAC9ZuPw8PAd69at+38rV65859FHH229+eabucbRBRH3iH/MQ8xHzEvMT54wAOgH60ZHR3cvXbr0vauvvvrQ008/neseiyDiHPGOuEf8Yx7yxADAIBhuj78YGRl5JH6Dvvbaaw/deeed7+7ZsyfXRmYR8Yq4Rfwiju3m4ZGI61R8AaBx1rbHn1x88cX/de3atS9cdtllr3/hC19488EHH8w1lLaIS8Tnk5/85OGIV8Qt4jcVRwCg4veXL1/+1ZGRkR+dddZZH7SbjMM33HDD4fvuu+/Xr776aq6xAy2O99577/11HH/EIeIRcYn4RJxy4ACA09vcHq2p2xe1xx+uWbPmgfZv6X+3atWqV84555z3L7/88sPXX3/94a997Wtv33///ZP/T8Urr7zSOn78eK7VtYj9iP2J/Yr9i/2M/Y39jv2P44jjGR4e3hnHN3WcoRw3ANABz7XHu3lh8gft8ZdLly7964suuuihdtPxj+edd97hJUuW/Hp0dPTNq6+++vB11133xtatW4/cddddrQceeKD18MMPt5588snWs88+23r++edbL7/8cuvQoUOtI0eOtN59992PNCRxP5bH4/G8eH6sF+vHdmJ7sd3YfrxOvF68brx+7EfsT+xX7N/ZZ5/917G/U/s9G00FAHTI5qETDUUU17h9Jn6nPf6oPf60Pf7q/PPPv3f16tX/c+3atT9uF/jn2rdf+tjHPvbP7eW/PPfcc4/FX0y0i/7xaASGTrzu5Ij7sTwej+fF82O9WD+20x4/ju22l98TrzP1evG68fpnaiIvAADOTFylKIU9bgMAzFtpKN5oj6NTP5vWWPw8LwAA5q80FNunbpex+cOnDDzfqQCADtheuR3FdWJq2ZOV5YNOUwEAHaa4AgAdoakAADqiqU2FL2oCQIc1talo6nEDwKJpanGdyAsAgIVpalMBAHSYpgIA6IimNhW+qAkAHdbUpqKpxw0Ai6apxXUiLwAAFqapTQUA0GFNbSp8pwIAOqypTUVTjxsAFk1Ti2tTjxsAFk1Ti+tEXgAALExTmwoAoMOa2lT4oiYAdFhTm4qmHjcALJqmFteJvAAAWJimNhUAQIdpKgCAjmhqU+GLmgDQYU1tKpp63ACwaJpaXCfyAgBgYZraVAAAHdbUpsJ3KgCgw5raVDT1uAFg0TS1uDb1uAFgYVrzlNcfQBN5AQAwB9EobNu2LZqFk2PXrl2TDcTevXtbK1asmFy2f//+gWsqPmyV5iavDwBURLGMpiJGKI1ENBabNm062WCUx/P6/awcV9wsIxsbGzsZg7Q6AFAVxbLaVIQdO3accr8sC3n9fhbHUz3OaKhKA1HE0zQVADAHUSxzU1GuUoRy5WJQP/7IzdN0cdBUAMAclEJ6uisVo6Ojkw1GXr+fxXHl44wm4ujRo5PLNRUAMA+lsJbiWv1OxZYtWybvV4ttXr+flWOvivtxVSa+SxFPKSPikVYHAKpKIY2bZTTprz9O950KVyoAYI5OqaBzkNfvZ/nYTievDwBU5MJ5Onn9fpaP7XTy+gDA3Ax8Ec1Nw+nk9QGAuVFEAYCOaGpT0dTjBoBF09Ti2tTjBoBF09TiOpEXAAAL09SmAgDosKY2FT/PCwCAhWlqU9HU4waARdPU4trU4waARaO4AgAdoakAADqiqU2FL2oCQIc1talo6nEDwKJpanGdyAsAgIVpalMBAHSYpgIA6IimNhVNPW4AWDRNLa5NPW4AWDRNLa4TeQEAsDBNbSoAgA5ralPhH78CgA5ralPR1OMGgEXT1OLa1OMGgEWjuAIAHaGpAAA6oqlNhS9qAkCHNbWpaOpxA8CiaWpxncgLAICFaVJTsT0vAAA6p0lNxc3tcXDo1OYibjcpBgCwaJpWUL/RHkeHThx3GdurTwAAzkzTmoqJoRNXK6pNBQDQAU0sqnG1wlUKAOiwJjYVE0OuUgBAxzW1sDb1uAEYYNXP9o1mDQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgQ8d93fz4vPAP/qj1emfoJAAygKPLROJTxi8pjF7fHl9rjZ1O3T+e/t8d/yAunxGPzaU5iv+b6ugBAD4jiXb16EIV/ZeV2NBq7K8uKeCyKfjz+9tCJbUTj8P2hE41JLC9K41J9XlVs+z8PnXi8rFeaitheWS+UpiXW2T11GwDoAbmpKAU/lkUxL8U7NwLRVJQGZPfQicdjREMRVxdi/Xg8fsbHHiEagng8X7GIbVTXKyNeP9aJ7e6eep6mAgB6VLmKUMbuqeVR+Ku3S9EvYlm5Xwp/GSGKfjynPBbi+bGd3VP3i2qzEOJ2aUZKc7J7SFMBAD0tX6moXmXYPbVspqaifCRSbSqqRX+6piI+0qi+XsjNQmkqyncqpmsqSoMCAPSI3FSUKxBz+fhjLk1F/vhj99RjVeU14mf144/pmoryM5ZVv7cBANQsf/wRjURRCvfuoY82AnNtKkLZTr7aUcRzY92yD2GmpiK2Ec/526llAAAnVRsQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgdi2jsQOYg/8PeBRKYpaH+ZYAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAhIAAAFICAYAAAAFwBezAAAeY0lEQVR4Xu3db2xc1ZnH8YkT549tUjcTO06M/0RRm6rQoqptKvGiSUWBRQKF7J8XZKWQSm0XKIXVim5fkCyB3Rfuiy2B3SZvSrv7qkjVhm1UKlEhNQF1BZW3CdpVFRFVFasqfzAkIcYJJYHZ+7PnOMcP47E9vnfunHu+H+nK4ztzZ855zjP3eTwztkslAM1QYctlAwCgECpoLsXcLgIAAKGydQ4ZU8ztIgAAECpb55AxxdwuAgAAobJ1DhlTzO0iAAAQKlvnkDHF3C4CAAChsnUOGVPM7SIAABAqW+eQMcXcLgIAAKGydQ4ZU8ztIgAAECpb55AxxdwuAgAAobJ1DhlTzO0iAAAQKlvnkDHF3C4CAAChsnUOGVPM7SIAABAqW+eQMcXcLgIAAKGydQ4ZU8ztIgAAECpb51rOrl27JrdGjY6OTm6tQjG3iwAAQKhsnUvF4OBgpaOjY7qAj4yMLKoZWCg9/uHDh+3ulqCY20UAACBUts6l4qabbqps3769snXr1sr4+PiMRkKX9bhqNHQbXa+vajpOnTo1eezBgwcnv4qO0+31VbfR/pMnT36kUdD96PF0W9dIuNuLvtf1uh89nh5ft9VxosfW97qNjsnqVQw9hr8AAACEzNa5VKgQ/+pXv5osyirgfiMxMDAw3TSo4NdqJHR5z549M97W0G11P2oyzpw585FGQrdzjYvmVa+R0H3psXS9ux+/0fFfTUmbxmYXAQCAUNk6lwr/J3oVaL+R8N/i0H7bSLiGQVT4tU9U8N2xOsY2Ev7bGa6Bma2RcPfv7ke3U4MjfjOTBcXcLgIAAKGydS4VfiHWVzUK820k/GP9y34zUquRcM2Df9lvJHT8bI2Ee1yxY0ibYm4XAQCAUNk6lwpbiPU49d7aUIFXcVdR999WsG9tuEahViPhGgX71obuzz3GbI2E8NYGAAALZ+tcKmwj4Qq4uA9bqjF48MEHJ/e5gq9XJtyrE+J/gNIVf7ffNhL+bXUf7nrXGDz66KN1Gwn3YUuNyY4/TXqMGSsAAEDAbJ3LnB7Tbf7bHHnym5AsX42Q6twBACgEW+eQMcXcLgIAAKGydQ4ZU8ztIgAAECpb55AxxdwuAgAAobJ1DhlTzO0iAAAQKlvnkDHF3C4CAAChsnUOGVPM7SIAABAqW+eQMcXcLgIAAKGydQ4ZU8ztIgAAECpb55AxxdwuAgAAobJ1DhlTzO0iAAAQKlvnkDHF3C4CAAChsnUOGVPM7SIAABAqW+eQMcXcLgIAAKGydQ4ZU8ztIgAAECpb55AxxdwuAgAAoXKFja25GwAAmEPIBfMPdgcAAGiuUBsJ96rBmL0CAAA0T4iNxL5kGy9NjV1fAQBATkJsJPgsAwAALSLEQnw52c4n209LU29t8PYGAAA5Ca2R2FfdnOFkO51sP/b2AQCAJgmxkXB2Vb8OJ9vua7sBAECzhNZI+EIeOwAAhRByMb7f7gAAAM0VciMBAAByRiMBAAAaFnIjEfLYAQAohJCLcchjBwCgEEIuxnzYEgCAnIXcSAAAgJyF3EgcsDsAAEBzhdxIhDx2AAAKIeRiHPLYAQAoBIoxAABoGI0EAABoWMiNBB+2BAAgZyE3EiGPHQCAQgi5GPMHqQAAyFnIjQQAAMgZjQQAAGhYyI1EyGMHAKAQQi7GIY8dAIBCCLkY82FLAAByFnIjAQAAchZyI8EfpAIAIGchNxIhjx0AgEIIuRiHPHYAAAqBYgwAABpGIwEAAOZWWQB7bN7s+OqxxwIAgBTYgluPPTZvdnz12GMBAEAKVGR37do1XXA7Ojoqhw8f9gtwZevWrZXx8fGWK8Yatxv76OjojLH7+1tx7AAAFIJfdGVkZGT6exVlfR9CI+GPXWNVA+GzxwIAgBSoyPrFWM2DaxwkpEbCjf3MmTOV7du3T76aok3ssQAAIAUqsrV+qve/D6WR8F+RcG9x6JUJbfZYAACQAhVbvxjbz0iE0kjM9hkJfX/q1KmWGzsAAIWgYqsvbvObCGn1RqI0y9g1Zu1TcyEzjwQAAKmYrrzzYI/Nmx1fPfZYAACQAltw67HH5s2Orx57LAAAyE7IhTfksQMAUAghF+OQxw4AQCFQjAEAQMNoJAAAQMNCbiQO2B0AAKC5Qm4kQh47AACFEHIxvt/uAAAAzRVyIwEAAHJGIwEAABoWciMR8tgBACiEkItxyGMHAKAQQi7GfNgSAICchdxIAACAnIXcSPAHqQAAyFnIjUTIYwcAoBBCLsYhjx0AgEIIuRjzYUsAAHIWciMBAAByFnIjwYctAQDIWciNRMhjBwCgEEIuxnxGAgCAnIXcSAAAgJzRSAAAgIaF3EjwYUsAAHIWciMR8tgBACiEkIsxH7YEACBnITcSAAAgB7u9y34jsc+7HAI+IwEAQA52J9vp6mU1EsOlqSZC+0PCqykAAORgONnGku18aaoYuy00IY4ZAIBCeKQ0s4m4PPPqIPBhSwAAcuRekVATsXvmVQAAAPXp7Y1Q39YQPmwJAECO3Nsbu81+Z22yfTrZvpxs30i2v7/uuuu+39PT8/NkeynZjpXL5ddXr179Zmdn5/mVK1e+u2zZsittbW0fLFmy5MNStUnRZe3TdbqNbqtjdKzuo7e392XdZ3Lf/6zHqD6WHlOPrTHMJtQGCACAIPUk29fXrl17oK+v72h7e/v73d3dEzfccMO5u+666/zTTz9dOXToUOXVV1+tXLlypdIqNBaNSWPTGO+8885zGnPSeFzSHDQXzUlzq84RAAAs0opk27Jhw4Z/W7du3fHOzs6LXV1dl3bu3Hl+ZGTkynPPPVeZmJiwNTs4moPmojlpbpqj5qo5a+6KQTUWAACgjrZk+9KKFSseWrNmzRtLly69unnz5nNPPfXUhy+++GLl9OnTtgYXluaqOe/fv/9DxUCxUEwUG8WoGisAAKK3Ltl2JD99/06fQUiK5tu7d+8+f/z4cVtbo6eYKDaKkWKlmCl21RgCAFBs/f39B3t6en7f2dl56dZbbx177bXXbK1EgxRLxVSxVYwVaxt/AACCs3Llym9cf/31R5YvX/7evn37Jl555RVbA5Eyxfixxx6bUMwV+46ODv0GCQAAwdjU19f3D+vXr//fHTt2jD377LOVCxcu2HqHjCnmir3WQGuRrMlerY1dLAAAclUul7/V399/vLu7+90jR47YeoYWozXSWmnNtHZ2PQEAaJavDg0N/eLuu+9+8/nnn7f1Ci1Oa6a10xpqLe3iAgCQiYGBgX9MfpL944033jh24MCB92yBQlgOHjz4ntZSa6q1tesNAEBatgwPD//s3nvvfWt0dNTWIwROa5qs7ZjWWGttFx8AgAXr7e29L9n+oD/tjLhozbX2ygGbFwAA1DUwMPB35XL59C233HL26NGjtsYgElp75YByQTlh8wQAgI/YsGHDA7fffvtZ/ZMpQJQLyom+vr4HbL4AACBf+OxnPzv2wgsv2BoCzKAcUa4oZ2wSAQDic90nPvGJn6xdu/aiLRhAPcoZ5Y5yyCYVACAC119//YNdXV0XH3744bGrV6/aOgHUpZxR7iiHlEs2vwAAxbZpy5YtZ48dO2brA7AgyiHlknLKJhkAoGA2btz48s0333zm5MmTth4Ai6KcSnLrrHLM5h0AoADWrFnzF48//vh5WwCAND3xxBPnlGs2/wAAAdu8efMP+vv7aSLQFMo15ZzNQwBAYHp7e9945JFHxuyJHmgG5Z5y0OYlACAAy5Ytu/WZZ565ZE/uQDP96Ec/upTkIv9dFABCMjAwsHvVqlWX7UkdyINyUTlp8xQA0II2btz47TVr1lzkP3SiVSgXlZNDQ0P8vQkAaGXJT333nThxwp7HgZag3BwcHPwbm7dA6CpsuWxImX7lbvXq1RP25A20EuVoT0/PX9r8RSrseZatOVvJ5jky5gKPVH1x+fLlf3rppZdsuIGWohxVripnbRJj0Wy4kTHFnMDnwAUe6RgcHPzNnj17ztk4A61s796955S7Np+xKDbMyJhiTuBz4AKPdNxxxx1nbIyBECh3bT5jUWyIkTHFnMDnwAU+b3Zcc7HHt4jb3nnnHTtUIAjKXeWwTepWYMc6F3t8TuywkDHFnMDnwAU+b3Zcc7HHt4Al5XL5lB0nEBLlsHLZJnfe7DjnYo/PiR0WMqaYE/gcuMDnTWPZtWvX9Lj0u+6HDx+unDp1qnLTTTdN7hsZGdGvq03us8fn7HNdXV0TvBqB0CmHlcvKaZvkedLYdH5w5widHzo6OibPEdq2bt1aGR8fn56HPT4n0+NBcyjmBD4HLvB501j8RqLW9zp5qKlotUYiaW5+/dRTT/GrniiEJJcvKadtnudJ4/IbCdEPFvreffXZ43MyY0zInmJO4HPgAp83jcWeDOxPGf4Jwx6fp6GhIX5LA4WinLZ5nieNyTYS7pUIbbqJNr1KIfb4nEyPFc2hmBP4HLjA501jsY2E/729zh6foy0zBgYUhHLbJnteNB7bSNR6JUKvWmqzx+dkxtiQPcWcwOfABT5vGot/UnCfkRCdMCx7fF6Sn9z+w44NKALlts33vGg8fiPhf0Zi+/btk9+LzhV6FdMen5NrwURTKOYEPgcu8HnzxjK9iTthuH0t9mHL5e3t7e/PCChQEMpt5bhN+jxoPGoidNFt7gcN/xzBWxtxU8wJfA5c4PNmxzUXe3xO7vnKV74yZscGFMG2bdvGlOM26fNgxzYXe3xO7LCQMcWcwOfABT5vdlxzscfnYeXKlRN6dQTZsR+4bTb7HnxMlNvKcZv3ebBjm4s9Pid2WIXjXiFuFYp5FIFvNS7wWLDPDw8Pn7fxRHp0gsr7JOW//x4j5bhy3SY/5sWGs1DU4Lfac0MxL3Tg9X6e5ufe12sVLvBYsPt27twZZSPh3pOu9SHYNLk/NpQn9+uFeb4qkifluHLdJj/mxYazUHQeyPocsFCKea6B108+epnG0YlDJ5CF8P9gkk/35fa12gnJBR41bUu2fWbfpN7e3v/+5S9/acNZKPbX7SStXNZzK+0mwZ3U3N8XWAjNs9VOiq1AOa5ct/mPadvsDo8NZ9OpprnnmatpaTzv3HnAPx+o/tna12yKea6Bn62RcJ8GticZXe9/ilhcI/Hggw9OHuf/SpK7nfa7+3700Udr3nczucCjpuFk0wfOtM3wsY997PSJEydsOAulViPhXllzm9unfNb3td4zdb+i51/v8t9/ZcM9f9wxur1up+eL39jreN3Of1nVPcf0tdZ4/BOovq91rDvef0y33x2rx3X3ncYJudUpx5Xrk0mPWoZLU+eHJ81+seFsulqNhH3eOe55o9u5v9Ghy/7zxj4/temyq5+1nv/NVB1TfoGfrZFwJ52BgQHv1teud4HWbfyXfLUI7no/uG5xdJ32u/vO670mF3jManeyXSmZk8WKFSsunTtX7D9oWauR8HPV/c6+O6lIrWN0vTtpueuV/+754Zpu10j4zwndxn/OSK1GQvxXJDQed4x7vNkaCfFfkXDjcvPQcW6M/gnY3a7IlOPKdZf3qEnnB70FZH/gsOFsulqNhKtHteqOcts107pNrUbCf376jbe+z7OJEMU818DP1kg49uSo690JxZ2Y/AD73Z3PnXx1nX9ytd1hs7jAY1bDpamThOI0fbJoa2v74MqVKzachVKrKfApx92Jxj13XDPgn1DcTyz+9X7+u5OTu84/Obnn0ZkzZ6afj/NpJNx4/KZ+IY3EyZMnp+/DPV91vH/ydWMsMuW4ct17PuCj3PlBm/8Dhw1n09VqJOrVHd1Grx76x9hGwufXORqJSv1GwjYVbp89MfknUT/A/gnHNhJ2cZvNBR512RNFtI2E/+parUbCXZ6tkXDXK+fd86dWI2Ef138O+g27z28k3G1rNRLusXy1Ggl70hS/SfKf10VFIzEv9vywr7rfhrPp6jUSteqOctvf79c597zzn+M0EsZsjYQLUK23NhbaSLjHcPu0zXZSbBYXeMxqd7JdLs08QUT71oY7gfh5rVwvVZ+7tY7R9e654q7XsbM1Ev5zwt3Wf0VCJzn/M0jOXI2EG5f22WNtI6F5udvrtu7PMcfWSPDWxrzo/DD9Q4bHhrPpajUSLm9r1R3lvG7vfu3Zfx64553fSPj3RyNRmb2RcB+2dIvhXz/fRkL3q/vQ14MHD06fFLVAte67mVzgMata731G82HL0rWftKYLsi7reaFcdrmuvNd+l/O+Wtfr62yNhDtGt/df3dD12qcPM9d6a0PX6WRXq5FwzYA73h6r27nj3Ri1ubm7JiO2RoIPW87LjB8yPDacTVerkXAftrR1xz1XxK9l/vNG+9z9aJ/OAe52robm2UxoTC0R+GawJ9I8ucCjpm2l2icI/frnb4v+65/z5RfuWnR90QtuUVV//fO3Nv8xbZvd4bHhRMYUcwKfAxd4LExbW9v999xzT7Hf20D0du7cea69vf0Bm/+YFxtOZEwxJ/A5cIHHgvEnslF4/InsRbHhRMYUcwKfAxd4LBz/tAtFptxulX/aFSgbUmRMMSfwOXCBx8ItXbr0r/Wvlm1MgSJQbic5vtPmPebNhhQZU8wJfA5c4NGQ5e3t7e/bmAJFoNxWjtukx7zZkCJjijmBz4ELPBozNDR0yMYUKILh4eFDNt+xIDakyJhiTuBz4AKPhm2xMQWKQLltkx0LYkOKjCnmBD4HLvBo3NDQEL8GikJRTts8x4LZsCJjijmBz4ELPBo3ODj46/37979rYwuESLmc5PR/2TzHgtnQImOKOYHPgQs8FuVzXV1dE++8844NLxAU5bByWTltkxwLZsOLjCnmBD4HLvBYtCXlcpk/KoGgKYeVyza50RAbXmRMMSfwOXCBx+ItW7bsdl6VQKiUuytWrPgzm9domA0xMqaYE/gcuMAjHXfcccdZG2MgBEnunrH5jEWxIUbGFHMCnwMXeKRjcHDwN3v27HnbxhloZXv37n1buWvzGYtiw4yMKeYEPgcu8EjVF5cvX/6nl156yYYbaCnKUeWqctYmMRbNhhsZU8wnA8+Wy4aUdXd371i9evWETXSglShHy+Xyn9v8RSrseZatORtQHMPDw/efOHHCnruBlqDcTHL0Ppu3AIAWsmnTpofWrFlzcXR01J7HgVwoF5WTSRPxkM1XAEAL6uvr27Vq1arL9oQO5EG5qJy0eQoAaGGdnZ23PfPMM/wZbeTqhz/84cSKFStutfkJAAhAb2/vG9/5znfesid3oBmUe8pBm5cAgMB88pOf/EF/f/95e6IHsqBcS3LuX20eAgAC1tPT81ePP/44/34cmVKOKdds/gEACmDjxo0v33zzzWdPnjxpz//AoiinlFvKMZt3AIDi2bRly5azx44ds/UAWBDlkHJJOWWTDABQYIODg9/u6uq6+NBDD41dvXrV1gegLuWMckc5pFyy+QUAiMN1mzZt+snatWsv2kIB1KOcUe4oh2xSAQDi84XPfOYzb77wwgu2XgAzKEeUK8oZm0QAAJQ2bNjwrdtvv/3Mq6++amsIIqVcUE4oN2y+AADwEevXr//bcrl8+pZbbjl79OhRW1cQCa29ckC5oJyweQIAQF19fX339/b2/uHQoUO2xqDgtOZae+WAzQsAABqxZePGjT+79957x/jPosWjNdXaao211nbxAQBIRX9//xPlcvmPN95449jBgwf/ZAsSwqI11FpqTQcGBp6w6w0AQFa+OjQ09Iu77777zeeff97WJ7Q4rZnWTmuotbSLCwBAU3z84x//1oYNG453d3e/e+TIEVuv0GK0RlorrVmydg/Y9QQAIG+bent79/b19f3Pjh073nr22WcrFy5csPUMGVPMFftkDca0FloTrY1dLAAAWlZHR8c3BwYGjixfvvy9xx577N1XXnnF1jukTDFWrBVzxb6rq+ubdl0AAAhOf3//wZ6ent93dnZeuu2229567bXXbA1EgxRLxVSxVYwVaxt/AACKaF2y7Vi3bt3v2traPti8efPbX/va1y4cP37c1sroKSaKzac+9alzipVipthVYwgAQPTaku1Lq1aterhcLr+xdOnSq0ljcW7//v0fvPjii5XTp0/b2lpYmqvm/OSTT6q5OqdYKCaKjWJUjRUAAKhjRbJtSYrnseSn72OdnZ0Xu7q6Lu3cufPC9773vavPPfdcZWJiwtbg4GgOmovmpLlpjpqr5tzW1jauGFRjAQAAGlBJtm3Vyz3J9vW1a9ceWL9+/dH29vb3u7u7J2644YZzd95557mnn3568k87659MXblyxdbs3GgsGpPGpjFqrBqzxq45aC69vb36XMPXq3N0NHcAANCgbaWpYqqfzHV5odYm26eT7cvJ9o3kJ/zvrl69+snkp/2f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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,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M/MuAICZdg3VfbTByZEA0GdRNNyTF07Z3Gkf6bQ/7LS/6LT/uH79+oc3bdr0X7ds2fJCp/2sc/1fNmzY8Pq6devevOqqq85eeeWV76xatep3l1122e+HpoqSuB7L4r54TDw21ol14zlGR0d/Es/Zee6H4jWmXiteM147+jCbWgseAKjClk77xObNmx/dtm3b8yMjI69u3Ljx3I033njqM5/5zJtf+cpXzj/11FMTL7300sSrr746MSiiL9Gn6Fv08c477zwVfe4UGudjG2JbYpti26a2EQBYoNWd9vFO+/OtW7f+c+dT/lvDw8Pnb7755l8dOHDgt08//fTE0aNH8xxdndiG2JbYpti22MbY1tjm2PapGEQsAIDkD1avXv2lD37wg393+eWXX7jhhhtO3X333W8+++yzEydOnMhz7rIV2xrbHNseMYhYREwiNhGjHDQAWM5GO+3PduzY8bfx6fr2229/48EHH/zXF154Ic+fzCJiFTGL2EUMr7nmmh9FTKdiCwDLwh91JriD69atO/+pT33q5COPPPKbPCGyOBHLiGnENmIcsc7BB4AabNuxY8fh+DXCrbfe+sb+/fvP5UmPpXX//fefi1hHzCP2MQZ5UABgoGzbtu0/bd++/f/FYfQnn3xy4vTp03l+o8ci5hH7GIMYi86Y3JfHCQDasG7Tpk1/tXHjxrOf/exn3zh8+HCewxgQMTYxRjFWMWYxdnkwAaBX/njnzp1/f8UVV/zmrrvuej1PUgy2GLMYuxjDGMs8uACwVDaNjY3955tuuunko48++s7Zs2fznEQlYuwOHjz4ToxljGmMbR5sAFiwK6+88t/s2LHjZw899NDZ8+fP5/mHZSLG9jvf+c7ZGOsY85wHADCn0dHRn992222vx59LZmWIsY4xj7HP+QAAXY2Njf2HTZs2nXj++efzvMIKEWMfORC5kPMDAIauvvrqP929e/cvX3zxxTyHsMJFTkRuRI7kvAFg5bmt86nypzfffPPJPGFAU+TI+Pj4TyNnchIBsDKs37x581vf//73nfXIvESuRM5E7uRkAmAZ27FjxxeHh4ffunDhQp4b4JIiZyJ3IodyXgGwzKxevfqdhx566K08GcBiPPzww29FTuU8A6B+W6+99tqfHDt2LO/74X2JnIrcihzLSQdAhUZGRv5k/fr1v37ggQfezDt9WArf+MY3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>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,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>

[image10]: <data:image/png;base64,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kiVL3l68ePE78+bNu9DR0fH+7Nmzr8yaNevPpdRVDX2v9fq57qf7aztt39PT8ys9nh5Xj195Hj2fnlfPP5mpxg0AAHIylCzHkuWLSVH/XlLEX+zr6xu9+eabz6jgL1y4cOyjH/3omfXr15+9//77zz3++OPv79q1q7x79+7yyMhIef/+/eU33nijfPTo0fLp06fL586dK4+NjZWvXLlSTtP3Wq+f6366v7bT9nocPZ4e91vf+tbYli1bzun59Lx6fo1D49G4kkbjxaQB+Z7GW6J5AAAgd93J8slkeWjp0qW7Ojs7j82ZM+fykiVLLt57771nv/nNb1569tlny3v37i0fO3bshgagKBqHxqNxaXwa5z333HMmaSguafzaD+2P9quyf9pPAADQgLnJ8tDy5ctf7O3tPbRo0aJLa9eufXfz5s1nd+zYceX1118vX7x40dfqoGj82g/tj/ZL+6f91P5qv7X/lTgAAICK3qRI/lNSLA/r8v6aNWveff7558uHDh3ydTZqiofiovgoToqX4qb4+YACANCOelasWPFSZ2fn23qV/fTTT/9x37595cuXL/uaiSoUJ8VLcVP8FMf+/v49iqsPNAAAIftMUuCe6+7uPrpw4cJLO3fuvPzaa6/5uogGKI6Kp+Kq+CrOirefAAAAWtnqvr6+v9Wr4k2bNp16+eWXfb1DEyjuir/mIZmPH2he/EQBAFCopED9MFl+s3Tp0nMPPvjgu76YoTiaD81LMj9vap783AEA0EwLu7q6vtrf33/oS1/60unR0VFft9BCND+aJ82X5k3z5ycUAIAZNzAw8HdJ4fn97bfffurChQu+PiEgmj/No+ZT8+rnGgCArNYNDQ394oEHHjh94MABX4cQMM1nMq+nNL+aZz/xAADUpaOjY9OKFSsODg4OnnnmmWe41NDGfvzjH1/QPGu+Ne8+FwAAqKmnp+crH//4x9/Rn1ZGPDTfmnfNv88JAABusHz58kc2bNhw8tVXX/U1BRFSHigf+vr6HvG5AgCI3C233PKF3t7e3w4PD5/0BQRQXig/lCc+dwAAERoYGNi/du3aU6+88oqvGcAE5YfyZHBwcL/PIQBABFasWPHookWLzn39618/5YsEUIvyRvmjPPK5BQBoT6vXrVt38uDBg74mANOm/FEeKZ98ggEA2shtt932vblz577vCwHQKOWT8srn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>

[image11]: <data:image/png;base64,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>

[image12]: <data:image/png;base64,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>

[image13]: <data:image/png;base64,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>

[image14]: <data:image/png;base64,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>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,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>

[image17]: <data:image/png;base64,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>

[image18]: <data:image/png;base64,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>

[image19]: <data:image/png;base64,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>