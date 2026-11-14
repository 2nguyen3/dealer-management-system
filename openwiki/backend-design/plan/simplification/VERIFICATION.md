# Đơn giản hóa 14/11/2026 — bằng chứng kiểm tra

Kế hoạch: [PLAN.md](PLAN.md). Mọi lệnh chạy ngày 14/11/2026 trên Windows 11, Python 3.12
(uv), Node.js 24. Test integration và seed thử chỉ chạy trên PostgreSQL 18 local
(container `agentra-test-pg`, 127.0.0.1:55440) hoặc database Neon tạm
`agentra_trial_20261114`; không test nào trỏ vào database production.

## 1. Backend

| Lệnh (từ `backend/`) | Kết quả |
|---|---|
| `uv run ruff check .` | All checks passed |
| `uv run ruff format --check .` | 290 files already formatted |
| `uv run pytest -q` (offline) | **559 passed**, 394 deselected |
| `BUSINESS_TEST_DATABASE_URL=… AUTH_TEST_DATABASE_URL=… uv run pytest -m integration -q tests/integration` | **373 passed** (9 phút 28 giây) |
| `uv run pytest -m deployment tests/deployment` (API local cổng 8001 trỏ DB local + Nginx tạm cổng 8081; chạy từng file cách 65 giây vì giới hạn đăng nhập 10 lần/phút) | **20 passed**; ca `VNPAY_SMOKE_PUBLIC_URL` cần URL https công khai → chạy ở mục 5 |
| `uv run alembic check` (DB local đã seed) | No new upgrade operations detected |
| Seed + verify trên DB local `agentra_seed` | `PASS: seed v2 committed and verified`; `PASS: 16 tables…seed v2 checks`; `PASS: 83 0011 PostgreSQL regression assertions/rejections` (1 phút 20 giây) |

Sửa trong đợt này (ngoài việc chỉnh test theo schema mới):

- **Race thật trong 0011** (tìm ra khi viết lại test PG đồng thời), đã sửa trong
  `0011_simplified_schema.sql` (chưa deploy nên còn sửa được):
  - `lock_line_policy()` khóa `FOR SHARE` đơn vị + mặt hàng rồi **đọc lại** đơn vị hiện
    tại của mặt hàng và `allowsFraction`; trước đó dòng nháp có thể lưu số lẻ hoặc đơn
    vị cũ khi chính sách đổi đồng thời.
  - `guard_document()` khóa `FOR SHARE` đại lý khi chứng từ có đại lý được tạo hoặc đổi
    ngày/đại lý; trước đó đổi ngày tiếp nhận đại lý và đổi ngày chứng từ đồng thời có
    thể cùng commit, vi phạm "ngày chứng từ ≥ ngày tiếp nhận".
  - `DocumentRepository.products(lock=True)` khóa thêm `FOR SHARE OF u` (đơn vị) khi ghi sổ/hủy.
- `DocumentService.CONFLICTS` ánh xạ thêm `ck_document_line_fraction` →
  `FRACTION_NOT_ALLOWED`, `ck_document_line_unit`/FK mặt hàng/FK đại lý →
  `MASTER_CONFLICT` (trước đó thành 500 `INTERNAL_ERROR`).
- `SortSpec.after` (`app/common/pagination.py`) phân trang được khi trường sắp xếp
  là NULL (mặt hàng chưa có giá bán); trước đó trang 2 khi sắp theo `sellingPrice`
  trả 400 `INVALID_CURSOR`. Thêm test offline cho thứ tự NULL của PostgreSQL.
- `app/db/seed.py` từ chối chạy khi DB chưa ở head `0011` (`require_head`).
- `scripts/gen_openapi.py` (chép từ `tmp/simplify-scripts/`): sinh hợp đồng từ runtime,
  giữ thành phần dùng chung (Error, 18 response lỗi, 37 parameter, 6 header), bỏ
  schema/parameter/response của chức năng đã bỏ; hợp đồng: 90 operation, 124 schema,
  không còn `$ref` treo.
- Test thay thế: `tests/integration/auth/test_seed_compatibility.py` (seed trên DB tạm,
  chạy lại chỉ verify, fingerprint không đổi, 83 regression), `test_migrations.py`
  (DB 0010 có dữ liệu → 0011 sạch, downgrade bị chặn). Các test lịch sử 0005/0006/0010
  dựa trên service cũ được thay bằng kiểm tra SQL tương đương trên 0011.

## 2. Frontend

| Lệnh (từ `ui/`) | Kết quả |
|---|---|
| `npm run lint` | exit 0, 0 warning |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | All matched files use Prettier code style |
| `npm run test` | **56 files, 814 tests passed** (gồm `i18n_catalogs`: 23 locale đủ 1.561 thông điệp, giữ placeholder, không khóa thừa) |
| `npm run build` | built in 13,89 s |
| `E2E_BASE_URL=http://127.0.0.1:8081 node src/test/e2e_browser_smoke.cjs` (bản build qua Nginx tạm → API 8001 → DB local) | ALL E2E SMOKE CHECKS PASSED (đăng nhập `thaonguyen@agentra.vn`, sửa hồ sơ DL-1 "NPP Phú Lộc", trang trợ lý báo chưa khả dụng) |

- i18n: 1.088 khóa không còn dùng bị xóa khỏi mỗi catalogue (2.290 → 1.202), 359 chuỗi mới
  dịch cho 23 ngôn ngữ theo `openwiki/frontend-design/plan/i18n/GLOSSARY.md`; ngưỡng test
  trích xuất hạ từ >2000 xuống >1500 vì các trang bị bỏ mang theo chuỗi của chúng.
- Portal: deck cũ trong localStorage chứa `/receivables`, `/inventory`, `/refunds`… được
  lọc; deck chỉ còn route đã bỏ thì dùng mặc định theo vai trò (test `portal_favorites`).
- Đổi ngôn ngữ: `index.html` có màn chờ dựng sẵn (theo bảng màu/sáng-tối đã lưu), và
  `reloadWithSplash` phủ màn chờ trước khi tải lại. Đo trên Chrome thật khi đổi sang
  English: 122 mẫu liên tiếp, 0 khung hình trắng; test `i18n_runtime` 22/22.

## 3. Quét chức năng đã bỏ (8.2)

`grep -rniE "upfront|refund|credit_lot|stock_count|sales_return|adjustment|receivable"`:

- `backend/app`: chỉ còn docstring `online_payments/vnpay.py` ("refunds were removed…")
  — có lý do. Hàm seed `receivable()` đã đổi tên thành `can_restock()`.
- `ui/src` (không tính test): 0 kết quả.
- `ui/src/test`: chỉ còn trong test phủ định có chủ đích (route/mã lỗi/kind cũ phải bị
  từ chối, deck Portal cũ phải được lọc, GUIDE không còn trang đã bỏ, hợp đồng báo cáo
  từ chối field cũ). `live_docker_integration.test.ts` (không chạy mặc định) đã đổi sang
  tài khoản seed v2 và endpoint hiện tại.

### Sửa sau kiểm tra theo vai trò (14/11/2026, sau deploy lần 1)

Kiểm tra UI theo vai trò trên production phát hiện `GET /units?limit=100` trả **403** cho
Kinh doanh và Kế toán ở trang Mặt hàng (bộ lọc/cột đơn vị tính). Nguyên nhân: đợt đơn
giản hóa mở rộng quyền đọc mặt hàng (thêm `stock.issue.*`, `sales.read`, `reports.read`)
nhưng quyền đọc đơn vị tính vẫn là `unit.manage | product.manage | stock.receipt.prepare`
(trước 0011 hai tập này giống nhau qua `inventory.read`). Sửa: `units/router.py` đọc =
`unit.manage` + toàn bộ tập đọc mặt hàng; hợp đồng `openapi.json` và
`tmp/simple-api.openapi.yaml` sinh lại; test mới `tests/catalogues/test_read_permissions.py`
(3 ca: tập đọc mặt hàng ⊆ tập đọc đơn vị, vai trò mặc định đọc được mặt hàng thì đọc được
đơn vị, hợp đồng công bố đúng tập) — **đỏ với tập cũ (3 failed), xanh với tập mới (3 passed)**.

| Lệnh sau khi sửa | Kết quả |
|---|---|
| `uv run ruff check .` / `ruff format --check .` | All checks passed / 291 files already formatted |
| `uv run pytest -q` (offline) | **562 passed**, 394 deselected |
| `uv run pytest -m integration tests/integration/catalogues tests/integration/master_data tests/integration/permissions` | **151 passed** (2 phút 19 giây) |
| `npm run lint` / `typecheck` / `format:check` / `test` / `build` (từ `ui/`) | 0 warning / exit 0 / sạch / **56 files, 814 tests passed** / built in 12,92 s |

## 4. Thử trên Neon tạm

Database `agentra_trial_20261114` tạo riêng trên cùng server Neon (PG 18.7), không phải
database production. `alembic upgrade head` (6 giây) thành công.

**Lệch cách nạp:** seed v2 chạy trực tiếp qua mạng tới Neon Singapore chậm (mỗi lệnh một
lượt đi-về; sau ~40 phút mới khoảng giữa, ước ~70 phút). Người dùng chọn cách nhanh: seed
trên PostgreSQL 18 local rồi chép nguyên schema `dms` lên Neon. Lần seed qua mạng bị dừng,
transaction tự rollback (kiểm tra: 0 chứng từ, 0 phiên còn lại).

Cách nạp (script `restore_dms.py`, chạy một transaction duy nhất `psql --single-transaction
-v ON_ERROR_STOP=1`, thất bại thì không đổi gì — đã thấy thật ở lần chạy đầu khi
`pg_restore` thiếu `--no-owner` báo lỗi role và rollback nguyên vẹn):

1. DB local mới `agentra_seed_v2`: `alembic upgrade head` → `python -m app.db.seed` →
   `verify --seeded --regression` (PASS, 83 regression) → `alembic check` (sạch). 54 giây.
2. `pg_dump -n dms -Fc --no-owner --no-privileges` (390.519 byte).
3. Trên đích: kiểm tra `alembic_version = 0011` → `DROP SCHEMA dms CASCADE` → script
   `pg_restore --no-owner --no-privileges` (trigger, khóa ngoại, constraint trigger được tạo
   sau khi nạp dữ liệu nên không tắt trigger nào) → tạo lại 2 index `pg_trgm` y như 0011
   (dùng schema extension hiện có, nếu chưa có thì tạo trong `dms`) → chạy lại 2 lệnh
   `REVOKE ... FROM PUBLIC` của 0011.

| Lệnh trên DB tạm | Kết quả |
|---|---|
| `restore_dms.py agentra_seed_v2 trial` | psql exit 0 (8 giây) |
| `verify --seeded --regression` | `PASS: 16 tables…seed v2 checks`; `PASS: 83 0011 PostgreSQL regression assertions/rejections` |
| `alembic check` | No new upgrade operations detected |
| `python -m app.db.seed` (chạy lại) | chỉ verify, không đổi dữ liệu |
| API local cổng 8002 trỏ DB tạm + `flow82.py` (luồng 8.2 theo vai trò qua HTTP) | **44/44 checks passed** |
| Bản build UI qua Nginx tạm → API 8002 → `e2e_browser_smoke.cjs` | ALL E2E SMOKE CHECKS PASSED |

DB tạm đã xóa sau khi xong (`DROP DATABASE agentra_trial_20261114 WITH (FORCE)`).

## 5. Production

**Trạng thái trước (chỉ đọc):** alembic `0010`, 30 bảng `dms`, 418 chứng từ, 32 đại lý,
25 mặt hàng, 8 tài khoản, 3.876 nhật ký, 28 giao dịch VNPAY.

**Backup** (trước mọi thay đổi): `pg_dump -Fc --no-owner --no-privileges` toàn database qua
host trực tiếp →
`D:\WorkSpace\backups\agentra-dms\backup-pre-simplify-2026-11-14.dump` (ngoài repo),
638.253 byte, sha256 `a9b18a1c4d6600d146d285579d15c6f2189bba9994160c6ba6531ab9c58ba4ed`;
`pg_restore --list` 525 mục, 30 bảng dữ liệu `dms`, có `alembic_version`. **Đã khôi phục
thử** vào DB local: `0010 | 418 | 32 | 25 | 8 | 3876 | 28` — khớp đúng trạng thái trước.
(Lưu ý khi khôi phục ngoài Neon: bỏ các dòng `ALTER COLUMN … SET (pg_attver=…)` là tùy chọn
riêng của Neon; khôi phục lại lên Neon thì giữ nguyên.)

| Bước (14/11/2026, UTC) | Kết quả |
|---|---|
| Dừng stack Docker cũ (trỏ production) | dms-backend-1/dms-frontend-1 Stopped |
| 08:18:42 `alembic upgrade head` (host trực tiếp) | 0010 → 0011, 4 giây |
| `restore_dms.py agentra_seed_v2 production --i-have-a-backup` | psql exit 0, 32,9 giây; xong 08:19:22 (dump sha256 `ac3d7785…87cbf`, cùng DB local đã seed và verify) |
| `alembic current` | `0011 (head)` |
| `verify --seeded --regression` | PASS seed v2 checks + **83** regression |
| `alembic check` | No new upgrade operations detected |
| `python -m app.db.seed` (chạy lại) | `Seed v2 already present; verification only.` |
| `docker compose build` → `--profile tools run --rm migrate` → `up -d --wait` | Built; migrate `0011 (head)`; backend/frontend healthy; 8000 và 8080 readiness 200 |
| `npx --yes vercel@65.12.1 deploy --prod --yes` | Ready, alias https://agentra-dms.vercel.app; health 200 |

Số liệu production sau nạp: 11 tài khoản, 34 đại lý, 30 mặt hàng, 468 chứng từ, 1.270 dòng,
19 giao dịch VNPAY, 4.020 nhật ký, 168 phường/xã, 22 mã chức năng (đúng như README).

**Kiểm tra sau deploy — CÓ GHI dữ liệu thật vào production:**

| Kiểm tra trên https://agentra-dms.vercel.app | Kết quả |
|---|---|
| `flow82.py … "Tạp hóa Ngọc Hân" --cleanup` (4 vai trò qua HTTP, IPN VNPAY ký đúng) | **45/45 checks passed** |
| `VNPAY_SMOKE_{DIRECT,PROXY,PUBLIC}_URL` = 8000 / 8080 / Vercel, `test_08_vnpay_smoke.py` | **3 passed** (ca công khai còn treo ở mục 1 nay đã chạy) |
| `e2e_browser_smoke.cjs` | ALL E2E SMOKE CHECKS PASSED |
| `roles_ui.cjs` (đăng nhập 4 vai trò, mở mọi mục menu: 18/11/11/12) | lần 1: 403 `/units` ở Kinh doanh/Kế toán → sửa (mục 1) + build/deploy lại → **ALL ROLES OK** (không API ≥ 400, không thông báo lỗi, không lỗi console) |

Dữ liệu do kiểm tra sau deploy ghi (08:26–08:45 UTC):

- Đại lý **DL-35 "Tạp hóa Ngọc Hân"** (Kinh doanh tiếp nhận; địa chỉ sau đó sửa qua API
  thành "41 Lê Văn Sỹ, Phường Thủ Dầu Một, TP.HCM" để có tên phường như dữ liệu thật);
  nợ hiện tại 226.640 đ.
- PN-469 nhập 20.300.000 đ — **đã hủy** ("Nhập trùng số lượng, hủy phiếu").
- PX-472 354.960 đ — **đã hủy khi sửa** ("Đại lý trả bớt 1 sản phẩm khi nhận hàng"),
  thay bằng **PX-476** 236.640 đ (POSTED).
- PT-474 118.320 đ tiền mặt — **đã hủy** ("Thu nhầm đại lý, hoàn lại phiếu").
- PT-475 10.000 đ ONLINE — VNPAY SUCCESS (IPN mô phỏng có chữ ký đúng; không có tiền thật).
- Nháp PT-473 (phiếu thu vượt nợ để kiểm QĐ) — **đã xóa** qua API. Các số PX-470/PT-471 là
  nháp bị xóa trong luồng nên không còn.
- Hồ sơ DL-1 được lưu lại không đổi (smoke trình duyệt) → chỉ `updatedAt` + 1 dòng nhật ký.

Sau các ghi trên: kiểm tra toàn vẹn (`check_database`: 16 bảng, nợ/tồn/giá/tổng, thay thế,
VNPAY, sức chứa phường) **PASS**; tài khoản, replay, khóa sổ báo cáo, giờ làm việc, liên hệ
**PASS**; **quét từ cấm: 0 kết quả**. `verify --seeded` đầy đủ nay báo
`1-2 cancelled STOCK_RECEIPT, got 3` — đúng do PN-469 của kiểm tra sau deploy; đây là kiểm
tra "hình dạng seed", không phải lỗi toàn vẹn.

## 6. Lệch so với đặc tả gốc

| Mục | Lệch | Lý do |
|---|---|---|
| Chấm dứt đại lý | Thêm guard `AGENCY_HAS_DEBT` (409) khi còn nợ | Tránh mất dấu công nợ của đại lý không còn hoạt động |
| Quét từ cấm (6.1) | Bỏ "mau"/"thu" không dấu khỏi danh sách | Trùng "màu" và tên người "Thu" |
| Địa chỉ | Cặp đường–phường chọn theo hiểu biết địa lý, không tra cứu bản đồ | Không có nguồn dữ liệu đường phố chính thức trong repo |
| Backup | `pg_dump` / database riêng thay cho Neon branch API | Không có Neon API key/neonctl |
| Idempotency | Bỏ bảng `api_idempotency`/header `Idempotency-Key` cho chứng từ; VNPAY vẫn chống trùng theo TxnRef | Theo danh sách bỏ 5.1 |
| Seed | Đại lý DL-1 là "NPP Phú Lộc" (không phải "Tạp hóa Hồng Phúc" như ghi chú cũ) | Thứ tự tiếp nhận theo lịch mô phỏng |
| Test lịch sử | Test nâng cấp 0005/0006/0010 dùng service cũ được thay bằng kiểm tra SQL trên 0011 | 0011 dựng lại schema và không downgrade |
| Yêu cầu bổ sung | Đổi ngôn ngữ hiển thị màn chờ thay vì trang trắng | Người dùng yêu cầu trong phiên 14/11/2026 |
| Cách seed production | Seed chạy trên PostgreSQL 18 local rồi chép schema `dms` lên Neon bằng `pg_dump`/`pg_restore` trong một transaction, thay cho chạy `app.db.seed` trực tiếp trên Neon; verify `--seeded --regression` + `alembic check` chạy trực tiếp trên Neon | Seed qua mạng ~70 phút (site không dùng được suốt thời gian đó); cách này ~40 giây. Người dùng chọn 14/11/2026. Cùng code seed, cùng ngày, cùng 0011; chỉ khác chuỗi băm Argon2 (muối ngẫu nhiên) |
| Quyền đọc đơn vị tính | Mở rộng bằng tập đọc mặt hàng | 403 ở trang Mặt hàng cho Kinh doanh/Kế toán, phát hiện khi kiểm tra theo vai trò sau deploy |
| `verify --seeded` sau deploy | Kiểm tra số lượng hình dạng seed không còn khớp | Kiểm tra sau deploy ghi chứng từ thật (mục 5); toàn vẹn + quét từ cấm vẫn PASS |
