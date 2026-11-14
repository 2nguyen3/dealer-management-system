# Tài khoản đăng nhập

Tài khoản ứng dụng trong `dms.app_user` do seed v2 tạo (không phải tài khoản
PostgreSQL). Mật khẩu lưu dạng Argon2id. Bốn thành viên nhóm giữ bốn vai trò chính.

| Email | Mật khẩu | Họ tên | Nhóm | Trạng thái |
|---|---|---|---|---|
| `thaonguyen@agentra.vn` | `Agentra@2026#QuanLy1` | Nguyễn Trần Thảo Nguyên | Quản lý | ACTIVE |
| `minhtuan@agentra.vn` | `Agentra@2026#KinhDoanh1` | Nguyễn Hà Minh Tuấn | Kinh doanh | ACTIVE |
| `giaphuc@agentra.vn` | `Agentra@2026#Kho1` | Huỳnh Gia Phúc | Kho | ACTIVE |
| `thuyngan@agentra.vn` | `Agentra@2026#KeToan1` | Nguyễn Thúy Ngân | Kế toán | ACTIVE |
| `hoangnam@agentra.vn` | `Agentra@2026#KinhDoanh2` | Lê Hoàng Nam | Kinh doanh | ACTIVE |
| `myduyen@agentra.vn` | `Agentra@2026#KinhDoanh3` | Võ Thị Mỹ Duyên | Kinh doanh | ACTIVE |
| `thuha@agentra.vn` | `Agentra@2026#Kho2` | Phạm Thu Hà | Kho | ACTIVE |
| `quocbao@agentra.vn` | `Agentra@2026#Kho3` | Đặng Quốc Bảo | Kho | ACTIVE |
| `ngochan@agentra.vn` | `Agentra@2026#KeToan2` | Trần Ngọc Hân | Kế toán | ACTIVE |
| `thanhtung@agentra.vn` | `Agentra@2026#KeToan3` | Bùi Thanh Tùng | Kế toán | ACTIVE |
| `vanluc@agentra.vn` | `Agentra@2026#KinhDoanh4` | Phan Văn Lực | Kinh doanh | LOCKED (đăng nhập bị từ chối) |

Quyền mặc định: Quản lý có toàn bộ 22 chức năng (gồm hủy/sửa chứng từ); Kinh doanh
tiếp nhận đại lý và lập phiếu xuất; Kho quản lý mặt hàng/đơn vị, lập và ghi sổ phiếu
nhập, ghi sổ phiếu xuất; Kế toán lập/ghi sổ phiếu thu, VNPAY và xem báo cáo.

Nguồn: `backend/app/db/seed_data.py`. `uv run python -m app.db.verify --seeded` đối
chiếu các tài khoản và hash mật khẩu này.
