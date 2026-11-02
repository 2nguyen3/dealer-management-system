# Handoff: hoàn tất backend Agentra DMS

## Current Pre-Push Review - 2026-10-30

Current source includes three review fixes: isolated report test artifacts, early
dashboard JWT rejection without weakening live snapshot auth, and exact sales-rate
HALF_UP arithmetic. Final1088offline pass; reports/dashboard/API/responses measured
717statements/140branches exact100%. New actual-PG eight-boundary percentage node,
all-report source/ledger oracle rerun and independently generated PDF geometry pass.
Supabase0009/live30tableintegrity411documents/30agencies/24products pass without reset
or business mutation. Docker Engine is currently unavailable and local8000/8080
endpoints are unreachable; no rebuild/redeploy was performed. All earlier image/
hash/health observations are historical, not parity for today's changed source.
Full PG/deployment/browser gates were not rerun. See full_backend/VERIFICATION.md
for actual commands and limitations.

## M31 complete; next M32 with AI API - 2026-10-29 (latest)

M31 is complete/published:153/154business+2health at source/image/configured0009,
only chatbot absent. Final1084offline (291dashboard),14unique owningM31PG and
3direct/proxy/public dashboard cases pass;8retained deployment cases pass on the
same image. Dashboard6files161statements24branches/API68/0 exact per-file100%.
No concrete production finding remains after independent review and missing DP07/
DP08 witnesses were added/passed. Exact commands/scopes/failure resolutions in
[dashboard VERIFICATION](plan/dashboard/VERIFICATION.md). The real429 regression
fixed omitted shared HTTP limiting; rate check runs after same-snapshot auth/grants
and before any domain metric. D09 canonical policy was not expanded or rewritten.
All240app Python hashes match running image; live411documents/30agencies/24products
and receipt774/payment37/10200VND/oneevent retained. ExistingDocker/ngrok healthy,
frontend unchanged; no commit/push/newDB/seedreset/provider action.

Latest user instruction: finish M31 dashboard first, and edit this handoff for M32.
User confirms possessing an AI API and selects AI-assisted chatbot interpretation.
Do not implement M32 or call any AI provider during the M31 packet. Provider, base
URL, model, auth format, limits and data-retention policy have not been supplied;
do not guess them or request/print secrets in chat. Configure future credentials
server-side through reviewed Settings and ignored environment files, never frontend.

M32 must preserve the read-only AGENCY_DEBT/INVENTORY/SALES whitelist. The AI may
interpret supported questions into validated structured intent/entity/date inputs,
not execute SQL, choose arbitrary tools/URLs, alter documents/payments or override
the requested queryType. Check existing debt.read/inventory.read/sales.read before
entity or financial lookup and before sending protected context to a provider.
Minimize provider data: no tokens, credentials, contacts, provider evidence or bulk
financial datasets. Backend readers calculate exact money/quantity; AI-generated
numbers never replace authoritative results. Consider deterministic answer templates
after validated tool results. Prompt injection, malformed/extra model output,
timeouts/429/5xx and unavailable provider must fail safely without policy bypass,
secret leakage or fabricated successful answers. No mandatory conversation store.

D10 remains required before M32: signed scope-bound candidate-only continuation
under the same intent grant, minimal code/name/district, no broadened agency-profile
permission. Test26+matches, cursor tampering/context changes and final one/empty
pages; one candidate on a continuation page does not resolve original ambiguity.
AI integration does not itself resolve D10 or authorize wider data access.

Next worker starts M32 from this handoff: expand its owning six-file plan first,
resolve D10 in the single canonical contract, then implement bounded AI intent
interpretation and authorized exact readers. Do not reopen completed M31 or older
M29/M30 baselines without an affected dependency. Whole R5/R6, external terminal bank
refund settlement and final system/recovery/backup/browser gates remain open.
All runtime numbers in checkpoints below are historical.

## M29-M30 publication checkpoint - 2026-10-29

User-requested M29/M30 work is complete. Existing dms now publishes152/154business+
2health at source/image/configured Supabase0009. All12owning corrections/cancels and
all5reports(JSON/XLSX/PDF) are available; dashboard/chatbot alone remain unpublished.
Final1083offline (191reports),11unique owningM30PG across serial resumes plus normal-app
HTTP/resource rerun, and11unique direct/proxy/public endpoint cases pass. Exact per-file
coverage reports438/98/API66/0/sharedresponses48/18; M29disjoint22files1124/196 retained
separately. Automated actual PDF text/geometry/raster/glyph checks pass, not human
visual inspection. Original unsupported PNG image-review claims are retracted.

Source/runtime publication, fixture failures and their superseding passes, exact
commands/artifacts: [reports VERIFICATION](plan/reports/VERIFICATION.md) and
[M29 VERIFICATION](plan/document_corrections/VERIFICATION.md). All earlier dependent
M29 operation checklists have closure links. Plan validator sourcehead baseline is0009.
Existing Docker backend/frontend healthy; only backend rebuilt. Ngrok persistent
same configured publicdomain upstream8000, readiness200. Live30tablesintegrity and
411documents/30agencies/24products/receipt774/payment37/10200VND/oneevent retained.
No livebusinessmutation/seedreset/newDB/provideraction/commit/push in this delivery.

Next: M31 dashboard then M32 chatbot, followed by full R5/R6 acceptance/race/recovery/
backup/runtime-role/performance/browser release gates. Preserve dashboard userWIP;
only an empty integration-test package marker was added to prevent collection collision.
M31 should reuse ReportQueries.statement/exact projection inside one outer snapshot
with its own per-section authorization, not inherit reports.read or invoke public
report routes. External refund terminal bank settlement remainsPENDING and out of
scope. Do not rerun unrelated completed baselines or create extra DB/services/servers.

## Full M29 publication checkpoint - 2026-10-29

All12M29 correction/cancel operations deployed:147business+2health,0009head. Owning
disjoint22files1124stmt196branches exact100%; API64/0separate;36sourcecases+3direct/
proxy/public cases pass. Latest owning VERIFICATION records actual commands/artifacts.
Live30tablesintegrity411documents/30agencies/24products and immutable receipt774/
payment37/10200VND/oneevent preserved. ExistingDockerhealthy; frontend unchanged;
ngrok restored persistent same configured domain/upstream8000. No seedreset or live
businessmutation. M30 actualPGverification active, reports not published yet; continue
M30 then M31/M32 and fullreleasegates. Older entries below are historical.

Ngày bàn giao: 2026-10-25. Workspace: `D:\WorkSpace\projects\DMS`.
Mục tiêu phiên tiếp theo: triển khai backend còn lại theo thứ tự **M29 → M30 → M31 → M32**, rồi hoàn tất các gate release còn mở.

## Publication sáu operation - 2026-10-28 (mới nhất)

- Backend Docker hiện có đã cập nhật: **141target+2health**, source/deployed/schema
  **0009**. Sáu operation correct/cancel nhập kho, independent adjustment và manual
  payment receipt được publish; issue/return/credit correction routers còn unmounted.
- Backend/frontend healthy; direct8000/proxy8080/public ngrok readiness pass.
  Frontend không rebuild/recreate, domain/upstream ngrok giữ nguyên8000.
-589offline pass; release scope12files550statements96branches exact100% từng file;
  deployment3cases pass; manual original-period oracle pass. Exact commands, scope,
  artifacts và failed-fixture resolution ở owning M29 VERIFICATION phần đầu.
- Supabase hiện tại được migrate0007→0009 qua container backend có sẵn. Không DB/job/
  server phụ. Live integrity411documents/30agencies/24products pass; receipt774vẫn
  POSTED10200ONLINE, payment37SUCCESS và đúng1event. Không seed/reset/business mutation.
- Next: hoàn tất gate của sáu operation issue/upfront/return/credit còn lại rồi mới
  M30-M32. Không coi toàn M29 hoàn tất. Đừng lặp baseline chỉ để khớp log cũ; dùng
  source/runtime/contract và evidence đúng phạm vi. Worker boundary bị gián đoạn
  không có XML hoàn tất thì không tính pass.

## Resume lịch sử - 2026-10-28

- Docker Desktop đã được khởi động, chỉ hai container dms hiện có healthy; readiness
  direct/proxy/public pass, live integrity411documents/30agencies/24products pass.
- Ngrok đã được khởi động persistent theo yêu cầu, cùng domain cấu hình VNPAY và
  upstream `http://127.0.0.1:8000`. Không chuyển sang test server/tạo domain mới.
- Source đã có12owning correction/cancel handlers và0009từ WIP, vượt checkpoint cũ.
  **Chưa deploy/migrate:** runtime/schema0007,135target+2health vẫn giữ nguyên;
  source147target+2health không được nhầm với backend đã xuất bản.
- Sửa ba lỗi được review: conditional cash grant phải giữ qua bước tách tiền đến
  final authorization; issue lấy latest same-document POSTED snapshot kể cả product
  đã bị bỏ ở revision giữa; FIFO/available credit dùng effective return date, giữ
  immutable lot/source/receipt provenance. Đã có realPG regression, rollback/race.
- Offline mới nhất586pass/587deselected; owning evidence ghi exact selections tại
  `plan/document_corrections/VERIFICATION.md`. Tám HTTP case mở rộng pass nhưng chỉ
  TestClient in-process, không phải deployment. Migration0009và return/credit
  boundary worker còn đang chạy; đừng tính partial logs thành pass.
- Còn exact affected coverage, opposing matrix/original-period/deployment gates;
  M29-M32/R5/R6 chưa hoàn tất. Người dùng yêu cầu tiếp tục, không tự dừng ở checkpoint.
- Env được user cho phép đọc/thêm giá trị; phiên này chưa cần sửa env và không in
  secret. Không seed/reset dev, không đổi receipt774, không commit/push/frontend edits.

## Checkpoint tiếp tục M29 — 2026-10-25 (ưu tiên hơn các đoạn lịch sử phía dưới)

- Bộ sáu file `plan/document_corrections/` đã được lập trước code.
- Đã triển khai và kiểm chứng **service nội bộ**, chưa mount: correction/cancel
  receipt, independent adjustment và manual DEBT_COLLECTION CASH/BANK_TRANSFER.
- **572 offline +27 unique owning PG +12 retained PG pass**. Scope production bị
  ảnh hưởng: **9 files /310 statements /76 branches, exact100% từng file**.
- Source head **0008**, thêm policy correction receipt giữ product/unit đã POSTED
  trong chính chứng từ dù master hiện INACTIVE. Có witness0007 thật, kiểm chứng
  fresh/populated upgrade, downgrade/re-upgrade, seed lặp và54SQLchecks trong schema tạm.
- **Chưa migrate/restart runtime**: Supabase/runtime vẫn0007,135target+2health;
  live integrity411documents/30agencies/24products và receipt774 được giữ nguyên.
- Next executable slice: **zero-upfront issue correction/cancel**, sau đó upfront
  sync/separation, returns, credit, full race/original-period/HTTP publication gates.
  Inactive issue/terminated-agency D15 còn mở;0008 chỉ thay receipt admission.
- Test fixture đã sửa đúng bằng M19 separation thực trong schema tạm: seed có
  VERIFIED tiền chưa tách, không có sẵn POSTED RECEIVED_UNAPPLIED. Không xóa assertion
  để né lỗi. Lượt fail và lượt pass thay thế đều ghi trong owning VERIFICATION.
- Hai worker review bị quota, không có independent-review claim. Primary-agent đã
  rà soát cục bộ standards/spec. Các test PG hoàn tất dùng foreground với timeout
  đủ lớn; các lượt timeout/background thiếu XML không tính pass.
- Chỉ dọn5UUID schemas của các lượt M29 bị ngắt sau khi xác minh thời gian/fixture;
  **hai schema cũ từ22/10 được bảo toàn**, không tuyên bố toàn bộ test schema đã sạch.
- Đọc `plan/document_corrections/VERIFICATION.md` để lấy exact selections/artifacts,
  coverage `.coverage-m29-packet` và failed-fixture resolution. M29–M32/R5/R6 vẫn mở.

### Yêu cầu tiếp tục sau checkpoint này

- Người dùng đã yêu cầu tiếp tục thực hiện, không chỉ báo cáo kế hoạch/checkpoint.
  **Không tự dừng chỉ vì xong một lát nội bộ hoặc đạt100% coverage.** Tiếp tục phần
  còn làm được; nếu phải dừng, nêu blocker cụ thể và trạng thái thực tế. Quota review
  subagent không tự nó là blocker cho việc code/test hoặc review cục bộ.
- “Chưa mount” ở checkpoint này nghĩa là **mới có service và test, chưa có handler
  correction/cancel được nối vào FastAPI runtime**. Các chức năng mới chưa dùng được
  qua HTTP/Swagger; container vẫn chạy artifact0007. Không gọi đây là backend đã
  triển khai xong, và không lấy coverage service thay cho HTTP/deployment evidence.
- Gate publication áp dụng **theo từng operation**. Operation nào đủ tất cả promised
  branches, dependencies và required tests thì hoàn thiện/nối owning handler rồi
  publish; không bắt buộc chờ cả12operation M29 nếu operation riêng đã đủ gate.
  Không mount nhánh draft-only hay bỏ nhánh khó để tăng operation count.
- Trước khi cập nhật service hiện có hoặc migrate schema dev, báo rõ thao tác và
  ảnh hưởng. Chỉ thực hiện trên đúng môi trường hiện có theo §1; phân biệt source
  head, deployed code head và configured schema head trong evidence.

## 1. Ràng buộc bắt buộc mới nhất của người dùng

Nguyên văn:

> dùng supabase hiện tại, cấm dựng thêm db
> dùng docker hiện tại luôn
> cấm dựng thêm cái nào khác

Áp dụng khi tiếp tục; hướng dẫn vận hành cũ không phải ngoại lệ cho các giới hạn này:

- Chỉ dùng **database Supabase hiện tại** mà `backend/.env` đang cấu hình. Không tạo instance/database mới, không chạy PostgreSQL local hoặc PostgreSQL container. Không dùng `CREATE DATABASE`.
- Người dùng đã đồng ý trước đó với **schema UUID tạm trong cùng database Supabase** cho test PostgreSQL. Dùng harness hiện có với `SUPABASE_TEST_SCHEMAS=1`; không fallback sang chế độ tạo database test.
- Chỉ dùng Docker Compose project `dms` hiện tại, các service `backend`/`frontend` hiện có. Không dựng project/service/container/sidecar/proxy hoặc môi trường verification song song.
- Không chạy `docker run`, compose project có tên khác, hay `docker compose run` tạo container job mới. Kể cả migration, ưu tiên `docker compose exec -T backend ...` trong container đang có, sau khi thật sự xác định cần migration.
- Không khởi động thêm Uvicorn/app server tại `18000` hoặc cổng khác, không thêm dev server Vite, không tạo/đổi tunnel ngrok. Không chạy `tests.support.vnpay_acceptance`: helper này cần endpoint/runtime riêng, không phù hợp ràng buộc mới.
- Nạp code vào đúng các service hiện có khi cần triển khai; giữ nguyên tên/cổng/URL. Hạn chế restart, báo rõ trước khi cần cập nhật service. Không dùng `down`, xóa volume, reset/seed lại database hoặc dọn thư mục `data/`.
- Soát fixture trước khi chạy một lệnh verification cũ: nếu nó tự dựng DB/container/server riêng thì không chạy nguyên xi. Dùng test thuần, mock in-process và môi trường hiện có; ghi rõ gate bị chặn thay vì tự dựng môi trường khác để vượt gate.
- Bảo toàn công việc frontend và các thay đổi chưa commit. Không commit/push/reset/clean nếu chưa được yêu cầu.

**Bài học vận hành:** phiên trước từng tạm chuyển ngrok sang app test, khiến người dùng mất đường truy cập mong đợi và rất bức xúc. Đường dẫn đã được khôi phục. Tuyệt đối không lặp lại, không thử một tunnel cùng domain với upstream khác: ngrok có thể cùng cấp domain, gây route sai. Helper cũ đã bỏ khả năng tự redirect, nhưng ràng buộc hiện tại còn cấm dựng runtime phụ nói chung.

## 2. Điểm bắt đầu và nguồn sự thật

Đọc các file dưới đây; ưu tiên **checkpoint mới nhất ở đầu file**, các đoạn “unmounted/credentials blank/410 documents” phía sau có thể là lịch sử:

1. `AGENTS.md`, `backend/AGENTS.md`.
2. `openwiki/backend-design/GENERAL_PLAN.md` và `GENERAL_CHECKLIST.md`.
3. `openwiki/backend-design/plan/full_backend/GOAL.md`.
4. Cùng thư mục: `PLAN.md`, `MODULES.md`, `OPERATIONS.md`, `EXECUTION.md`, `DECISIONS.md`, `AVAILABILITY.md`, `VERIFICATION.md`.
5. `openwiki/backend-design/API/openapi.json`: contract chuẩn duy nhất, không tạo bản đặc tả HTTP thứ hai.
6. Owning `plan/{online_payments,refunds,document_history}/VERIFICATION.md`: bằng chứng packet vừa hoàn tất.
7. `.agents/workflows/verify.md` và `docker.md`, nhưng lọc các lệnh theo ràng buộc môi trường mới ở §1.

Handoff này chỉ giữ ngữ cảnh quyết định và thao tác tiếp theo; thiết kế, symbol registers, test matrix và câu lệnh chi tiết đã có ở các artifact trên.

## 3. Trạng thái vừa bàn giao

- M26 online payments: 6 API; M27 refunds: 12 API; M28 document history/lines/HTML/PDF: 9 API đã mount.
- Runtime OpenAPI: **135/154 target business operations + 2 health = 137 operations**. Hai transport GET VNPAY IPN/Return được tài liệu hóa riêng, không tính thêm vào 154 business IDs.
- Packet native trước đó ở0007; source M29 mới là**0008**, Supabase/runtime hiện vẫn
  **0007**. Chưa triển khai migration M29 lên schema dev.
- Backend/frontend hiện healthy; kiểm tra lại bằng lệnh đọc trạng thái khi bắt đầu phiên mới.
- Địa chỉ giữ nguyên: backend `http://localhost:8000`, UI/Nginx `http://localhost:8080`, Swagger `/api/docs`.
- Ngrok hiện trỏ vào `http://127.0.0.1:8000`. Lấy domain đang chạy từ local API `http://127.0.0.1:4040/api/endpoints`; không đổi routing. Merchant đã đăng ký IPN native.
- Tất cả VNPAY settings nằm trong **`backend/.env` chính**; `backend/.env.vnpay` đã xóa theo yêu cầu. Không tạo lại file phụ. Template: `backend/.env.example`.
- Native VNPAY dùng SHA512, GET IPN và Return riêng, querydr/refund; giữ độc lập với protocol JSON/HMAC `PAYMENT_*` dùng cho controlled adapters.

### Dữ liệu thật trong môi trường dev phải giữ

Người dùng cho phép giao dịch thẻ sandbox qua server dev hiện tại:

- Payment **37**, số tiền **10.200 VND**, trạng thái **SUCCESS**.
- IPN do VNPAY tự gửi về đã tạo **một receipt 774 và một event**. Trước khi SUCCESS, assistant không gọi reconcile/manual IPN cho giao dịch mới này.
- Replay bằng chứng ký thật trả `RspCode=02`, không tạo thu tiền trùng.
- Live hiện **411 documents / 30 agencies / 24 products**; 410 documents seed gốc được giữ lại. Receipt mới là chứng từ tiền tự động đã ghi nhận: M29 phải bảo vệ, không sửa/hủy tiền thực đã nhận như phiếu thu thủ công.
- Sau giao dịch hợp lệ này, dùng `python -m app.db.verify` hoặc `--regression` cho integrity. Không reset database để làm lại checkpoint `--seeded` cũ.

Xem đầy đủ provenance trong owning M26 VERIFICATION và artifact local `data/backend/vnpay-dev-payment.json`. Artifact có checkout URL ký; không đưa nội dung nhạy cảm ra handoff/public output. **Không chạy lại action `create` của helper dev chỉ để test.**

### Việc VNPAY còn mở

External refund **15714325**, **5.000 VND**, request và query có chữ ký hợp lệ, hiện `TransactionStatus=05/PENDING`.

- Đây là giao dịch nghiệm thu từ **schema tạm của phiên trước**, không phải refund mới của receipt 774 trong `dms`. Schema tạm đó đã được dọn; không hồi sinh hay sao chép fixture vào `dms`.
- Không báo đã trả tiền hoặc tự đổi trạng thái SUCCESS/FAILED. Terminal bank settlement vẫn là mục release mở trong M27 checklist.
- Native reconciliation giữ reservation với UNKNOWN/PENDING; unsigned response 94 không phải bằng chứng tài chính. Không gửi lại refund hoặc polling dồn dập.
- Nếu cần đọc lại kết quả, tham chiếu metadata/câu lệnh đã ghi ở M26/M27 VERIFICATION và helper diagnostic local. Chỉ dùng query đọc trạng thái; không tạo giao dịch sandbox khác khi không cần.
- Mục theo dõi này không phải lý do dừng chuẩn bị/triển khai M29.

## 4. Công việc backend còn lại

**19 target operations chưa publish:** 12 thuộc M29, 5 reports, 1 dashboard, 1 chatbot. Chi tiết bắt buộc ở `MODULES.md`, `OPERATIONS.md`, `EXECUTION.md`, không sao chép contract sang handoff.

### M29 — ưu tiên đầu tiên, E19

- Owning child plan `plan/document_corrections/` đã có sáu file và evidence cho
  internal goods/manual cash. Tiếp tục từ current checkpoint, không tạo lại plan trống.
- Phạm vi là sáu correction operations và toàn bộ posted branches của sáu cancellation operations. Endpoints vẫn thuộc owning modules; tái dùng M13/M16 và services đã có.
- Thứ tự vertical slices ở EXECUTION §5: goods history → issue/manual cash replay → upfront separation/synchronization → returns/rounding → credit provenance → refund reservations/paid/count blockers → opposing race matrix/original-period oracle.
- Đọc gap D15 và các quyết định replay/provenance trước khi thay guard. Chứng minh thiếu schema rồi mới cân nhắc revision mới; không sửa SQL snapshots 0001–0007.
- Không mount handler “draft-only” cho một operation còn hứa posted cancellation/correction. Chỉ publish khi đầy đủ promised branches và kiểm thử bắt buộc.
- Dùng fixtures trong schema tạm Supabase để thử phá/race/rollback. Không thử correction/cancel vào dữ liệu dev thật hoặc receipt 774 để chứng minh guard.

#### Deliverables M29 còn thiếu — danh sách thực thi

1. **HTTP cho6operation đã có service:** correction/cancel receipt, independent
   adjustment và manual receipt. Code hiện ở
   `backend/app/modules/document_corrections/{goods,manual_receipts}.py`; schemas ở
   owning modules. Còn owning handlers/router wiring, HTTP permission/precondition/
   idempotency/status/response/header tests theo contract chuẩn và deployment gates.
2. **Zero-upfront issue:** correction/cancel, giữ snapshot giá khi bỏ qua override,
   đảo inventory/charge và replay các nguồn sau; kiểm tra return nguồn, tồn lịch sử,
   ngày và hạn mức. Giải quyết D15 inactive issue/terminated agency bằng witness thật.
3. **Upfront issue:** bảo toàn immediatePayment thực nhận, tạo auto-receipt successor
   đồng bộ ngày; khi cancel tách đầy đủ VERIFIED/CONSUMED money sang receipt riêng,
   FIFO phần có thể và credit phần dư; conditional cash.receipt.post và retry atomic.
4. **Sales return:** correction/cancel, original line/price/quantity cap, cumulative
   rounding và immutable dependent successors; replay debt/credit/provenance.
5. **Credit application:** correction/cancel, FIFO/lot provenance qua các chuỗi
   application/return; cash mới luôn0, không tiêu reservation hoặc mất nguồn refund.
6. **Integrated closure:** ma trận race đối nghịch còn lại, injected rollback các
   stage mới, original-period oracle, owner regressions và affected coverage mở rộng.
   Đóng deferred owner gates bằng evidence, không chỉ thêm route. Sau đó triển khai
   operation đủ điều kiện, kiểm runtime OpenAPI/direct/Nginx/live integrity.

### M30 → M31 → M32

- M30 sau M29: năm báo cáo, mỗi báo cáo JSON/XLSX/PDF; oracle phải đối chiếu lại sau correction/replay. Chuẩn bị child plan trước, cập nhật dependency lock nếu cần thư viện export.
- M31 sau M30: chốt **D09 dashboard admission** trong DECISIONS và contract chuẩn trước khi code. Không âm thầm nới quyền/đổi nội dung contract.
- M32 sau M31: chốt **D10 candidate-only continuation** trước khi code. Không dùng API agency-profile rộng quyền để thay thế phân trang tối thiểu của chatbot. Thiết kế hiện tại không bắt buộc tài khoản LLM.
- Chuẩn bị child plans tương ứng; các thư mục `reports`, `dashboard`, `chatbot` chưa tồn tại dưới backend plan tại thời điểm bàn giao.
- M30 gồm sales/debt/inventory/product-sales/cash-and-credit; **5operations, mỗi
  operation3formats**, không đếm nhầm thành15operations. Còn queries, exact totals,
  full-filter exports, permission parity, empty/large/Vietnamese/formula-like input
  boundaries và original-period reconciliation sau M29. Chi tiết ở MODULES/E20.
- M31 còn permission-filtered sections, coherent asOf, current balance vs period
  flow, pending/VERIFIED unreceipted money, charts/top10 và per-grant tests sau D09.
- M32 còn authorized intent whitelist, minimal agency disambiguation/continuation,
  cursor scope, duplicate-name/26+candidate/final one-or-empty-page tests sau D10.

### Release / hoàn tất owning modules

M29 phải đóng các deferred paths của modules cũ bằng bằng chứng, không chỉ thêm router. R5/R6 và acceptance terminal bank refund còn mở. Xem EXECUTION R5/R6/E22, GENERAL_CHECKLIST phần deferred/integrated/release. Kiểm tra cả runbook/runtime grants/recovery ở packet cuối; frontend browser completion là gate riêng.

Deliverables release còn lại: manifest đủ154target operations với runtime/source
contract parity; affected integrated/regression/deployment evidence; migration và
uncertain-money recovery runbook; runtime-role grants; backup/restore rehearsal phù
hợp giới hạn môi trường; terminal external refund evidence khi có kết quả thật.
Gate nào không thể chạy trong môi trường được phép phải ghi rõ đang mở, không dựng
môi trường khác hoặc tự tuyên bố pass. Frontend/browser là gate riêng, bảo toàn WIP.

## 5. Verification hiện có — giữ đúng phạm vi

Checkpoint đã chạy trước ràng buộc môi trường mới:

- **568 offline passed**; **40 unique PG** owning nodes: 18 M26 + 11 M27 + 11 M28.
- Hai native PG IDs được chạy lại và supersede cùng IDs: không cộng thành 42. JUnit đầy đủ xác nhận pass dù launcher từng in timeout/abort.
- **6 deployment cases**: 3 native transport checks + 3 authenticated packet reads/PDF qua direct/Nginx/public; đã pass riêng từng đường.
- Scope packet/config/API: **1783 statements / 408 branches, exact 100% per file**. Không phải coverage toàn backend.
- Ruff pass, locked images build, Nginx `-t`, live integrity và 54 SQL regression assertions có bằng chứng.

Lệnh/artifact cụ thể xem M26 VERIFICATION. Root `data/backend/` chứa `.coverage-vnpay-*`, JSON coverage, JUnit XML và logs. Giữ nguyên để resume, không dọn cho “sạch”. Không lấy snapshot cũ làm chứng minh một lần chạy mới. Kiểm tra fixtures trước khi rerun full suite theo §1.

Cho từng function mới: success/failure/boundary mapping vào actual symbol; mutation có persisted-state/rollback và concurrency thật khi liên quan. Required skipped/xfail/unrun không được dùng đóng checklist. Sau khi scoped checks pass, chỉ mở rộng/rerun khi có thay đổi/rủi ro thực sự; không chạy lại hàng loạt baseline đắt tiền chỉ vì có handoff.

## 6. Workspace và cách làm việc

- Repo hiện rất dirty và nhiều backend feature/test/plan files là **untracked nhưng đang chạy thực tế**. HEAD không phải toàn bộ trạng thái vừa verify. Bắt đầu bằng `git status --short` và xem diff; không checkout/reset/clean/stash hàng loạt.
- Frontend source/tests/dependencies/HANDOFF có công việc người dùng từ trước; giữ nguyên. Thay đổi frontend của packet này chỉ là Nginx API Referrer-Policy, đã kiểm tra qua proxy. Backend handoff đã cập nhật frontend GENERAL_CHECKLIST mà không đóng checkbox frontend.
- Không mở `.env`, resolved Compose config hay in token/password/HashSecret ra output. Không copy secrets vào tài liệu. Dùng `config --quiet` và các kiểm tra chỉ báo có/chưa cấu hình.
- Người dùng rất không hài lòng với việc trả lời kế hoạch rồi dừng/chờ lâu. Nêu bước sắp làm ngắn gọn rồi thực hiện; cập nhật khi có kết quả thật hoặc blocker. Lệnh PG từ xa có thể lâu: báo trạng thái cụ thể, theo dõi node/log/artifact, đừng lặp lại “đang làm tiếp” thay cho thực thi.
- Không lặp lại những câu hỏi môi trường đã chốt. Chỉ hỏi khi thật sự cần quyết định mới, ví dụ D09/D10 không có quyết định được duyệt trong artifact.

## 7. Các bước mở phiên tiếp theo

1. Đọc ràng buộc §1 và guidance/checkpoint mới nhất ở §2.
2. Kiểm tra read-only: git status/diff, `docker compose ps`, readiness `8000/8080`, runtime OpenAPI, ngrok upstream và `docker compose exec -T backend alembic current`. Không khởi động môi trường mới.
3. Đọc owning M29 current VERIFICATION/TESTS và resume todo; bộ sáu-file plan, trace
   12operations và internal goods/manual cash đã có.
4. Tiếp zero-upfront issue rồi các vertical slices còn lại theo EXECUTION E19; verify
   trên schema tạm Supabase hiện có. Giữ endpoint dev và dữ liệu thật nguyên vẹn.
5. Publish đầy đủ operation gates, cập nhật owning/general evidence; sau đó mới tiếp M30–M32 và release closure. Có thể checkpoint/handoff giữa các packet lớn, nhưng phải nêu phần đã verify/đang mở chính xác.

## 8. Suggested skills

Chỉ invoke nếu đúng tác vụ thực tế; không cần load tất cả ngay:

- **implement**: khi bắt đầu triển khai một slice từ owning spec/plan đã chuẩn bị.
- **diagnosing-bugs**: khi có lỗi khó hoặc race/performance regression cần chẩn đoán.
- **code-review**: khi đến lượt review thay đổi theo standards/spec; scope chỉ các thay đổi backend liên quan, bảo vệ WIP frontend. Tuân thủ giới hạn delegation của harness.
- **playwright-cli**: khi cần browser verification trên server hiện có; không khởi động app/test server khác.
- **handoff**: để bàn giao packet lớn tiếp theo khi cần, tham chiếu artifacts thay vì chép lại toàn bộ spec.

Không tự spawn subagents nếu người dùng hoặc applicable skill/instructions chưa yêu cầu rõ. Không viện dẫn skill để vượt các giới hạn môi trường ở §1.

## Prompt tiếp tục gợi ý

> Đọc handoff này và guidance trong repo DMS. Resume owning M29 plan/VERIFICATION đã có: goods/manual cash services đã verify nhưng chưa có HTTP handlers được publish; source0008, runtime/schema0007. Tiếp zero-upfront issue rồi upfront/return/credit và integrated gates; đồng thời hoàn thiện HTTP/deploy cho operation nào đã đủ toàn bộ gate. Sau M29 tiếp M30–M32, chuẩn bị child plans trước code và chốt D09/D10 khi đến gate. Chỉ dùng Supabase và Docker Compose dms hiện tại; cấm dựng thêm DB/container/service/project/server test/tunnel. Test PG bằng schema UUID trong cùng Supabase. Giữ nguyên8000/8080/ngrok/WIP frontend/receipt774. Báo trước khi cần cập nhật service hoặc migrate dev. Tiếp tục công việc còn thực hiện được, không tự dừng ở checkpoint hay dùng service coverage thay HTTP/deployment evidence; chỉ báo pass từ kết quả thật.
