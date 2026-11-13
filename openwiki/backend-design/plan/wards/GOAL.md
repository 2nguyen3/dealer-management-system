# GOAL — Phường/xã TP.HCM 2025, UI polish và tài liệu nghiệp vụ dòng tiền (2026-11-13)

Branch: `deploy-prod`. Production DB: Neon Singapore, schema `dms`, head `0009`.

## Quyết định đã chốt với người dùng

| # | Quyết định |
|---|---|
| D1 | Bỏ hoàn toàn cấp quận/huyện. Đơn vị hành chính duy nhất là **phường/xã/đặc khu của TP.HCM mới** (sau sáp nhập 01/7/2025, Nghị quyết 1685/NQ-UBTVQH15): 168 đơn vị = 113 phường + 54 xã + 1 đặc khu. Không nạp các tỉnh khác. |
| D2 | Danh mục phường/xã là **dữ liệu tham chiếu chỉ đọc**, nạp bởi migration; không có màn/endpoint tạo-sửa-xóa. Quyền `district.manage` bị gỡ bỏ. |
| D3 | Quy định "tối đa N đại lý mỗi quận" chuyển thành **"tối đa N đại lý mỗi phường/xã"** (giữ nguyên cơ chế khóa/kiểm tra đồng thời, mặc định 4). |
| D4 | Dữ liệu cũ: mỗi quận cũ ánh xạ sang 1 phường đại diện (bảng `legacyDistrictToWard` trong [hcmc_wards_2025.json](../../../database-design/hcmc_wards_2025.json)); 20 quận → 20 phường khác nhau nên số đại lý/phường không tăng. Địa chỉ dạng `..., <Quận cũ>, TP.HCM` được thay tên quận bằng tên phường. |
| D5 | Production: **backup schema `dms` trước**, kiểm tra migration trên DB/schema tạm, rồi mới `alembic upgrade head` trên production. |

Nguồn dữ liệu: `https://provinces.open-api.vn/api/v2/p/79?depth=2` (mã GSO), đối chiếu tổng số 168 (113/54/1) với các bài tổng hợp NQ 1685.

## Hợp đồng API mới (backend ↔ frontend)

Quy tắc đổi tên cơ học: mọi định danh `district/District/DISTRICT` → `ward/Ward/WARD`;
nhãn "Quận" → "Phường/xã".

- `GET /api/v1/wards` (`listWards`) — chỉ đọc; tham số `limit, cursor, q, code, kind, sort`.
  Item: `{id, code, name, kind: "WARD"|"COMMUNE"|"SPECIAL_ZONE", createdAt, updatedAt}`
  (không còn `status`). Envelope giống các danh mục khác.
- `GET /api/v1/wards/{wardId}` (`getWard`) — ETag.
- Quyền đọc: anyOf `agency.read`, `agency.manage`. Không có POST/PATCH/DELETE.
- Agency: `districtId` → `wardId`, `districtName` → `wardName`; bộ lọc `districtId` → `wardId`
  ở agencies/receivables/reports/dashboard; chiều nhóm báo cáo `district` → `ward`.
- Business rule: `maxAgenciesPerDistrict` → `maxAgenciesPerWard`.
- Lỗi: `DISTRICT_CAPACITY_EXCEEDED` → `WARD_CAPACITY_EXCEEDED` (các mã district khác tương tự).

## Workstreams

### W1 — Backend + DB (migration 0010)
- [x] `backend/alembic/sql/0010_hcmc_wards.sql` + `versions/0010_hcmc_wards.py`: tạo `ward`, nạp 168 dòng,
      thêm `agency."wardId"` theo ánh xạ D4, đổi địa chỉ, đổi cột rule, thay trigger `guard_agency`/`guard_rules`,
      tạo lại view `agency_overview`, gỡ `district.manage` + quyền nhóm, drop bảng `district`. Downgrade hợp lệ.
- [x] Module `districts` → `wards` (chỉ đọc); cập nhật agencies, business_rules, receivables, reports, dashboard,
      permissions, audit_logs, router, seed, verify (54 regression checks), ORM.
- [x] Test offline cập nhật và pass toàn bộ; ruff/format sạch; `openapi.json` cập nhật.
- [x] Migration kiểm tra trên DB/schema tạm: fresh (0001→0010 + seed + verify) và populated (seed ở 0009 → 0010).
- [x] Backup `dms` production → upgrade production → verify live (số chứng từ/đại lý không đổi).

### W2 — Frontend phường/xã
- [x] Bỏ trang/route/nav "Quản lý quận" (`features/districts`), giữ hook danh mục dùng cho phường/xã.
- [x] Agencies: chọn phường/xã (combobox tìm kiếm 168 mục), cột/bộ lọc phường/xã.
- [x] Business rules, dashboard slicers, reports, receivables, audit/permission labels theo hợp đồng mới.
- [x] `npm run lint`, typecheck, test, build pass.

### W3 — Frontend polish (sau W2)
- [x] Trang đăng nhập/quên/đặt lại mật khẩu dùng token màu chung; đúng ở cả light/dark và mọi palette.
- [x] Sidebar thu gọn: logo không bị ép/méo (giữ tỉ lệ, chuyển sang biểu tượng thu gọn).
- [x] Giảm chữ, tăng icon: nav, nút hành động, tiêu đề trang, trạng thái rỗng, thẻ thống kê.

### W4 — Tài liệu nghiệp vụ
- [x] `BC/06_Logic_nghiep_vu_dong_tien.md`: toàn bộ logic dòng tiền (thu, trả ngay, công nợ, dư có, bù trừ,
      hoàn tiền, VNPAY, sửa/hủy chứng từ, trả hàng, các trường hợp biên/lỗi).
- [x] `BC/07_Danh_sach_chuc_nang.md`: danh sách chức năng nghiệp vụ hiện có theo module/quyền.

## Hoàn thành khi
Tất cả ô trên được đánh dấu kèm bằng chứng trong [VERIFICATION.md](VERIFICATION.md); Docker rebuild healthy,
production ở head `0010`, giao diện không còn khái niệm quận.
