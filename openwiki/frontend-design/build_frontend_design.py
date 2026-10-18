"""Build the frontend planning and static wireframe source set.

Run from the repository root: python -B openwiki/frontend-design/build_frontend_design.py
The single API contract remains backend-design/API/openapi.json. This script does
not alter that contract, application code, or either existing general roadmap.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "openwiki/frontend-design"
CONTRACT = ROOT / "openwiki/backend-design/API/openapi.json"
BACKEND_INVENTORY = ROOT / "openwiki/backend-design/plan/full_backend/OPERATIONS.md"
NOTICE = "Bản phác thảo giao diện · dữ liệu minh họa · không kết nối API"


@dataclass(frozen=True)
class Screen:
    slug: str
    title: str
    purpose: str
    fields: str
    states: str


@dataclass(frozen=True)
class Module:
    number: int
    name: str
    backend: str
    prerequisites: str
    mission: str
    screens: tuple[Screen, ...]
    critical: str


def screen(slug: str, title: str, purpose: str, fields: str, states: str) -> Screen:
    return Screen(slug, title, purpose, fields, states)


MODULES = (
    Module(1, "frontend_foundations", "M02 (business transport)", "Existing UI starter", "Create route, API, exact-value, state, test and accessibility conventions while preserving the health starter.", (
        screen("index", "Mẫu giao diện", "Shared operational patterns and system status.", "Trạng thái API|Mã yêu cầu|Chuyển mô-đun", "Loading|Empty|Forbidden|Unavailable"),
        screen("forms", "Mẫu biểu mẫu", "Reusable labels, validation and version-aware actions.", "Nhãn|Giá trị nhập|Lỗi trường|Phiên bản", "Invalid field|Stale ETag|Uncertain submit"),
        screen("tables", "Mẫu danh sách", "Cursor lists and results filtered without fabricated page counts.", "Tìm kiếm|Bộ lọc|Sắp xếp|Trang tiếp", "First-use empty|No matches|Stale cursor"),
        screen("states", "Trạng thái hệ thống", "Loading, partial reads, request IDs and safe recovery.", "Mã yêu cầu|Thử lại|Liên hệ hỗ trợ", "429 retry|503 unavailable|412 review"),
    ), "Source-derived JSON validation and exact amount, ID and business-date representations."),
    Module(2, "authentication", "M01", "F01", "Implement all seven real authentication actions with tab-scoped refresh, permission reload and safe reset links.", (
        screen("index", "Đăng nhập", "Enter email and untouched password; load current grants after login.", "Email|Mật khẩu", "Incorrect password|Locked account|Rate limited"),
        screen("forgot-password", "Quên mật khẩu", "Offer the same accepted response for every valid email.", "Email|Gửi yêu cầu", "Accepted|Delivery unavailable|429"),
        screen("reset-password", "Đặt lại mật khẩu", "Consume a one-time fragment and return to sign-in.", "Mật khẩu mới|Xác nhận mật khẩu", "Expired link|Used link|Completed"),
        screen("change-password", "Đổi mật khẩu", "Verify the current password and invalidate sessions on success.", "Mật khẩu hiện tại|Mật khẩu mới", "Wrong current password|Sign in again|Locked"),
        screen("session", "Phiên đăng nhập", "Show session restoration, expiration and deliberate reauthentication.", "Phiên hiện tại|Thử đăng nhập lại", "Lost refresh reply|Duplicate tab|Session revoked"),
    ), "Single-use refresh: one winner; wrong-current-password 401 must never trigger a refresh loop."),
    Module(3, "application_shell", "M01/M02", "F02", "Compose protected routes and navigation from live allowedFunctions, not role labels.", (
        screen("index", "Khung ứng dụng", "Signed-in shell, account menu and available work areas.", "Thanh điều hướng|Tài khoản|Nội dung", "No grants|Backend unavailable|Identity switched"),
        screen("navigation", "Điều hướng theo quyền", "Demonstrate sales, warehouse, accounting and custom-grant menus.", "Nhóm mục|Quyền hiện tại|Tác vụ", "Read-only|Changed grant|Mobile navigation"),
        screen("access-denied", "Không có quyền truy cập", "Handle a protected deep link after a changed grant.", "Đường dẫn|Quyền cần thiết", "403|Locked account|Lost session"),
        screen("not-found", "Không tìm thấy", "Differentiate missing routes and records from denied reads.", "Đường dẫn|Quay lại", "Unknown route|Missing record|Unavailable operation"),
    ), "Read-only access remains possible without manage grants; no MANAGEMENT bypass."),
    Module(4, "user_groups", "M03", "F03", "Manage groups without deleting a group still referenced by active or locked staff.", (
        screen("index", "Nhóm nhân viên", "Search groups and current membership counts.", "Mã nhóm|Tên nhóm|Số nhân viên", "Empty|Filtered|Read-only"),
        screen("detail", "Chi tiết nhóm", "Inspect members, grants and safe delete availability.", "Mã nhóm|Nhân viên|Quyền", "Referenced by LOCKED user|Delete forbidden|412"),
        screen("editor", "Tạo hoặc sửa nhóm", "Create a distinct code or edit with a strong version.", "Mã nhóm|Tên nhóm|Lưu", "Duplicate code|Validation|Concurrent edit"),
    ), "Delete requires groups.manage AND permissions.manage; grant cleanup is backend-atomic."),
    Module(5, "users", "M04", "F04", "Create and manage employee accounts; do not display returned passwords or claim reset unlocks a locked account.", (
        screen("index", "Tài khoản nhân viên", "Find staff by email, group and status.", "Email|Nhóm|Trạng thái", "Duplicate email|Empty|Permission denied"),
        screen("detail", "Chi tiết tài khoản", "Show status, group and affected-session warning.", "Tên|Email|Nhóm|Tình trạng", "Locked|Changed group|Stale version"),
        screen("editor", "Tạo hoặc cập nhật nhân viên", "Preserve password bytes and use group selection only when authorized.", "Họ tên|Email|Nhóm|Mật khẩu khi tạo", "Email conflict|Invalid form|Concurrent change"),
        screen("password-reset", "Đặt lại mật khẩu nhân viên", "Admin reset revokes all sessions; locked account stays locked.", "Mật khẩu mới|Xác nhận thao tác", "Missing permission|412|Session invalidated"),
    ), "Group/status/admin-password changes invalidate live sessions; email uniqueness is case-insensitive."),
    Module(6, "permissions", "M05", "F05", "Expose the read-only function registry and create/update/revoke group grants with the correct preconditions.", (
        screen("index", "Ma trận phân quyền", "View effective grants by group and function.", "Nhóm|Mã chức năng|Được phép", "No grants|Grant changed elsewhere|Forbidden"),
        screen("registry", "Danh mục chức năng", "Inspect fixed system functions without user-created entries.", "Mã chức năng|Tên|Mô tả", "Read-only|No results|Denied"),
        screen("function", "Chi tiết chức năng", "Explain scope and linked group grants.", "Mã chức năng|Nhóm được cấp", "Not found|Read-only|Permission lost"),
        screen("grant", "Cập nhật quyền", "New grant uses If-None-Match: *; existing grant uses If-Match.", "Nhóm|Chức năng|Cho phép", "Create conflict|412|Revoked on next request"),
    ), "Never send both If-Match and If-None-Match; isAllowed=false revokes without deleting the record."),
    Module(7, "audit_logs", "M06", "F06", "Browse immutable, redacted USER/SYSTEM audit entries and correlated request IDs.", (
        screen("index", "Nhật ký hệ thống", "Filter audit by actor, function, entity and time.", "Người thực hiện|Chức năng|Thời gian|Mã yêu cầu", "No records|Denied|Safe redaction"),
        screen("detail", "Chi tiết thay đổi", "Inspect safe before/after snapshots and related entity links.", "Trước|Sau|Mã yêu cầu|Tài nguyên", "SYSTEM actor|Missing entity|No sensitive values"),
    ), "No edit/delete or raw password, token or provider payload controls."),
    Module(8, "districts", "M07", "F03", "Manage active districts with a capacity derived from global business rules.", (
        screen("index", "Quận", "Show active agency count and capacity per district.", "Mã quận|Tên quận|Đại lý đang hoạt động", "Full district|Inactive|Empty"),
        screen("detail", "Chi tiết quận", "Inspect referencing agencies and eligibility for deletion.", "Quận|Số đại lý|Trạng thái", "Referenced|No capacity|Read-only"),
        screen("editor", "Tạo hoặc cập nhật quận", "Edit district metadata, not a district-specific capacity.", "Mã|Tên|Trạng thái", "Duplicate|Referenced delete|412"),
    ), "Capacity is global and server-enforced under concurrent dealer admissions."),
    Module(9, "agency_types", "M08", "F03", "Configure dealer types and debt limits without invalidating existing balances.", (
        screen("index", "Loại đại lý", "Search active/inactive types and limit usage.", "Mã loại|Hạn mức nợ|Số đại lý", "Inactive|Empty|Read-only"),
        screen("detail", "Chi tiết loại đại lý", "Inspect current limit, including terminated members.", "Loại đại lý|Hạn mức|Đại lý tham chiếu", "Used type|Stale balance|Delete blocked"),
        screen("editor", "Tạo hoặc sửa loại đại lý", "Edit exact whole-VND maxDebt with optimistic version.", "Mã|Tên|Hạn mức nợ|Trạng thái", "Invalid VND|Duplicate|412"),
        screen("limit-conflict", "Không thể hạ hạn mức", "Show server-listed affected dealers rather than a generic toast.", "Đại lý|Dư nợ hiện tại|Hạn mức đề xuất", "Active blocker|Terminated blocker|Reload"),
    ), "Both active and terminated agencies can block lowering the limit."),
    Module(10, "units", "M09", "F03", "Manage units and the integer-versus-three-decimal quantity policy.", (
        screen("index", "Đơn vị tính", "List units and fractional policy.", "Mã đơn vị|Tên|Cho phép số lẻ", "Inactive|Used|No matches"),
        screen("detail", "Chi tiết đơn vị", "Inspect product references and immutable usage constraints.", "Mã|Mặt hàng sử dụng|Số lẻ", "Recorded use|Delete blocked|Read-only"),
        screen("editor", "Tạo hoặc sửa đơn vị", "Select fraction policy; recorded use may prevent changing it.", "Mã|Tên|Cho phép số lẻ|Trạng thái", "Invalid fraction|409 used|412"),
    ), "Fractional policy is not a conversion system and cannot change after recorded use."),
    Module(11, "business_rules", "M10", "F08, F09", "Manage the singleton district capacity and selling-price multiplier without rewriting snapshots.", (
        screen("index", "Quy định hiện hành", "Display global capacity and exact price rate.", "Số đại lý tối đa/quận|Tỷ lệ giá xuất", "Read-only|Unavailable|412"),
        screen("editor", "Sửa quy định", "Review versioned capacity/rate edits.", "Giới hạn/quận|Tỷ lệ giá xuất|Lưu", "Invalid decimal|Stale ETag|Derived price decision"),
        screen("capacity-conflict", "Sức chứa không hợp lệ", "List districts currently exceeding the proposed capacity.", "Quận|Số đang hoạt động|Giới hạn mới", "Multiple blockers|Reload|Retry after change"),
    ), "D16 must settle derived quote bounds before rate/price consumers publish."),
    Module(12, "products", "M11", "F10, F11", "Manage products while stock and current prices remain server-derived and read-only.", (
        screen("index", "Mặt hàng", "Find products, current stock, current quote and low-stock flags.", "Mã hàng|Đơn vị|Tồn hiện tại|Giá hiện tại", "No price source|Low stock|Inactive"),
        screen("detail", "Chi tiết mặt hàng", "Show latest business-date purchase source and inventory links.", "Mã hàng|Nguồn giá|Tồn|Mức cảnh báo", "Derived quote unusable|Source reversed|Read-only"),
        screen("editor", "Tạo hoặc sửa mặt hàng", "Edit name, unit and threshold; never let users set stock/price.", "Tên|Đơn vị|Mức cảnh báo|Trạng thái", "Unit used|Duplicate names|Eligible-delete conflict"),
    ), "D02 eligible deletion and D16 derived selling-price response policy must be resolved."),
    Module(13, "agencies", "M12", "F08, F09, F11", "Maintain dealer profiles and irrevocable termination without erasing outstanding obligations.", (
        screen("index", "Đại lý", "Search by immutable dealer code and distinguish duplicate names by district.", "Mã đại lý|Tên|Quận|Nợ hiện tại", "Duplicate names|Terminated|No matches"),
        screen("detail", "Hồ sơ đại lý", "Link issues, receipts, debt and credit without editing balances.", "Mã|Loại|Quận|Hạn mức|Nợ|Dư có", "Terminated with debt|Read-only|Missing lookup grant"),
        screen("editor", "Tiếp nhận hoặc sửa đại lý", "Enter required email and select eligible active type/district.", "Tên|Email|Loại|Quận|Ngày tiếp nhận|Điện thoại", "District full|Limit too low|412"),
        screen("terminate", "Ngừng hợp tác", "Require a reason and show continuing collection/return/refund rights.", "Lý do ngừng|Dư nợ còn lại|Xác nhận", "Already terminated|No reopen|Uncertain intent"),
    ), "No reactivation endpoint; eligible unused deletion depends on the shared D02 repair."),
    Module(14, "document_workbench", "M13/M28", "F12, F13", "Own common document editor/line/parent-version patterns without inventing a generic posting endpoint.", (
        screen("index", "Bàn làm việc chứng từ", "Explain kind-specific actions, drafts and revision states.", "Loại phiếu|Trạng thái|Phiên bản|Ngày nghiệp vụ", "DRAFT|PENDING/READY|POSTED/CANCELLED"),
        screen("goods-editor", "Sửa dòng hàng", "Goods-kind draft lines use parent ETag; financial documents have none.", "Mặt hàng|Số lượng|Giá/nguồn|Phiên bản cha", "Duplicate product|Immutable revision|Parent 412"),
        screen("financial-editor", "Soạn phiếu tài chính", "A financial draft uses header fields only; show balance-neutral preview.", "Đại lý|Ngày nghiệp vụ|Số tiền|Ghi chú", "No goods lines|Missing permission|Invalid amount"),
        screen("conflict", "Nội dung đã thay đổi", "Preserve local edits; compare latest server parent before deliberate retry.", "Bản bạn nhập|Bản máy chủ|Tải lại", "412|428|Unknown submit outcome"),
    ), "Shared line/revision operations are full-gated at M28 even when an earlier kind can create lines."),
    Module(15, "inventory", "M14", "F14", "Provide authoritative product inventory statement with opening/running quantity and effective history.", (
        screen("index", "Tồn kho", "Open a product stock statement from products.", "Mặt hàng|Tồn hiện tại|Mức cảnh báo", "Low stock|Zero stock|Denied"),
        screen("stock-card", "Thẻ kho", "Show signed movements in business-date and stable business order.", "Từ ngày|Đến ngày (không gồm)|Đầu kỳ|Cuối kỳ", "No movements|Reversed entry|Opening balance"),
        screen("movement", "Dòng biến động kho", "Link a movement to its source document and historical revision.", "Ngày nghiệp vụ|Phiếu nguồn|Số lượng|Hiệu lực", "Historical revision|Correction|Missing permission"),
    ), "Never aggregate unlike product units into a single quantity."),
    Module(16, "stock_receipts", "M15/M28/M29", "F15", "Prepare and post incoming goods, then integrate full lines and later correction/cancellation.", (
        screen("index", "Phiếu nhập hàng", "Find drafts and posted receipts by business date/status.", "Mã phiếu|Ngày nghiệp vụ|Trạng thái|Giá trị", "No receipts|Canceled|Filtered"),
        screen("editor", "Lập phiếu nhập", "Enter one product per line, quantity and positive purchase price.", "Ngày nghiệp vụ|Mặt hàng|Số lượng|Giá nhập", "Duplicate line|Inactive unit|Invalid price"),
        screen("review", "Xác nhận nhập kho", "Review draft against latest version before authoritative posting.", "Dòng hàng|Tổng tiền|Người xác nhận", "412|Historical stock dependency|Unknown result"),
        screen("detail", "Chi tiết phiếu nhập", "Show committed stock changes and the historical purchase-price source.", "Phiên bản|Dòng hàng|Tồn sau ghi sổ|Nguồn giá", "Posted immutable|Corrected|Cancel blocked"),
    ), "Receipt create-with-lines is distinct from later published shared line editing and full cancellation."),
    Module(17, "stock_issues", "M17/M19/M28/M29", "F16", "Prepare sale, freeze READY price and post physical issue with correct upfront evidence and current checks.", (
        screen("index", "Phiếu xuất hàng", "Queue drafts, waiting issues and posted sales.", "Đại lý|Ngày nghiệp vụ|Trạng thái|Trả ngay dự kiến", "No permission|Pending|Canceled"),
        screen("editor", "Lập phiếu xuất", "Select active dealer and products; draft quote remains provisional.", "Đại lý|Mặt hàng|Số lượng|Trả ngay dự kiến", "No price source|Invalid amount|Dealer terminated"),
        screen("pending", "Chờ xuất kho", "Display frozen READY price, verification and stock-not-reserved warning.", "Giá đã chốt|Tồn hiện tại|Xác nhận tiền", "No verification|Stock consumed|Credit limit"),
        screen("replace-pending", "Thay nội dung chờ xuất", "Replace pending revision; previous evidence may require separation.", "Phiên bản cũ|Dòng mới|Lý do", "Verified money blocks replacement|New draft|412"),
        screen("review", "Xác nhận xuất kho", "Recheck warehouse stock, dealer and limit; one result with auto receipt.", "Tổng phiếu|Trả ngay đã xác nhận|Dư nợ sau", "Money retained after failed post|No stock|Uncertain result"),
        screen("detail", "Chi tiết phiếu xuất", "Separate remaining at issue from current outstanding and linked receipts.", "Số phiếu|Trả ngay|Còn nợ lúc xuất|Còn nợ hiện tại", "Return linked|Corrected|Paid by credit"),
    ), "Issue post/pending replacement are full-gated at M19; cancel at M29; no READY stock reservation."),
    Module(18, "payment_receipts", "M18/M28/M29", "F17", "Post manual debt collections with server FIFO; generated and online receipts stay read-only here.", (
        screen("index", "Phiếu thu", "Find manual, automatic and online sources with method/status filters.", "Đại lý|Loại thu|Phương thức|Số tiền", "Generated read-only|Empty|Canceled"),
        screen("editor", "Lập phiếu thu công nợ", "Choose same dealer, positive amount, method and business date.", "Đại lý|Ngày nghiệp vụ|Tiền thu|Phương thức", "Future invoice|Overcollection|Validation"),
        screen("review", "Xác nhận tiền đã thu", "Review real cash evidence; allocation is automatic FIFO.", "Số tiền|Dư nợ đủ điều kiện|Người xác nhận", "Insufficient eligible debt|412|Unknown result"),
        screen("detail", "Chi tiết phiếu thu", "Show posted money and read-only allocations to issues.", "Phiếu thu|Tiền thực nhận|Phân bổ FIFO|Dư nợ sau", "Auto receipt immutable|Correction|Cancel blocked"),
    ), "Never offer manual selection or mutation of invoice allocations."),
    Module(19, "upfront_payments", "M19", "F18", "Verify received upfront cash for the exact READY issue revision; recognize stranded money separately.", (
        screen("index", "Khoản trả ngay", "Show waiting verification and VERIFIED-but-unreceipted work.", "Phiếu xuất|Phiên bản|Số tiền khai báo|Trạng thái", "Waiting|Verified unreceipted|Consumed"),
        screen("verify", "Xác nhận tiền trả ngay", "Record evidence, actual receipt instant, method and matching revision.", "Phiếu chờ xuất|Số tiền thực nhận|Thời điểm nhận|Phương thức", "Wrong revision|No actual money|Permission denied"),
        screen("detail", "Chi tiết xác nhận", "Trace one evidence item to auto receipt or separate receipt.", "Phiên bản|Đã nhận|Phiếu thu liên kết|Trạng thái", "VERIFIED|CONSUMED|RECEIVED_SEPARATELY"),
        screen("receive-separately", "Ghi nhận tiền riêng", "Handle verified money when delivery fails; issue remains a separate task.", "Tiền đã nhận|Phiếu thu riêng|Công nợ/ dư có", "Issue blocked|Already consumed|Uncertain result"),
    ), "VERIFIED is not a posted receipt; failed shipment must not make cash disappear."),
    Module(20, "receivables", "M20", "F19", "Read receivables, invoice balances and allocation provenance without client-side FIFO edits.", (
        screen("index", "Công nợ", "Search dealer balances with current asOf time.", "Mã đại lý|Nợ hiện tại|Hạn mức|Còn lại", "No debt|Terminated dealer|Forbidden"),
        screen("agency", "Công nợ đại lý", "Display separate debt, credit, reservation and headroom.", "Nợ phải thu|Dư có|Đang dành|Khả dụng", "Simultaneous debt and credit|Unavailable|Stale"),
        screen("invoice", "Công nợ phiếu xuất", "Compare original remainder with current outstanding and settlement sources.", "Lúc xuất còn|Đã phân bổ|Còn nợ hiện tại", "SETTLED by return|SETTLED by credit|Partial"),
        screen("statement", "Sổ công nợ", "Review opening, dated changes, closing and effective history.", "Từ ngày|Đến ngày|Số dư đầu|Biến động", "No movements|Backdated replay|Correction"),
        screen("allocations", "Phân bổ thanh toán", "Inspect source receipt/credit and target issue with current/reversed legs.", "Nguồn tiền|Phiếu được trừ|Ngày nghiệp vụ|Hiệu lực", "Reversed|Auto upfront|No edit"),
    ), "The agency balance resource belongs to F20 and is reused—not duplicated—by F24."),
    Module(21, "stock_adjustments", "M21/M28/M29", "F16", "Post independent signed stock changes with a reason; count-generated adjustments are immutable.", (
        screen("index", "Điều chỉnh tồn", "Search independent and count-generated adjustments.", "Phiếu|Nguồn|Lý do|Trạng thái", "Count generated read-only|No results|Cancelled"),
        screen("editor", "Lập phiếu điều chỉnh", "Enter nonzero signed quantity; no sale or monetary fields.", "Ngày nghiệp vụ|Mặt hàng|Chênh lệch +/-|Lý do", "Zero delta|Historical negative stock|Unit precision"),
        screen("review", "Xác nhận điều chỉnh", "Check affected products and server-authoritative new balance.", "Chênh lệch|Tồn dự kiến|Lý do", "Permission denied|412|Historical blocker"),
        screen("detail", "Chi tiết điều chỉnh", "Link to count if generated and show no monetary effects.", "Nguồn|Phiên bản|Biến động|Tồn sau", "Confirmed count immutable|Corrected independent|Cancelled"),
    ), "Adjustments do not create sales or change purchase-price source."),
    Module(22, "stock_counts", "M22", "F21", "Capture book/last-entry snapshot, record physical observations and reconcile stale counts.", (
        screen("index", "Kiểm kê kho", "Find draft and confirmed counts.", "Mã kiểm kê|Thời điểm đếm|Số mặt hàng|Trạng thái", "No counts|Confirmed immutable|Filtered"),
        screen("editor", "Ghi số kiểm kê", "Enter physical observed quantity beside captured book quantity.", "Mặt hàng|Sổ kho|Đếm thực tế|Chênh lệch", "Zero difference retained|Stale snapshot|Invalid fraction"),
        screen("review", "Xác nhận kiểm kê", "Require extra adjustment-post grant only when any difference is nonzero.", "Số dòng|Chênh lệch|Phiếu điều chỉnh", "Missing extra grant|Stale movement|No adjustment for zero"),
        screen("recount", "Đếm lại sau biến động", "New physical observations for every existing product, not silent rebasing.", "Dòng cũ|Biến động mới|Số đếm mới", "Same final stock yet stale|Incomplete recount|412"),
        screen("detail", "Biên bản kiểm kê", "Show immutable observations and generated adjustment link.", "Sổ kho đã chụp|Thực đếm|Phiếu điều chỉnh", "Zero-difference|Confirmed|No deletion"),
    ), "An intervening movement is stale even if the quantity returns to its original value."),
    Module(23, "sales_returns", "M23/M28/M29", "F20", "Receive actual goods against a posted sale at original price, reducing debt and/or creating credit.", (
        screen("index", "Hàng trả lại", "Search posted return events and their originating sale.", "Phiếu trả|Phiếu xuất gốc|Ngày nhận thực tế", "No returns|Partial|Corrected"),
        screen("source", "Chọn phiếu xuất gốc", "Inspect originally sold and already returned quantities by line.", "Mã phiếu xuất|Mặt hàng|Còn có thể trả", "Origin not POSTED|Fully returned|No access"),
        screen("editor", "Ghi nhận hàng trả", "Enter actual received quantities with preserved original price.", "Ngày nhận hàng|Dòng gốc|Số lượng trả|Lý do", "Over-return|Zero monetary rounded line|Invalid fraction"),
        screen("review", "Xác nhận nhận hàng", "Explain stock increase, debt reduction and separate new credit.", "Kho tăng|Nợ giảm|Dư có tạo", "No automatic refund|Dependent blocker|412"),
        screen("detail", "Chi tiết phiếu trả", "Show real return date, origin and linked financial effects.", "Nguồn bán|Giá gốc|Nợ trừ|Dư có phát sinh", "Partial history|Correction|Zero-value line"),
    ), "A valid zero-VND line still changes returned quantity and inventory."),
    Module(24, "agency_credit", "M24", "F23", "Inspect credit origins, lots and reservations separately from receivables.", (
        screen("index", "Dư có đại lý", "Reuse the F20 balance and distinguish total, reserved and available money.", "Dư có|Đang dành hoàn|Có thể dùng", "Debt and credit coexist|Unavailable|Denied"),
        screen("lots", "Các lô dư có", "List sourced credit lots, spending and reservations.", "Nguồn tiền|Phát sinh|Đã dùng|Đang dành", "No credit|Partially reserved|Expired source"),
        screen("lot", "Nguồn một lô dư có", "Trace return/online excess to original payment receipt.", "Phiếu nguồn|Phiếu gốc|Số còn lại", "Original online source|Multi-receipt provenance|Forbidden"),
        screen("statement", "Sổ dư có", "Review dated creation, application and refund effects.", "Ngày nghiệp vụ|Loại biến động|Số dư sau", "Correction replay|Pending reservation|Historical/current difference"),
    ), "Available credit excludes live reservations; later F27 refund states require regression."),
    Module(25, "credit_applications", "M25/M28/M29", "F24", "Apply available same-dealer credit to eligible debt with server FIFO and no new cash.", (
        screen("index", "Bù trừ dư có", "Search application drafts and posted offsets.", "Phiếu|Đại lý|Số bù|Trạng thái", "No applications|Cancelled|Read-only"),
        screen("editor", "Lập phiếu bù trừ", "Choose dealer, date and amount only within unreserved credit/debt.", "Đại lý|Ngày nghiệp vụ|Số bù trừ", "Reserved funds|Insufficient debt|Validation"),
        screen("review", "Xác nhận bù trừ", "Review available sources and FIFO result without creating a receipt.", "Dư có khả dụng|Nợ đủ điều kiện|Tiền thu mới: 0đ", "Credit race|412|No cash"),
        screen("detail", "Chi tiết bù trừ", "Trace consumed lots and settled issues.", "Phiếu nguồn|Phiếu nợ|Số bù|Tiền thu", "Corrected|Source reserved|Posted immutable"),
    ), "Credit application is not new cash; posted correction/cancel full-gated at M29."),
    Module(26, "online_payments", "M26", "F24", "Initiate sandbox collection and reconcile only server-verified payment evidence.", (
        screen("index", "Thanh toán trực tuyến", "Find pending, success, failed and expired attempts.", "Đại lý|Số tiền|Mã giao dịch|Trạng thái", "Pending|Failed/expired|Late success"),
        screen("create", "Tạo thanh toán", "Start one bounded intent against current debt and supported sandbox.", "Đại lý|Số tiền|Cổng thử nghiệm", "Unsupported provider|Amount exceeds debt|Uncertain setup"),
        screen("checkout", "Mở trang thanh toán", "Present checkout only when server supplies a trusted URL.", "Số tiền|Địa chỉ thanh toán|Hạn", "202 setup pending|URL unavailable|Return without proof"),
        screen("return", "Chờ xác nhận từ cổng", "Browser return is not verified money; poll existing payment.", "Mã giao dịch|Kiểm tra trạng thái", "Still pending|Return failed|Reconcile"),
        screen("detail", "Kết quả thanh toán", "Show full verified receipt and any excess dealer credit.", "Tiền thực nhận|Đã trừ nợ|Dư có tạo|Phiếu thu", "Late SUCCESS|Duplicate callback|Failed"),
        screen("events", "Sự kiện thanh toán", "Read authorized normalized event summaries only.", "Thời gian|Nguồn|Trạng thái xác minh", "Invalid signature hidden|Repeated event|No events"),
    ), "The provider webhook is server-to-server, not a frontend action; no return URL proves SUCCESS."),
    Module(27, "refunds", "M27", "F25, F26", "Return actual money from a single source receipt while preserving reservation and attempt evidence.", (
        screen("index", "Hoàn tiền", "Find document status and independent attempt status.", "Phiếu hoàn|Nguồn thu|Đang dành|Kết quả", "DRAFT yet reserved|UNKNOWN|Paid"),
        screen("editor", "Lập yêu cầu hoàn", "Select one eligible original receipt, amount and method.", "Phiếu thu nguồn|Ngày dự kiến|Số tiền|Phương thức", "Two sources need two refunds|Source exhausted|Insufficient credit"),
        screen("review", "Dành dư có để hoàn", "Reserve available funds before manual or provider payout.", "Dư có hiện tại|Đang dành|Khả dụng sau", "Race with offset|Missing permission|412"),
        screen("detail", "Chi tiết phiếu hoàn", "Show paid, reserved, attempt and document states independently.", "Phiếu nguồn|Đã hoàn|Đang dành|Trạng thái xử lý", "DRAFT noneditable|Paid immutable|Safe cancel"),
        screen("attempt", "Lần thử hoàn trực tuyến", "Inspect PENDING, UNKNOWN, FAILED or SUCCESS with reconciliation.", "Mã lần thử|Kết quả|Thời điểm đối soát", "UNKNOWN retains reservation|Timeout|Verified failure"),
        screen("confirm-paid", "Xác nhận đã hoàn tiền", "Confirm observed cash/bank payout before committing financial effect.", "Bằng chứng thực trả|Số tiền|Ngày trả thực tế", "Unpaid|Double confirmation|Wrong source"),
        screen("retry", "Tạo lần thử mới", "Only after verified failure and released reservation, form a fresh attempt.", "Kết quả thất bại|Nguồn|Số tiền", "UNKNOWN blocks retry|New revision|No second payout"),
    ), "UNKNOWN keeps credit reserved; the source requestOnlineRefund operation has no reason body."),
    Module(28, "document_history", "M28", "F14, F22, F27", "Search documents and immutable revisions; print historical snapshots through authenticated requests.", (
        screen("index", "Tra cứu chứng từ", "Cross-kind search by code/date/status subject to kind permissions.", "Mã phiếu|Loại|Ngày nghiệp vụ|Trạng thái", "Kind denied|No matches|Historical"),
        screen("revisions", "Lịch sử phiên bản", "Track DRAFT/READY/POSTED revisions under a stable document number.", "Số phiên bản|Lý do|Người sửa|Thời gian", "No edit of old revision|Canceled|Corrected"),
        screen("revision", "Nội dung phiên bản cũ", "Show contact and product snapshots as they were recorded.", "Liên hệ lúc ghi|Dòng hàng|Tổng tiền", "Master renamed|Financial no lines|Immutable"),
        screen("compare", "So sánh hai phiên bản", "Display old/new values and effect history without claiming prospective dry run.", "Trước|Sau|Ngày gốc|Lý do", "Original-period changes|Reversal|Permission denied"),
        screen("print", "Bản in chứng từ", "Select revision and HTML/PDF, preserving DRAFT/CANCELLED marker.", "Phiên bản|Định dạng|Dấu trạng thái", "401/403|PDF unavailable|Historical snapshot"),
    ), "Bearer-protected print requires fetch/blob or authenticated HTML handling, not a bare hyperlink."),
    Module(29, "document_corrections", "M29", "F28", "Coordinate full replacement and cancellation within six owning document types, preserving money and history.", (
        screen("index", "Sửa sai và hủy chứng từ", "Choose a source document and correct-vs-real-event path.", "Loại phiếu|Số phiếu|Ngày gốc|Lý do", "Not a return|Not a refund|No generic endpoint"),
        screen("stock-receipt", "Sửa phiếu nhập", "Recheck every historical stock checkpoint and price-source dependency.", "Dòng cũ|Dòng thay thế|Lý do", "Past stock negative|New price source|Cancel blocked"),
        screen("stock-issue", "Sửa phiếu xuất", "Preserve real upfront money, return dependencies and FIFO.", "Phiên bản cũ|Phiên bản mới|Tiền đã nhận", "Separate received money|Return affected|Debt limit"),
        screen("payment-receipt", "Sửa phiếu thu", "Replay valid allocations without erasing actual cash.", "Khoản thu gốc|Giá trị đúng|Lý do", "Insufficient future debt|FIFO replay|No fake refund"),
        screen("stock-adjustment", "Sửa điều chỉnh kho", "Correct only independent adjustments, not confirmed-count evidence.", "Chênh lệch cũ|Chênh lệch đúng|Lý do", "Count-generated immutable|Historical stock|412"),
        screen("sales-return", "Sửa phiếu trả", "Preserve actual return-versus-recording distinction and later credit sources.", "Hàng gốc|Hàng thực nhận|Giá gốc", "Paid refund source|Over-return|Later rounding"),
        screen("credit-application", "Sửa phiếu bù trừ", "Protect reserved, refunded and reused credit lots.", "Dư có gốc|Số bù đúng|Lý do", "Reserved credit|Paid refund|FIFO blockers"),
    ), "Every correction/cancel retains its owning API route and needs documents.correct plus owning post rights where specified."),
    Module(30, "reports", "M30", "F29", "Build five filterable read products and authorized full-filter XLSX/PDF exports.", (
        screen("index", "Trung tâm báo cáo", "Choose a business-date period and one of five read products.", "Từ ngày|Đến ngày (không gồm)|Loại báo cáo", "No permission|Empty period|Unavailable"),
        screen("sales", "Báo cáo doanh số đại lý", "Show gross, return, net and company-gross share by code.", "Mã đại lý|Doanh số gộp|Trả hàng|Doanh số thuần", "Returns-only negative net|Gross zero|Filtered denominator"),
        screen("debt", "Báo cáo công nợ", "Break out charges and cash/return/credit decreases.", "Nợ đầu|Phát sinh|Thu tiền|Trả hàng|Bù trừ|Nợ cuối", "Decrease not cash|Backdated replay|No records"),
        screen("inventory", "Báo cáo nhập xuất tồn", "Keep quantities and units by product, without adding unlike units.", "Hàng|Đơn vị|Đầu|Nhập|Xuất|Trả|Cuối", "Zero movement|Reversed entry|Mixed units"),
        screen("product-sales", "Báo cáo bán theo mặt hàng", "Compare sold/returned quantities and exact VND values.", "Mặt hàng|Đã bán|Đã trả|Doanh số thuần", "Zero-value return line|No sales|Negative net"),
        screen("cash-credit", "Báo cáo thu chi và dư có", "Separate actual cash, refund, verified-unreceipted and period/current credit.", "Tiền thu|Tiền hoàn|Dư có cuối kỳ|Đang dành hiện tại", "UNKNOWN reserved|Historical vs current|Cash != credit"),
        screen("export", "Xuất báo cáo", "Choose XLSX/PDF for all filtered rows and show authenticated download state.", "Kỳ|Bộ lọc|Định dạng|Tổng số dòng", "406|Download failed|More than current page"),
    ), "All five report operation IDs negotiate JSON/XLSX/PDF through Accept; export is full-filter, not current-page."),
    Module(31, "dashboard", "M31/D09", "F30", "Show only sections permitted by live grants; distinguish current balances from selected-period flows.", (
        screen("index", "Tổng quan", "Summarize authorized business areas and action queues.", "Tháng|Đại lý|Doanh số|Hàng chờ", "No grants|Section omitted|Partial failure"),
        screen("sales", "Góc nhìn kinh doanh", "Focus on authorized sales trends and pending issues.", "Phiếu chờ|Doanh số|Đại lý", "Prepare-only D09 gate|Top 10|Empty month"),
        screen("warehouse", "Góc nhìn kho", "Focus on stock alerts, pending issue and count activity.", "Tồn thấp|Phiếu chờ|Kiểm kê", "Inventory-only|No disclosure|Unavailable"),
        screen("accounting", "Góc nhìn kế toán", "Show receivables and verified money not yet receipted.", "Nợ hiện tại|Thu trong kỳ|Tiền đã nhận chờ ghi", "Receipt-post-only D09 gate|No double count|Permission lost"),
    ), "D09 admission/section-permission mismatch requires a source decision before final integration."),
    Module(32, "chatbot", "M32/D10", "F31", "Offer three whitelisted read-only query types with permission-safe disambiguation.", (
        screen("index", "Trợ lý tra cứu", "Ask about dealer debt, inventory or sales without arbitrary SQL.", "Loại câu hỏi|Nội dung|Khoảng ngày", "Unsupported query|403|No history requirement"),
        screen("answer", "Kết quả tra cứu", "Explain authorized answer and link to source read product.", "Câu hỏi|Kết quả|Dữ liệu nguồn", "No inferred owner|Current asOf|No mutation"),
        screen("agency-selection", "Chọn đúng đại lý", "Present code/name/district without revealing candidate balances.", "Mã đại lý|Tên|Quận", "Duplicate names|26+ D10 gate|No broadened grant"),
        screen("clarification", "Bổ sung thông tin", "Ask only for missing agency/product/period fields.", "Mã đại lý|Mặt hàng|Từ ngày|Đến ngày", "Missing context|Unsupported|Read denied"),
    ), "D10 candidate paging is not yet safe for chatbot-only grants; no invented cursor in the current contract."),
)


EXTRA_CONSUMERS = {
    "document_workbench": {"listDocumentRevisions", "getDocumentRevision", "listDocumentLines", "createDocumentLine", "getDocumentLine", "replaceDocumentLine", "deleteDocumentLine"},
    "upfront_payments": {"postStockIssue", "replacePendingStockIssue", "getStockIssue"},
    "agency_credit": {"getAgencyBalance"},
    "document_corrections": {"correctStockReceipt", "cancelStockReceipt", "correctStockIssue", "cancelStockIssue", "correctPaymentReceipt", "cancelPaymentReceipt", "correctStockAdjustment", "cancelStockAdjustment", "correctSalesReturn", "cancelSalesReturn", "correctCreditApplication", "cancelCreditApplication"},
}

SYNTHETIC = {
    "agency": "DL-101 · Đại lý Minh Phát · Quận 1",
    "product": "MH-11 · Máy lọc nước gia đình · Cái",
    "issue": "PX-301 · 10 Cái · 1.020.000đ · trả ngay 300.000đ",
    "receipt": "PT-401 · đã thu 400.000đ · phân bổ FIFO",
    "payment": "Thanh toán online 320.000đ · thu thêm 200.000đ trong lúc chờ · dư có 200.000đ",
    "return": "TH-501 · nhận lại 2 Cái · 204.000đ",
    "credit": "Dư có sau trả hàng 404.000đ · bù 150.000đ · còn 254.000đ",
    "refund": "HT-601 · dành hoàn 100.000đ · UNKNOWN: khả dụng 154.000đ",
}


def module_id(module: Module) -> str:
    return f"F{module.number:02}"


def plan_path(module: Module) -> Path:
    return DESIGN / "plan" / module.name


def wr_path(module: Module) -> Path:
    return DESIGN / "wr" / module.name


def operation_catalog() -> tuple[dict, dict]:
    source = json.loads(CONTRACT.read_text(encoding="utf-8"))
    source_ops = {}
    for path, item in source["paths"].items():
        for method, operation in item.items():
            if method in {"get", "post", "put", "patch", "delete"}:
                source_ops[operation["operationId"]] = (method.upper(), path, operation)
    backend = BACKEND_INVENTORY.read_text(encoding="utf-8")
    planned = {}
    for match in re.finditer(r"^\| (\w+) \| (GET|POST|PUT|PATCH|DELETE) \| (/[^|]+) \| (\w+) \| (M\d{2}) \| (M\d{2}) \|$", backend, re.M):
        opid, method, path, owner, first, full = match.groups()
        if opid in planned:
            raise ValueError(f"Duplicate backend operation: {opid}")
        planned[opid] = (method, path, owner, first, full)
        if opid not in source_ops or source_ops[opid][:2] != (method, path):
            raise ValueError(f"Contract mismatch for {opid}")
    if len(source_ops) != 154 or set(source_ops) != set(planned):
        raise ValueError("Target operation inventory changed; revise frontend manifest first")
    return source_ops, planned


def owned_ops(module: Module, planned: dict) -> list[str]:
    return [opid for opid, (_, _, owner, _, _) in planned.items() if owner == module.name and opid != "receiveVerifiedPaymentWebhook"]


def related_ops(module: Module, planned: dict) -> list[str]:
    owned = owned_ops(module, planned)
    extras = EXTRA_CONSUMERS.get(module.name, set())
    return owned + [opid for opid in planned if opid in extras and opid not in owned]


def permission(operation: dict) -> str:
    policy = operation.get("x-permissions", {})
    pieces = []
    if policy.get("allOf"):
        pieces.append(" & ".join(policy["allOf"]))
    if policy.get("anyOf"):
        pieces.append("(" + " | ".join(policy["anyOf"]) + ")")
    return " + ".join(pieces) if pieces else "public / bearer-only (see source security)"


def headers(operation: dict, source: dict) -> str:
    def resolve(value: dict) -> dict:
        while "$ref" in value:
            target = source
            for part in value["$ref"][2:].split("/"):
                target = target[part.replace("~1", "/").replace("~0", "~")]
            value = target
        return value

    params = [*operation.get("parameters", [])]
    result = [resolve(param)["name"] for param in params if resolve(param)["in"] == "header"]
    return ", ".join(result) or "—"


def screen_for(opid: str, module: Module) -> Screen:
    slugs = {s.slug: s for s in module.screens}
    exact = {
        "authentication": {"login": "index", "refreshTokens": "session", "logout": "session", "getCurrentUser": "session", "changePassword": "change-password", "requestPasswordReset": "forgot-password", "resetPasswordWithToken": "reset-password"},
        "document_history": {"searchDocuments": "index", "listDocumentRevisions": "revisions", "getDocumentRevision": "revision", "listDocumentLines": "revision", "getDocumentLine": "revision", "createDocumentLine": "revision", "replaceDocumentLine": "revision", "deleteDocumentLine": "revision", "printDocument": "print"},
        "online_payments": {"createOnlinePayment": "create", "getOnlinePayment": "detail", "listPaymentEvents": "events", "reconcileOnlinePayment": "detail"},
        "refunds": {"listRefundAttempts": "attempt", "getRefundAttempt": "attempt", "requestOnlineRefund": "attempt", "reconcileRefundAttempt": "attempt", "listRefundReservations": "detail", "submitRefund": "review", "confirmManualRefundPaid": "confirm-paid", "cancelUnpaidRefund": "detail"},
        "stock_counts": {"listStockCountLines": "editor", "createStockCountLine": "editor", "getStockCountLine": "editor", "updateStockCountLine": "editor", "recountStock": "recount", "confirmStockCount": "review"},
        "upfront_payments": {"verifyUpfrontPayment": "verify", "receiveUpfrontSeparately": "receive-separately", "getUpfrontConfirmation": "detail", "postStockIssue": "detail", "replacePendingStockIssue": "detail"},
        "receivables": {"getAgencyBalance": "agency", "getInvoiceBalance": "invoice", "listAgencyInvoiceBalances": "invoice", "listAgencyReceivableEntries": "statement", "listDocumentAllocations": "allocations"},
        "agency_credit": {"getAgencyBalance": "index", "listAgencyCreditLots": "lots", "getCreditLot": "lot", "listAgencyCreditEntries": "statement"},
        "dashboard": {"getDashboard": "index"},
        "chatbot": {"queryChatbot": "index"},
    }.get(module.name, {})
    if opid in exact and exact[opid] in slugs:
        return slugs[exact[opid]]
    if opid.startswith("get") and "detail" in slugs:
        return slugs["detail"]
    if opid.startswith("list") or opid.startswith("search"):
        return slugs["index"]
    if opid.startswith("create") or opid.startswith("update") or opid.startswith("replace"):
        for slug in ("editor", "create", "goods-editor", "grant", "verify"):
            if slug in slugs:
                return slugs[slug]
    if opid.startswith("post") or opid.startswith("confirm") or opid.startswith("submit"):
        return slugs.get("review", slugs["index"])
    if opid.startswith("terminate") and "terminate" in slugs:
        return slugs["terminate"]
    if opid.startswith("set") and "grant" in slugs:
        return slugs["grant"]
    if opid.startswith("reset") and "password-reset" in slugs:
        return slugs["password-reset"]
    if opid.startswith("correct") or opid.startswith("cancel"):
        return slugs.get("detail", slugs["index"])
    if module.name == "reports":
        for prefix, slug in (("getSales", "sales"), ("getDebt", "debt"), ("getInventory", "inventory"), ("getProductSales", "product-sales"), ("getCashAndCredit", "cash-credit")):
            if opid.startswith(prefix):
                return slugs[slug]
    return slugs["index"]


def relative_screen(module: Module, target: Screen) -> str:
    return f"../../wr/{module.name}/{target.slug}.html"


def rows_for(module: Module, source_ops: dict, planned: dict) -> str:
    lines = []
    owned = set(owned_ops(module, planned))
    source = json.loads(CONTRACT.read_text(encoding="utf-8"))
    for opid in related_ops(module, planned):
        method, path, operation = source_ops[opid]
        first, full = planned[opid][3:]
        target = screen_for(opid, module)
        lines.append(f"| `{opid}` | {method} `{path}` | {permission(operation)} | {headers(operation, source)} | {first}/{full} | {'Owner' if opid in owned else 'Consumer'} | [{target.title}]({relative_screen(module, target)}) |")
    return "\n".join(lines) or "| — | — | — | — | — | Shared UI, no owned operation | [Pattern gallery](../../wr/frontend_foundations/index.html) |"


def write_generated(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def module_docs(module: Module, source_ops: dict, planned: dict) -> None:
    mid = module_id(module)
    base = plan_path(module)
    ops = related_ops(module, planned)
    screen_lines = "\n".join(f"| {mid}-SCR{i:02} | [{item.title}]({relative_screen(module, item)}) | {item.purpose} | {item.states} |" for i, item in enumerate(module.screens, 1))
    rows = rows_for(module, source_ops, planned)
    def doc(name: str, text: str) -> None:
        write_generated(base / f"{name}.md", f"# {mid} — {module.name}: {name.title()}\n\n**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.\n**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).\n\n{text}")

    doc("PLAN", f"""## Goal and scope

{module.mission} This module owns its feature under `ui/src/features/{module.name}/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** {module.prerequisites}. **Backend gates:** {module.backend}. The rendered [module wireframe](../../wr/{module.name}/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
{screen_lines}

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
{rows}

{('This is a shared infrastructure/shell slice; it has no independently owned business operation. Consume only the named health/auth operations and source-backed permissions.' if not ops else 'Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.')}

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

{module.critical} Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
""")

    doc("REQUIREMENTS", f"""## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. {module.mission}

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
""" + "\n".join(f"| {mid}-SCR{i:02} | {item.purpose} | {item.fields} | {item.states} |" for i, item in enumerate(module.screens, 1)) + f"""

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
{rows}

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- {module.critical}
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
""")

    doc("DESIGN", f"""## Proposed boundaries

Build the feature as `ui/src/features/{module.name}/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

""" + "\n".join(f"- **{mid}-SCR{i:02} [{s.title}]({relative_screen(module, s)}):** {s.purpose} Visible fields: {s.fields}. Model explicitly: {s.states}." for i, s in enumerate(module.screens, 1)) + f"""

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

{module.critical} Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/{module.name.replace('_', '-')}`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
""")

    test_rows = "\n".join(f"| {mid}-FN{i:02} (proposed {s.slug} page/adapter) | {mid}-SCR{i:02} | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |" for i, s in enumerate(module.screens, 1))
    op_test_rows = "\n".join(f"| {mid}-OP{i:02} | `{opid}` | {screen_for(opid, module).slug}.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |" for i, opid in enumerate(ops, 1)) or f"| {mid}-OP00 | No owned business operation | index.html | Preserve starter health and shared state | Unavailable/denied | Timeout/abort |"
    doc("TESTS", f"""## Layers and execution policy

Planning cases are **not executable test results**. On implementation, replace proposed responsibilities with every actual component, hook, validator, adapter, callback and helper; add their exact test nodes. F01 chooses locked Vitest/Testing Library/MSW/Playwright/a11y tooling. Require meaningful success, failure and boundary tests for each actual behavior and **100% statements and branches per newly owned behavioral file**, with no exclusions hiding reachable branches; use case assertions independently of coverage. Missing or skipped required cases keep the gate open.

## Proposed responsibility register

| Proposed responsibility | Screen | Success | Failure | Boundary/async | Layer |
| --- | --- | --- | --- | --- | --- |
{test_rows}

## Operation/transport cases

| Test ID | Source operation | Paired page | Successful source behavior | Failure/recovery | Boundary |
| --- | --- | --- | --- | --- | --- |
{op_test_rows}

{module.critical} For `anyOf`, exercise every single grant; for `allOf`, remove each grant independently; test conditional rights, next-request permission loss and deep links. Keyed actions test stable same-key retry versus changed payload; versioned actions test concurrent parent edits and preserved local form content. Numeric tests include max-ID, exact large VND and quantities; date tests include Vietnam-midnight and half-open ranges. Remote fixtures must validate against the source schema, including failure variants; mocks cannot prove database rollback or provider success.

## Required integrated evidence

Mocked browser scenarios exercise valid navigation, loading, forbidden, conflict, uncertain outcome, keyboard/focus and narrow viewport. Live scenarios wait for **Full published API, persisted-kind compatibility and backend evidence**; use real browser/network in an isolated backend environment. Re-check later correction/refund/provider consumers where this module's reads change. Record exact commands, cases, coverage JSON, environment and screenshots/results in VERIFICATION. Existing `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` run from `ui/`; tests/coverage/E2E scripts are proposed until F01 installs them.
""")

    doc("CHECKLIST", f"""## Paired planning and wireframes

""" + "\n".join(f"- [x] {mid}-SCR{i:02}: [{s.title}]({relative_screen(module, s)}) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION." for i, s in enumerate(module.screens, 1)) + f"""
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

""" + "\n".join(f"- [ ] {mid}-FN{i:02}: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded." for i in range(1, len(module.screens) + 1)) + "\n" + "\n".join(f"- [ ] {mid}-OP{i:02} `{opid}`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass." for i, opid in enumerate(ops, 1)) + f"""
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** {module.critical}
""")

    doc("VERIFICATION", f"""## Current evidence boundary

This module's Markdown and linked static HTML were prepared by `python -B openwiki/frontend-design/build_frontend_design.py`. The program-wide [verification log](../full_frontend/VERIFICATION.md) records exact checks **actually run** after generation. Static HTML illustrations are not frontend component tests, real API responses or proof of money movement. No module-specific implementation, typecheck, test coverage, deployed backend integration or browser evidence is claimed here.

## Implementation evidence to record

| Phase | Actual symbols/revision | Source operations/Full backend gate | Exact command, workdir and result | Browser viewport/accessibility/fixture | Blockers |
| --- | --- | --- | --- | --- | --- |
| Planning | {mid}-SCR01–{mid}-SCR{len(module.screens):02}, [module HTML](../../wr/{module.name}/index.html) | {module.backend}; business routes remain future until published | See full_frontend/VERIFICATION; no feature tests | Synthetic static wireframes; review pending | {module.critical} |

On implementation, append concrete case IDs, nodes, statement/branch coverage per owned behavioral file, required skips/xfails, real API/browser evidence and backend release reference. Keep planning, mocked, live-integrated and full-module status separate.
""")


def write_program(source_ops: dict, planned: dict) -> None:
    program = DESIGN / "plan/full_frontend"
    module_rows = "\n".join(f"| {module_id(m)} | [`{m.name}`](../{m.name}/PLAN.md) | {m.prerequisites} | {m.backend} | [{len(m.screens)} screens](../../wr/{m.name}/index.html) | {m.critical} |" for m in MODULES)
    operation_rows = []
    for opid, (method, path, owner, first, full) in planned.items():
        target = next((m for m in MODULES if m.name == owner), None)
        if target is None and opid != "receiveVerifiedPaymentWebhook":
            raise ValueError(f"No frontend owner for {opid}")
        disposition = "Backend-only provider callback" if opid == "receiveVerifiedPaymentWebhook" else module_id(target) + " " + target.name
        if opid == "receiveVerifiedPaymentWebhook":
            target = next(m for m in MODULES if m.name == "online_payments")
            page = "[backend-only](../online_payments/REQUIREMENTS.md)"
        else:
            page = f"[{screen_for(opid, target).title}](../../wr/{target.name}/{screen_for(opid, target).slug}.html)"
        operation_rows.append(f"| `{opid}` | {method} `{path}` | {disposition} | {first}/{full} | {page} |")
    def doc(name: str, body: str) -> None:
        write_generated(program / f"{name}.md", f"# Full frontend — {name.title()}\n\n**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.\n\n{body}")
    doc("PLAN", """## Destination

Build Agentra's complete internal, Vietnamese-first dealer operations interface using the single [target API](../../../backend-design/API/openapi.json), [Q01–Q15](../../../database-design/business_decision_making.md) and current React 19/Vite/strict-TypeScript/plain-CSS starter. There are **32 paired child plans**, **154 unique target operations** (153 employee/browser-facing; one server-to-server webhook), and actual multi-page [wireframes](../../wr/index.html). Only the seven authentication operations and two non-target health endpoints are currently mounted.

## Reading and ownership

Read REQUIREMENTS → OPERATIONS → MODULES → DESIGN → DECISIONS → EXECUTION → WIREFRAMES → TESTS → CHECKLIST → VERIFICATION, then the owning six-file child and its paired HTML. The exact API schema lives only in backend-design/API/openapi.json. Use the backend [full operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) for First/Full gates and [release handoff](../../../backend-design/plan/full_backend/EXECUTION.md) for persisted-kind/deployment readiness.

## Delivery ladder

1. Paired detailed plan + wireframes: screens, actions, source permissions and recovery states reconciled.
2. F01 shared transport/validation/routing/test tooling; F02 real authentication; F03 permission-aware shell.
3. Administrative and master-data features independently integrate their published operations.
4. Document and money flows implement mocks and shared patterns early, but live full operation gates wait for M28/M29 and backend R5 where required.
5. History/corrections then five reports, permission-aware dashboard and chatbot; backend R6 and isolated live-browser evidence.

Planning evidence, contract-mocked behavior, live integration and full-module completion are distinct. A clickable static action demonstrates a proposed interaction only; it never updates debt, stock or payment provider state.
""")
    doc("REQUIREMENTS", """## Authority and constraints

Read [BA](../../../BA/DMS_exploration.md), confirmed [decisions](../../../database-design/business_decision_making.md), [database model](../../../database-design/README.md), [single target OpenAPI](../../../backend-design/API/openapi.json), [backend full plan](../../../backend-design/plan/full_backend/PLAN.md) and [runtime UI guidance](../../../../ui/AGENTS.md). Distinguish original BA proposals from selected Q01–Q15 and API target from implemented health/auth. No dealer portal, suppliers, tax invoicing, arbitrary SQL, bulk import or generic job-center contract is present.

## Cross-module requirements

- Role names are persona examples only. `/auth/me.allowedFunctions` controls read, action and deep-link availability, including `allOf`, `anyOf`, kind-dependent and conditional grants; MANAGEMENT has no bypass.
- Preserve exact bigint/string VND/quantity/rate, numeric CatalogId, untouched password bytes, date-only business dates and Vietnam-rendered instants. Ratios and derived quote overflow follow source decisions.
- Draft, pending/READY, posted and cancelled document status differ from revision status. Returns and refunds are actual events, not historical correction shortcuts. One document number may have multiple immutable revisions.
- Server owns historical stock/debt/credit validation, FIFO and provenance. UI distinguishes dealer debt, total credit, reserved and available credit and cash actually received versus declared, verified and receipted upfront evidence.
- Keep source ETags with full aggregate representations; parent ETags for lines; scoped stable Idempotency-Key for only source-keyed actions; 412/428, 409, 429 and unknown outcomes have distinct recovery.
- Reports use half-open dates, full-filter totals and content-negotiated XLSX/PDF; no unlimited client-side data fetch. Browser return URLs do not prove online payment success.
- Each F01–F32 slice has substantive linked screens, operation/grant/state inventory, success/failure/boundary tests, mocked versus real-browser evidence and later integration/deferred gates.

## Unresolved source decisions

Backend D07 sandbox deployment, D09 dashboard admission, D10 chatbot candidate continuation and D16 derived quote need explicit source/environment resolution; D17 persisted future-kind support controls publication. Lookup permissions for prepare-only flows and the bodyless refund retry reason require a reviewed contract/UX resolution. Wireframes illustrate the question and never silently add endpoint parameters or grants.
""")
    doc("OPERATIONS", """## Unique source operation → frontend disposition

Method/path and First/Full are indexed from the reviewed [backend inventory](../../../backend-design/plan/full_backend/OPERATIONS.md); consult the [OpenAPI](../../../backend-design/API/openapi.json) for current schemas, security, parameter requirements and content negotiation. One operation appears once below. F14/F19/F24/F29 consumer relationships are indexed in their owning child REQUIREMENTS; one shared agency balance and one provider-only webhook are not duplicated. Full gate is a lower bound, not automatic live availability.

| operationId | Method and path | Frontend owner/disposition | Backend First/Full | Primary wireframe |
| --- | --- | --- | --- | --- |
""" + "\n".join(operation_rows))
    doc("MODULES", """## Paired module work packages

For each row, finish the six-file child and its linked multi-page wireframes as one planning deliverable. Independently author different module pairs after shared CSS/fixtures; implementation still follows the frontend dependency graph. Each child registers actual symbols during code implementation; plans do not mark frontend runtime behavior as tested.

| Slice | Child plan | Frontend prerequisites | Backend gate | Wireframes | Cross-slice obligation |
| --- | --- | --- | --- | --- | --- |
""" + module_rows + "\n\nFull operational user-facing handoff for document line/cancel/history/corrections depends on backend R5; later read products depend on R6. F20 owns getAgencyBalance; F24 consumes it. F29 supplies orchestration UI embedded within each document kind; no generic correction API exists.\n")
    doc("DESIGN", """## Application ownership

Keep React app composition, browser routing and guards in `ui/src/app/`; shared native fetch, schema validation, session, exact formatting, cache-key and capability infrastructure in `ui/src/lib/`; visual primitives in `ui/src/components/ui/`; module components/hooks/adapters under `ui/src/features/<feature>/`. F01 proposes React Router, TanStack Query, openapi-typescript-generated types, source-derived Ajv Draft 2020-12 + format validation, Vitest/Testing Library/MSW/Playwright; select locked versions and validate actual source composition before F01 code. Preserve plain CSS and StrictMode cleanup.

### Session policy: user-selected current tab

Store access JWT in memory and refresh token plus minimal session metadata in `sessionStorage` for same-tab reload. Do not use persistent localStorage tokens or pretend HttpOnly cookies exist. Refresh once per tab at a time; restore profile/grants through `/auth/me`; reset fragment is consumed and removed before third-party rendering. A duplicated tab can inherit copied sessionStorage: use tab ownership detection/coordination; the copy signs in independently rather than racing a single-use refresh. App-created links use `noopener`. Browser session restoration may keep sessionStorage alive; never promise closing a browser always signs out. An uncertain lost refresh reply or unavailable coordination goes to reauthentication, not repeated refresh with a consumed token. Logout with the last known refresh lineage token, clear private cache and abort pending reads; password change/reset leads to login. Test storage-denied and one-winner races. Never log or include tokens in URLs except the specified one-time reset fragment during initial receipt.

### Transport and state

Derive request/response validators and types from the source OpenAPI rather than maintaining another API. Select correct JSON/204/binary response by status/media, map safe Error field pointers and Retry-After, keep ETag including quotes, apply If-Match/If-None-Match as declared, and generate stable intent UUID only where declared. Let query keys include identity, operation, filters/sort/cursor and resource ID; invalidate owner and dependent stock/debt/credit/history/report readers after confirmed mutations. Abort stale reads; never optimistic-post ledger values. Explicitly distinguish backend capability unavailable from failed health, empty results and denied grants. Direct cross-origin business calls also require M02 CORS request/expose headers; proxy defaults keep same-origin calls.

### Wireframe system

Static HTML pages are real content with relative links; local CSS/JS only improves scenario switching and navigation. Each file renders meaningful content without JavaScript. English technical contract IDs live in annotations; user-facing copy uses Vietnamese business terminology. Scenario balances follow the backend A01–A26 reference fixtures; no hidden computation engine or API calls.\n""")
    doc("DECISIONS", """## Frontend decisions and source blockers

| ID | Decision/status | Owning gate |
| --- | --- | --- |
| FE-D01 | **Selected by user:** clickable mid-fidelity HTML, multiple pages, coherent Vietnamese internal-app copy; no live API writes. | All paired screens. |
| FE-D02 | **Selected by user:** refresh survives same-tab reload; browser-restored storage may persist longer; copied/new tabs do not share a rotating session. | F02/browser one-winner test. |
| FE-D03 | **Proposed implementation:** React Router + TanStack Query + native fetch + OpenAPI-derived types/Ajv + Vitest/MSW/Playwright, plain CSS; lock/install/test in F01. | F01. |
| FE-D04 | **Blocked by backend D09:** dashboard route admission vs section readers. Do not silently change grants. | F31/M31 source update. |
| FE-D05 | **Blocked by backend D10:** chatbot 26+ candidates lack permission-safe continuation. Do not call broader agency API on behalf of chatbot-only reader. | F32/M32 source update. |
| FE-D06 | **Blocked by backend D16:** derived selling quote may exceed Money or round to zero; show quote/unusable-sale distinction after source policy. | F11/F12/F16/F31/F32 and M10/M11. |
| FE-D07 | **Deployment/backend D17:** seeded later kinds require replay support before earlier money writers publish; First/Full alone insufficient. | F14–F29/backend R5. |
| FE-D08 | **Contract review:** preparer-only permissions may lack necessary agency/product lookup; specify minimal authorized lookup or documented prerequisite grants. Do not invent access. | F14/F17/F18/F23/F27. |
| FE-D09 | **Contract review:** online refund retry describes reason but requestOnlineRefund currently has no requestBody; reason must not be submitted without a source change. | F27/M27. |
| FE-D10 | **Environment:** select accepted sandbox and mail/reset public URL; local fixture/demo isn't deployed provider evidence. | F02/F26/F27. |

Cross-reference the complete [backend D01–D17 register](../../../backend-design/plan/full_backend/DECISIONS.md). Proposed engineering resolution is not an implemented source contract.\n""")
    doc("EXECUTION", """## Paired authoring and implementation sequence

| Packet | Paired plan + wireframe deliverable | Publication/verification boundary |
| --- | --- | --- |
| U01 | F01–F03 and shared CSS/navigation, session/error/shell screens | F01 offline design; real M01 auth only after environment evidence. |
| U02 | F04–F07 administration/audit | M03–M06 published; next-request grants and account invalidation. |
| U03 | F08–F13 catalogues and dealer profiles | M07–M12 published; D02/D16 as relevant. |
| U04 | F14–F17 workbench/inventory/receipts/issues | M13–M19 partials; lines, full issue post/cancel await M28/M29/R5. |
| U05 | F18–F20 manual receipts/upfront/receivables | M18–M20 plus supported persisted later kinds; M29 correction paths. |
| U06 | F21–F25 stock adjustments/counts/returns/credit | M21–M25; count evidence, cumulative return price and provenance. |
| U07 | F26–F27 online and refunds | M26–M27, accepted sandbox, UNKNOWN/reconcile and reservations. |
| U08 | F28–F29 history/print/corrections | M28–M29/R5; whole operational workflow handoff. |
| U09 | F30–F32 reports/dashboard/chatbot | M30–M32/R6 plus D09/D10 resolved. |
| U10 | Cross-system release and accessibility/browser acceptance | Full operation manifest, live HTTP, all deferred reader regressions. |

Within a packet, plan and HTML authoring proceed together from a common screen/action inventory and one synthetic fixture ledger. Do not declare an individual child ready until HTML files and state anchors, links, screenshots/manual review evidence and documentation agree. Parallel authoring does not relax the [39-edge frontend dependency graph](../../GENERAL_PLAN.md#5-frontend-dependency-graph). First and Full backend gates are read from source inventory; R3/R4 are not sufficient for complete document consumer handoff.\n""")
    doc("WIREFRAMES", """## HTML experience contract

Open [wr/index.html](../../wr/index.html) locally. Each F01–F32 folder contains a real `index.html` plus topic-specific pages listed in [MODULES](MODULES.md). Relative links, one CSS file and one small local JavaScript enhancement work without API or a build. Screen markup is substantive with navigation, labels, field values, source operation badges and explicit scenario variants; JS adds filtering/scenario switching and local-only confirmation notices. Semantic headings/tables, focus styles, keyboard inputs, narrow layouts and textual statuses are required.

The [linked business flow index](../../wr/flows.html) covers verified upfront money, failed shipment, FIFO settlement, online excess credit, returns versus refunds, UNKNOWN reservations, stale count, historical blocker, correction replay and full-filter export. A page's synthetic action does not cause a server mutation. Look for the prototype notice at the top of every screen.

One screen/action/operation may have multiple states in a single page or separate exception page; every listed state must be reachable through explicit anchors or scenario links. Shared state gallery F01 does not replace domain-specific exception content. F29's six pages present correction in its owning document context. No bulk import, generic job center, dealer login, tax invoice or manual FIFO allocation screen is included because the source does not provide those operations.\n""")
    doc("TESTS", """## Planning and wireframe verification

Run the [read-only frontend validator](validate_plan.py) after generating artifacts. It must check all 32 six-file children and matching index/multi-page HTML, 154 unique operation dispositions, correct method/path/gates against source, cross-links/anchors/assets, no missing child reference and no checked implementation gates without evidence. Browser-check representative narrow/desktop widths, keyboard interactions, color/text status, links/scenarios and contrast. These are artifact checks—not claims that backend money, database rollback or provider behavior passed.

## Future application tests

F01 installs locked tools: Vitest and Testing Library/user-event for actual symbols; source-derived MSW fixtures with response validation; Playwright for mocked and isolated real HTTP browser scenarios; accessibility audits. Declare **100% statement/branch coverage per newly owned behavioral file**, with meaningful success/failure/boundary for every completed symbol and no exclusions masking failure. Cover actual request method/path/headers/body/response media, 204, binary errors, exact strings/IDs, cursor/filter cancellation, If-Match/If-None-Match, keyed unknown retries, auth one-winner and permission truth tables. Tests against mocked fixtures do not prove backend persisted state.

Use backend [A01–A26 acceptance scenarios](../../../backend-design/plan/full_backend/TESTS.md#3-system-acceptance-scenarios) as cross-system references, especially A04–A20 for stock/settlement/refund/correction and A21–A26 for read products/price/replay. Require real browser/backend evidence for live closure; do not run on populated production/demo data as destructive fixture. Record actual nodes/commands/results, per-file branch coverage, environment, screenshots and missing prerequisites in the owning VERIFICATION.\n""")
    checklist = "\n".join(f"- [x] {module_id(m)} paired [child plan](../{m.name}/PLAN.md) and [wireframe index](../../wr/{m.name}/index.html) prepared; interactive/browser review and application gates remain open." for m in MODULES)
    doc("CHECKLIST", f"""## Planning and paired HTML inventory

{checklist}
- [ ] Source/operation/HTML-link consistency validator and manual desktop/mobile/keyboard prototype review recorded in VERIFICATION.

## Runtime and release (open)

- [ ] F01 dependencies/test harness installed with npm lockfile and actual behavior cases.
- [ ] F02 real auth/browser rotation, reset and permission-refresh checks pass.
- [ ] Every business action's backend full publication and D17 persisted-kind/deployment gate verified independently of mocked pages.
- [ ] All F03–F32 child actual-symbol success/failure/boundary, accessibility, branch coverage, mocked and isolated live browser cases pass.
- [ ] M28 line/print and M29 correction/cancellation deferred cases integrated into owning goods/money modules (backend R5).
- [ ] D07/D09/D10/D16 and lookup/retry contract choices resolved in single source before affected final integration.
- [ ] Five reports and full exports, dashboard and chatbot production-read gates plus cross-reader invalidation pass (backend R6).
- [ ] General Plan/Checklist, child verification, root/UI guidance and production build evidence aligned before release.

No check in the runtime section is closed by generating Markdown or HTML.\n""")
    doc("VERIFICATION", """## Planning evidence

The authored Markdown and HTML are generated from `openwiki/frontend-design/build_frontend_design.py` and the existing target OpenAPI/backend operation inventory. Run `python -B openwiki/frontend-design/build_frontend_design.py` to refresh, then `python -B openwiki/frontend-design/plan/full_frontend/validate_plan.py` to check the output. Record exact run date, commands/results and browser findings below **after executing them**. This document never equates static clicks with live integration.

| Check | Result |
| --- | --- |
| Generation / read-only validator / git diff --check | Run exact checks below after final regeneration; record results in the maintained evidence record following execution. |
| Manual desktop/mobile/keyboard wireframe review | Pending; specify browser/viewport and observed states. |
| Frontend application lint/typecheck/build/tests/coverage | Not run for documentation-only output; no new UI behavior implemented. |
| Backend business HTTP, PostgreSQL, provider and real browser | Not run; backend business routes not implemented. |

Update this register with real outputs and separately link each child VERIFICATION when implementation begins. Required skipped/xfail/unrun tests keep their runtime gates open.\n""")


def field_markup(field: str, index: int, screen_slug: str) -> str:
    label = escape(field)
    ident = f"f{index}"
    lower = field.casefold()
    if "trạng thái" in lower or "phương thức" in lower or "loại câu hỏi" in lower or "định dạng" in lower:
        options = ("Tất cả", "Nháp", "Chờ xử lý", "Đã ghi sổ") if "trạng thái" in lower else ("Chọn", "Tiền mặt", "Chuyển khoản", "Sandbox")
        control = f'<select id="{ident}" name="{ident}">' + "".join(f"<option>{escape(o)}</option>" for o in options) + "</select>"
    elif "ngày" in lower and ("từ" in lower or "đến" in lower):
        control = f'<input id="{ident}" name="{ident}" type="date" value="2026-09-01">'
    elif "email" in lower:
        control = f'<input id="{ident}" name="{ident}" type="email" value="minhphat@daily.vn">'
    elif "mật khẩu" in lower:
        control = f'<input id="{ident}" name="{ident}" type="password" autocomplete="off" placeholder="Nhập mật khẩu">'
    elif "lý do" in lower or "nội dung" in lower:
        control = f'<textarea id="{ident}" name="{ident}" rows="2" placeholder="Nhập {label.casefold()}"></textarea>'
    else:
        value = "DL-101" if "đại lý" in lower else "100000" if "tiền" in lower or "dư" in lower or "giá" in lower or "hạn mức" in lower else ""
        control = f'<input id="{ident}" name="{ident}" type="text" value="{escape(value)}" placeholder="Nhập hoặc tra cứu {label.casefold()}">'
    return f'<div class="field"><label for="{ident}">{label}</label>{control}<small>Dữ liệu minh họa; quy tắc nhập thực tế theo API gốc.</small></div>'


def fixture_for(module: Module) -> list[tuple[str, str]]:
    keys = ("agency", "product", "issue", "receipt", "payment", "return", "credit", "refund")
    if module.number <= 13:
        keys = ("agency", "product", "issue")
    elif module.number <= 17 or module.name in {"inventory", "stock_adjustments", "stock_counts"}:
        keys = ("product", "agency", "issue", "return")
    elif module.number <= 20:
        keys = ("agency", "issue", "receipt", "payment")
    elif module.number <= 25:
        keys = ("agency", "issue", "return", "credit")
    return [(key, SYNTHETIC[key]) for key in keys]


FOCUSED_VIEWS = {
    ("frontend_foundations", "tables"): """<section class="panel focused"><h2>Danh sách dạng con trỏ</h2><div class="table-scroll"><table><thead><tr><th>Mã</th><th>Tên</th><th>Trạng thái</th></tr></thead><tbody><tr><td>DL-101</td><td>Đại lý Minh Phát</td><td>Đang hoạt động</td></tr><tr><td>DL-229</td><td>Đại lý Minh Phát</td><td>Đang hoạt động · Quận 7</td></tr></tbody></table></div><p><a href="#state-02">Trang tiếp theo →</a> là opaque cursor khi <code>hasMore=true</code>, không phải trang 2/10. Đổi bộ lọc xóa cursor cũ.</p></section>""",
    ("application_shell", "navigation"): """<section class="panel focused"><h2>Quyền theo chức năng, không theo tên nhóm</h2><div class="metric-row"><div><small>Kinh doanh</small><strong>Lập phiếu xuất</strong></div><div><small>Kho</small><strong>Xác nhận xuất</strong></div><div><small>Kế toán</small><strong>Xác nhận tiền</strong></div><div><small>Nhóm tự tạo</small><strong>Theo grant hiện tại</strong></div></div><p>Đọc được nhưng không có quyền sửa: xem chi tiết bình thường, không hiển thị thao tác thay đổi. Mất quyền sau khi tải: 403 và xóa dữ liệu không được phép.</p></section>""",
    ("user_groups", "detail"): """<section class="panel focused"><h2>Chặn xóa nhóm đang được dùng</h2><div class="table-scroll"><table><thead><tr><th>Nhân viên</th><th>Trạng thái</th><th>Ảnh hưởng</th></tr></thead><tbody><tr><td>Nguyễn Thu Hà</td><td>ACTIVE</td><td>Chặn xóa</td></tr><tr><td>Lê Minh</td><td>LOCKED</td><td>Vẫn chặn xóa</td></tr></tbody></table></div><p>Nút xóa chỉ có khi nhóm thực sự không còn nhân viên và người dùng có cả <code>groups.manage</code> lẫn <code>permissions.manage</code>.</p></section>""",
    ("permissions", "index"): """<section class="panel focused"><h2>Quyền cấp cho nhóm</h2><div class="table-scroll"><table><thead><tr><th>Chức năng</th><th>Quản lý</th><th>Kinh doanh</th><th>Kho</th><th>Kế toán</th></tr></thead><tbody><tr><td>stock.issue.prepare</td><td>Được cấp</td><td>Được cấp</td><td>Không cấp</td><td>Không cấp</td></tr><tr><td>stock.issue.post</td><td>Được cấp</td><td>Không cấp</td><td>Được cấp</td><td>Không cấp</td></tr><tr><td>cash.upfront.verify</td><td>Được cấp</td><td>Không cấp</td><td>Không cấp</td><td>Được cấp</td></tr></tbody></table></div><p>Ma trận chỉ minh họa. Quyền thực tại thời điểm thao tác được đọc từ <code>/auth/me</code> và thực thi tại backend; không có quyền quản lý mặc định bất biến.</p></section>""",
    ("permissions", "grant"): """<section class="panel focused"><h2>Hai chế độ ghi quyền</h2><p>Quyền chưa có: <code>If-None-Match: *</code>; quyền đã có: <code>If-Match: "etag"</code>. Không gửi hai điều kiện cùng lúc. Thu hồi bằng <code>isAllowed=false</code>, không xóa bản ghi grant. Nếu 412, xem lại thay đổi mới trước khi lưu.</p></section>""",
    ("agency_types", "limit-conflict"): """<section class="panel focused"><h2>Các đại lý chặn hạ hạn mức</h2><div class="table-scroll"><table><thead><tr><th>Mã / tên</th><th>Tình trạng</th><th>Nợ hiện tại</th><th>Hạn mức đề xuất</th></tr></thead><tbody><tr><td>DL-101 · Minh Phát</td><td>Đang hoạt động</td><td>8.000.000đ</td><td>7.000.000đ</td></tr><tr><td>DL-229 · Minh Phát</td><td>Đã ngừng hợp tác</td><td>7.500.000đ</td><td>7.000.000đ</td></tr></tbody></table></div><p>Cả đại lý đã ngừng hợp tác vẫn có công nợ phải bảo toàn.</p></section>""",
    ("business_rules", "capacity-conflict"): """<section class="panel focused"><h2>Sức chứa hiện tại của từng quận</h2><div class="table-scroll"><table><thead><tr><th>Quận</th><th>Đại lý ACTIVE</th><th>Giới hạn đề xuất</th></tr></thead><tbody><tr><td>Quận 1</td><td>4</td><td>3 · CHẶN</td></tr><tr><td>Quận 7</td><td>5</td><td>3 · CHẶN</td></tr></tbody></table></div><p>Quy tắc là một giá trị chung, không chỉnh riêng từng quận. Chỉ lưu khi máy chủ xác nhận tất cả quận hợp lệ.</p></section>""",
    ("products", "detail"): """<section class="panel focused"><h2>Giá hiện tại là giá suy ra</h2><div class="metric-row"><div><small>Tồn hiện tại</small><strong>90 Cái</strong></div><div><small>Giá nhập nguồn</small><strong>100.000đ</strong></div><div><small>Tỷ lệ</small><strong>1.02</strong></div><div><small>Giá bán dự kiến</small><strong>102.000đ</strong></div></div><p>Giá nguồn lấy theo ngày nghiệp vụ nhập hợp lệ mới nhất, không theo thời điểm nhập liệu. Nếu chưa có nguồn hoặc giá suy ra không thể ghi bán (D16), mặt hàng vẫn xem được nhưng không chọn để xuất.</p></section>""",
    ("agencies", "detail"): """<section class="panel focused"><h2>DL-101 · Đại lý Minh Phát</h2><div class="metric-row"><div><small>Hạn mức nợ</small><strong>2.000.000đ</strong></div><div><small>Nợ hiện tại tại mốc</small><strong>320.000đ</strong></div><div><small>Dư có</small><strong>200.000đ</strong></div></div><p>Mã đại lý và quận phân biệt hai đại lý cùng tên. Nếu TERMINATED, còn thu nợ/trả hàng/hoàn tiền hợp lệ nhưng không tạo phiếu xuất mới; không có thao tác mở lại.</p></section>""",
    ("document_workbench", "goods-editor"): """<section class="panel focused"><h2>Dòng hàng của bản nháp</h2><div class="table-scroll"><table><thead><tr><th>Dòng</th><th>Mặt hàng</th><th>Số lượng</th><th>Giá tại bản nháp</th></tr></thead><tbody><tr><td>1</td><td>MH-11 · Máy lọc nước</td><td>10 Cái</td><td>Giá xem trước</td></tr></tbody></table></div><p>Một sản phẩm chỉ được xuất hiện một lần/phiên bản. Ghi dòng phải gửi ETag của <strong>phiếu cha</strong>; phiên bản READY/POSTED bất biến. Các operation dòng đầy đủ chỉ công bố khi M28 hoàn tất mọi loại chứng từ hàng.</p></section>""",
    ("inventory", "stock-card"): """<section class="panel focused"><h2>Thẻ kho MH-11 · Cái</h2><div class="table-scroll"><table><thead><tr><th>Ngày nghiệp vụ</th><th>Chứng từ</th><th>Biến động</th><th>Cuối mốc</th></tr></thead><tbody><tr><td>01/09</td><td>PN-201</td><td>+100</td><td>100</td></tr><tr><td>03/09</td><td>PX-301</td><td>−10</td><td>90</td></tr><tr><td>07/09</td><td>TH-501</td><td>+2</td><td>92</td></tr></tbody></table></div><p>Ngày sửa sai một phiếu cũ không làm biến động giả rơi vào tháng sửa; xem hiệu lực/đảo của từng dòng.</p></section>""",
    ("authentication", "index"): """<section class="panel focused"><h2>Phiên làm việc</h2><p>Nhập email và mật khẩu, sau đó tải <code>getCurrentUser</code> để nhận quyền thực tế. Sai mật khẩu không tự làm mới token. Tài khoản bị khóa không thể đăng nhập.</p><div class="notice">Sau khi làm mới tab, ứng dụng khôi phục phiên của chính tab này. Tab khác phải tự đăng nhập nếu có bản sao refresh token.</div></section>""",
    ("stock_issues", "pending"): """<section class="panel focused"><h2>Phiếu PX-301 · Chờ xuất</h2><div class="metric-row"><div><small>Giá bán đã chốt (READY)</small><strong>102.000đ / Cái</strong></div><div><small>Tổng phiếu</small><strong>1.020.000đ</strong></div><div><small>Trả ngay dự kiến</small><strong>300.000đ</strong></div></div><p>Giá nguồn mới không thay đổi phiếu READY. Phiếu chờ <strong>không giữ hàng</strong>; kho và hạn mức phải được kiểm tra lại khi xuất.</p><a href="../upfront_payments/verify.html">Kế toán xác nhận tiền →</a></section>""",
    ("stock_issues", "review"): """<section class="panel focused"><h2>Kiểm tra tại thời điểm xuất</h2><p>Ví dụ với nợ cũ 800.000đ, hạn mức 2.000.000đ: ghi xuất 1.020.000đ và phiếu thu tự sinh 300.000đ cùng giao dịch; nợ sau là 1.520.000đ.</p><div class="notice">Nếu không đủ tồn sau khi tiền đã xác nhận, phiếu chưa ghi sổ. Tiền vẫn VERIFIED; <a href="../upfront_payments/receive-separately.html">ghi nhận riêng khoản đã nhận</a>. Không bấm lại với ý định thanh toán mới.</div></section>""",
    ("stock_issues", "detail"): """<section class="panel focused"><h2>Hai số dư không giống nhau</h2><div class="metric-row"><div><small>Còn nợ tại lúc xuất</small><strong>720.000đ</strong></div><div><small>Đã thu sau xuất</small><strong>400.000đ</strong></div><div><small>Còn nợ hiện tại tại mốc này</small><strong>320.000đ</strong></div></div><p>Tất toán có thể do thu tiền, trả hàng hoặc bù trừ. <a href="../receivables/invoice.html">Xem nguồn thanh toán →</a></p></section>""",
    ("upfront_payments", "detail"): """<section class="panel focused"><h2>Bằng chứng nhận tiền</h2><div class="metric-row"><div><small>Đã nhận</small><strong>300.000đ</strong></div><div><small>Phiên bản chờ xuất</small><strong>PX-301 · v1</strong></div><div><small>Trạng thái</small><strong>VERIFIED</strong></div></div><p>VERIFIED chưa làm giảm công nợ và chưa có phiếu thu POSTED. Khi xuất thành công: CONSUMED. Khi không thể xuất: ghi nhận riêng. Không xác nhận lại cùng khoản tiền cho phiên bản khác.</p></section>""",
    ("upfront_payments", "receive-separately"): """<section class="panel focused"><h2>Hàng chưa xuất, tiền vẫn đã nhận</h2><p>Phiếu PX-301 không thể ghi xuất vì thiếu tồn. Xác nhận 300.000đ vẫn ở trạng thái VERIFIED. Kế toán nhận khoản này thành phiếu thu riêng; hệ thống phân bổ nợ đủ điều kiện FIFO và phần dư thành dư có. Phiếu xuất cần xử lý độc lập.</p><div class="notice">Không tự động hủy phiếu xuất, không ghi tiền như thể đã xuất, không dùng lại bằng chứng đó làm khoản trả ngay mới.</div></section>""",
    ("payment_receipts", "detail"): """<section class="panel focused"><h2>Phân bổ do máy chủ thực hiện</h2><div class="table-scroll"><table><caption>Ví dụ FIFO cho khoản thu 4.000.000đ</caption><thead><tr><th>Phiếu xuất</th><th>Còn nợ trước</th><th>Phân bổ</th><th>Còn nợ sau</th></tr></thead><tbody><tr><td>PX-001 · 01/06</td><td>3.000.000đ</td><td>3.000.000đ</td><td>0đ</td></tr><tr><td>PX-002 · 05/06</td><td>2.000.000đ</td><td>1.000.000đ</td><td>1.000.000đ</td></tr></tbody></table></div><p>Nhân viên không sửa từng khoản phân bổ. Ngày thu trước ngày phiếu xuất không được thanh toán phiếu đó.</p></section>""",
    ("receivables", "agency"): """<section class="panel focused"><h2>Số dư của DL-101</h2><div class="metric-row"><div><small>Nợ phải thu</small><strong>54.000đ</strong></div><div><small>Dư có</small><strong>254.000đ</strong></div><div><small>Đang dành để hoàn</small><strong>100.000đ</strong></div><div><small>Có thể sử dụng</small><strong>154.000đ</strong></div></div><p>Trạng thái minh họa ở mốc hoàn UNKNOWN. Nợ và dư có tồn tại đồng thời; không trừ gộp thành một số âm.</p></section>""",
    ("stock_counts", "recount"): """<section class="panel focused"><h2>Ảnh chụp sổ đã cũ</h2><div class="table-scroll"><table><thead><tr><th>Mốc</th><th>Tồn sổ</th><th>Biến động</th><th>Số quan sát</th></tr></thead><tbody><tr><td>Chụp ban đầu</td><td>100 Cái</td><td>—</td><td>97 Cái</td></tr><tr><td>Người khác xuất rồi nhập</td><td>100 Cái</td><td>−3, +3</td><td>Không còn hợp lệ</td></tr><tr><td>Đếm lại</td><td>100 Cái</td><td>Ảnh chụp mới</td><td>Nhập số thực đếm mới</td></tr></tbody></table></div><p>Vẫn stale dù tồn số học quay lại 100. Đếm lại toàn bộ mặt hàng hiện có, không tự điền 97 từ biên bản cũ.</p></section>""",
    ("stock_counts", "review"): """<section class="panel focused"><h2>Chênh lệch 0 vẫn là bằng chứng</h2><p>Giữ dòng đã kiểm kê khi số thực đếm bằng số sổ. Nếu tất cả dòng không chênh lệch thì xác nhận thành công nhưng không sinh phiếu điều chỉnh rỗng. Chỉ khi có chênh lệch mới cần thêm quyền <code>stock.adjustment.post</code>.</p></section>""",
    ("sales_returns", "review"): """<section class="panel focused"><h2>Trả hàng không phải hoàn tiền</h2><div class="metric-row"><div><small>Nhận lại kho</small><strong>+2 Cái</strong></div><div><small>Giá trị theo giá bán gốc</small><strong>204.000đ</strong></div><div><small>Nợ được giảm tại mốc ví dụ</small><strong>0đ</strong></div><div><small>Dư có phát sinh</small><strong>204.000đ</strong></div></div><p>Trả thực tế thuộc kỳ ngày nhận hàng, không sửa xóa doanh số bán ban đầu. Nếu khách cần tiền, <a href="../refunds/editor.html">lập hoàn tiền riêng</a>.</p></section>""",
    ("agency_credit", "index"): """<section class="panel focused"><h2>Nợ khác dư có, đang dành khác khả dụng</h2><p>Sau hoàn UNKNOWN, tổng dư có vẫn 254.000đ; đang dành 100.000đ và khả dụng 154.000đ. Không cho bù trừ hay hoàn lần hai bằng phần đã dành. Truy xuất nguồn tiền gốc trên từng lô.</p></section>""",
    ("credit_applications", "review"): """<section class="panel focused"><h2>Bù trừ không thu thêm tiền</h2><div class="metric-row"><div><small>Nợ đủ điều kiện</small><strong>204.000đ</strong></div><div><small>Dư có trước bù</small><strong>404.000đ</strong></div><div><small>Bù trừ</small><strong>150.000đ</strong></div><div><small>Tiền mới nhận</small><strong>0đ</strong></div></div><p>Nợ sau bù 54.000đ; dư có còn 254.000đ. Phân bổ tới phiếu nợ là kết quả FIFO từ máy chủ.</p></section>""",
    ("online_payments", "return"): """<section class="panel focused"><h2>Trình duyệt quay lại chưa có nghĩa đã thu</h2><div class="notice">Hiện tại: đang chờ xác minh. Không cập nhật nợ/tiền khi chỉ nhận điều hướng từ trang thanh toán. Đọc lại giao dịch online hoặc đối soát qua máy chủ để biết kết quả có chữ ký hợp lệ.</div><p>Nếu nhận SUCCESS muộn sau FAILED/EXPIRED, chỉ một phiếu thu ghi đầy đủ số tiền thật.</p></section>""",
    ("online_payments", "detail"): """<section class="panel focused"><h2>Nhận đủ tiền dù nợ thay đổi khi đang chờ</h2><div class="metric-row"><div><small>Nợ khi tạo</small><strong>320.000đ</strong></div><div><small>Thu thủ công trong lúc chờ</small><strong>200.000đ</strong></div><div><small>Thanh toán online đã xác minh</small><strong>320.000đ</strong></div><div><small>Dư có mới</small><strong>200.000đ</strong></div></div><p>120.000đ trừ hết nợ còn lại; toàn bộ 320.000đ vẫn được ghi là tiền thực nhận.</p></section>""",
    ("refunds", "attempt"): """<section class="panel focused"><h2>HT-601 · Kết quả chưa biết</h2><div class="metric-row"><div><small>Dư có hiện tại</small><strong>254.000đ</strong></div><div><small>Đang dành hoàn</small><strong>100.000đ</strong></div><div><small>Khả dụng</small><strong>154.000đ</strong></div><div><small>Lần thử</small><strong>UNKNOWN</strong></div></div><p>Được đối soát <code>reconcileRefundAttempt</code> trên chính lần thử cũ. Không tạo lần hoàn mới và không hủy phiếu cho đến khi có thất bại chắc chắn hoặc thành công đã xác minh.</p><div class="notice">Timeout ≠ FAILED. Sau FAILED đã xác minh, khoản dành được giải phóng và lần thử mới phải có phiên bản/ý định mới.</div></section>""",
    ("refunds", "detail"): """<section class="panel focused"><h2>Trạng thái phiếu và trạng thái tiền là hai trục khác nhau</h2><div class="metric-row"><div><small>Phiếu HT-601</small><strong>DRAFT</strong></div><div><small>Lần thử online</small><strong>UNKNOWN</strong></div><div><small>Đang dành</small><strong>100.000đ</strong></div><div><small>Có thể sửa nháp?</small><strong>Không</strong></div></div><p>Không suy ra “DRAFT” nghĩa là còn sửa/hủy an toàn. Xem nguồn một phiếu thu và từng reservation; phiếu đã trả thực tế bất biến.</p></section>""",
    ("refunds", "retry"): """<section class="panel focused"><h2>Điều kiện cho lần thử mới</h2><p>Chỉ tiếp tục sau khi lần cũ được xác minh FAILED và đã giải phóng reservation. UNKNOWN vẫn khóa nút tạo lần mới. Phần mô tả API nói cần lý do, nhưng requestOnlineRefund không có requestBody; không bịa ô gửi lý do khi chưa sửa hợp đồng API.</p></section>""",
    ("document_history", "revision"): """<section class="panel focused"><h2>Ảnh chụp lịch sử không thay đổi</h2><p>Phiên bản PX-301 v1 hiển thị tên, liên hệ đại lý và đơn vị tính tại thời điểm chốt. Nếu danh mục hoặc liên hệ hôm nay đổi, bản in cũ vẫn hiển thị nội dung gốc.</p><p>Phiếu tài chính không có dòng hàng; bản READY/POSTED chỉ đọc, không sửa trực tiếp.</p></section>""",
    ("document_corrections", "stock-receipt"): """<section class="panel focused"><h2>Chặn hủy khi tồn quá khứ âm</h2><div class="table-scroll"><table><thead><tr><th>Ngày nghiệp vụ</th><th>Phiếu cũ</th><th>Tồn ban đầu</th><th>Nếu hủy nhập 01/06</th></tr></thead><tbody><tr><td>01/06</td><td>Nhập +10</td><td>10</td><td>0</td></tr><tr><td>05/06</td><td>Xuất −10</td><td>0</td><td><strong>−10 · BỊ CHẶN</strong></td></tr><tr><td>10/06</td><td>Nhập +10</td><td>10</td><td>0</td></tr></tbody></table></div><p>Tồn hôm nay có thể bằng 0 sau hủy, nhưng thời điểm 05/06 trở thành âm: máy chủ từ chối và giữ nguyên mọi chứng từ.</p></section>""",
    ("document_corrections", "stock-issue"): """<section class="panel focused"><h2>Sửa sai khác hàng trả thật</h2><p>PX-301 đã ghi nhầm 10 Cái nhưng thực tế chỉ giao 8: tạo phiên bản mới dưới cùng mã và tính lại kỳ gốc. Nếu giao đúng 10 rồi trả 2 vào tháng sau: <a href="../sales_returns/editor.html">lập phiếu trả hàng</a>, không sửa giao dịch cũ.</p><div class="notice">Nếu đã nhận trả ngay, giữ tiền gốc và xử lý phiếu thu riêng khi hủy. Tiền thu công nợ độc lập có thể phân bổ lại FIFO hoặc chặn nếu không còn nợ hợp lệ.</div></section>""",
    ("document_corrections", "payment-receipt"): """<section class="panel focused"><h2>Sửa sai phiếu thu không hoàn lại tiền</h2><p>Nếu nguồn thu 4.000.000đ được ghi sai, việc sửa/hủy phải bảo toàn chứng cứ tiền thực nhận và tính lại phân bổ FIFO hợp lệ. Khi những phiếu còn lại chỉ nhận tối đa 2.000.000đ, server chặn; không tạo dư có tùy tiện để ép hủy.</p><a href="../payment_receipts/detail.html">Xem phân bổ nguồn →</a></section>""",
    ("document_corrections", "stock-adjustment"): """<section class="panel focused"><h2>Điều chỉnh độc lập hoặc bằng chứng kiểm kê</h2><p>Phiếu điều chỉnh do nhân viên lập riêng có thể sửa sai theo nguồn/công nợ/tồn lịch sử. Điều chỉnh sinh từ kiểm kê đã xác nhận là chứng cứ bất biến; không cung cấp nút sửa/hủy. Tạo nghiệp vụ mới khi cần thay đổi thực tế về sau.</p></section>""",
    ("document_corrections", "sales-return"): """<section class="panel focused"><h2>Phụ thuộc vào số hàng trả và nguồn tiền</h2><p>Giá trị trả 2 lần của mặt hàng giá 1đ/đơn vị với mỗi lần 0,5 đơn vị có thể là 1đ và 0đ; cả hai tăng tồn. Sửa lần trước phải replay giá trị của lần sau, nguồn dư có và hoàn tiền đang dành/đã trả; không thay trực tiếp dòng POSTED cũ.</p></section>""",
    ("document_corrections", "credit-application"): """<section class="panel focused"><h2>Bảo toàn chuỗi nguồn tiền</h2><p>Bù trừ đã dùng dư có phát sinh từ phiếu thu nguồn. Nếu lô còn liên quan khoản hoàn UNKNOWN hoặc đã trả thực, không được giải phóng/tiêu lô thêm một lần. Chỉ sửa khi hậu quả lịch sử và FIFO hợp lệ cho từng đại lý.</p></section>""",
    ("reports", "sales"): """<section class="panel focused"><h2>Doanh số gộp, trả hàng và thuần</h2><div class="table-scroll"><table><thead><tr><th>Đại lý</th><th>Phiếu xuất</th><th>Gộp</th><th>Hàng trả</th><th>Thuần</th></tr></thead><tbody><tr><td>DL-101 · Minh Phát</td><td>2</td><td>1.224.000đ</td><td>204.000đ</td><td>1.020.000đ</td></tr><tr><td>DL-229 · Minh Phát</td><td>0</td><td>0đ</td><td>50.000đ</td><td>−50.000đ</td></tr></tbody></table></div><p>Tên trùng không gộp. Tỷ trọng doanh số dùng tổng doanh số gộp toàn doanh nghiệp cùng kỳ, không phải tổng trang/bộ lọc.</p></section>""",
    ("reports", "debt"): """<section class="panel focused"><h2>Giảm nợ có nhiều nguồn</h2><div class="table-scroll"><table><thead><tr><th>Đầu kỳ</th><th>Phát sinh nợ</th><th>Thu tiền phân bổ</th><th>Trả hàng trừ nợ</th><th>Bù trừ</th><th>Cuối kỳ</th></tr></thead><tbody><tr><td>0đ</td><td>1.224.000đ</td><td>1.020.000đ</td><td>0đ</td><td>150.000đ</td><td>54.000đ</td></tr></tbody></table></div><p>Ví dụ xuyên suốt: giá trị trả hàng 204.000đ chuyển thành dư có vì phiếu gốc đã tất toán, không trừ nợ thêm. Tiền online đã thu 320.000đ nhưng chỉ 120.000đ được phân bổ vào nợ. Không gọi toàn bộ nợ giảm là tiền mặt đã thu.</p></section>""",
    ("reports", "inventory"): """<section class="panel focused"><h2>Nhập - xuất - tồn theo đơn vị</h2><div class="table-scroll"><table><thead><tr><th>Hàng / đơn vị</th><th>Đầu kỳ</th><th>Nhập</th><th>Xuất</th><th>Trả</th><th>Cuối kỳ</th></tr></thead><tbody><tr><td>MH-11 · Cái</td><td>0</td><td>100</td><td>12</td><td>2</td><td>90</td></tr></tbody></table></div><p>Không cộng Cái với Kg. Chứng từ sửa sai hồi tố thay đổi kỳ của phiếu gốc; không cộng một phiếu xuất bán mới.</p></section>""",
    ("reports", "product-sales"): """<section class="panel focused"><h2>Số lượng và tiền có thể khác nhịp</h2><div class="table-scroll"><table><thead><tr><th>Mặt hàng</th><th>Bán</th><th>Trả</th><th>Doanh số gộp</th><th>Giá trị trả</th><th>Thuần</th></tr></thead><tbody><tr><td>MH-11 · Cái</td><td>12</td><td>2</td><td>1.224.000đ</td><td>204.000đ</td><td>1.020.000đ</td></tr></tbody></table></div><p>Dòng trả hợp lệ có thể bằng 0đ vì làm tròn cộng dồn, nhưng số lượng thực trả vẫn tăng.</p></section>""",
    ("reports", "cash-credit"): """<section class="panel focused"><h2>Tiền thực khác bù trừ</h2><div class="metric-row"><div><small>Đã thu tiền thật</small><strong>1.220.000đ</strong></div><div><small>Đã hoàn tiền thật</small><strong>100.000đ</strong></div><div><small>Bù trừ dư có</small><strong>150.000đ</strong></div><div><small>VERIFIED chưa ghi thu</small><strong>Trình bày riêng</strong></div></div><p>Dư có cuối kỳ lịch sử khác dư có hiện tại đang dành/khả dụng; không cộng bù trừ vào tiền thu.</p></section>""",
    ("reports", "export"): """<section class="panel focused"><h2>Xuất toàn bộ điều kiện lọc</h2><p>Tháng 06/2026, mã đại lý theo bộ lọc, định dạng XLSX/PDF. Xuất từ API với header <code>Accept</code> tương ứng; không giới hạn 25/100 hàng đang hiển thị. Dùng bearer fetch để nhận tệp, xử lý JSON lỗi kể cả khi xin nội dung nhị phân.</p><p>Với khoản tiền lớn hơn giới hạn một dòng, giữ nguyên chữ số trên tổng báo cáo và tệp xuất.</p></section>""",
    ("dashboard", "accounting"): """<section class="panel focused"><h2>Tiền nhận rồi nhưng chưa thành phiếu thu</h2><p>Khoản trả ngay VERIFIED chưa được ghi receipt được trình bày riêng. Tiền thực thu trong kỳ chỉ cộng phiếu thu POSTED. Nếu thiếu quyền cho một mục, bỏ mục đó thay vì hiển thị 0đ. Quyền vào dashboard của nhóm chỉ có <code>cash.receipt.post</code> còn chờ quyết định D09.</p></section>""",
    ("chatbot", "agency-selection"): """<section class="panel focused"><h2>Hai đại lý tên giống nhau</h2><div class="table-scroll"><table><thead><tr><th>Mã đại lý</th><th>Tên</th><th>Quận</th><th>Chọn</th></tr></thead><tbody><tr><td>DL-101</td><td>Đại lý Minh Phát</td><td>Quận 1</td><td><a href="answer.html">Tra theo DL-101</a></td></tr><tr><td>DL-229</td><td>Đại lý Minh Phát</td><td>Quận 7</td><td><a href="answer.html">Tra theo DL-229</a></td></tr></tbody></table></div><p>Không tiết lộ số dư của ứng viên trước khi chọn. Trên 25 kết quả cần giải pháp tiếp trang an toàn theo quyền chatbot (D10); không tự gọi danh sách hồ sơ đại lý có dữ liệu rộng hơn.</p></section>""",
}


def wireframe_purpose(item: Screen) -> str:
    return f"Xem và xử lý {item.title.lower()} theo trạng thái nghiệp vụ và quyền được cấp. Số liệu hiển thị chỉ để duyệt thiết kế."


def scenario_label(value: str, ordinal: int) -> str:
    dictionary = {
        "Loading": "Đang tải", "Empty": "Chưa có dữ liệu", "Forbidden": "Không có quyền",
        "Unavailable": "Dịch vụ chưa sẵn sàng", "UNKNOWN": "Chưa rõ kết quả, giữ khoản đã dành",
        "Stale ETag": "Phiên bản đã cũ", "412": "Dữ liệu đã đổi (412)", "428": "Thiếu phiên bản (428)",
        "Rate limited": "Tạm giới hạn yêu cầu", "Timeout": "Quá thời gian chờ",
        "Missing permission": "Thiếu quyền thao tác", "No matches": "Không có kết quả phù hợp",
        "Read-only": "Chỉ xem", "No price source": "Chưa có nguồn giá", "No stock": "Không đủ tồn",
        "Concurrent edit": "Người khác đã thay đổi", "Session revoked": "Phiên đã thu hồi",
        "Permission denied": "Không có quyền", "Paid immutable": "Đã hoàn tiền, không thể sửa",
        "Stale movement": "Sổ kho có biến động mới", "No cash": "Không phát sinh tiền thu mới",
    }
    return dictionary.get(value, f"Tình huống {ordinal}: {value}")


def page_html(module: Module, item: Screen, source_ops: dict, planned: dict) -> str:
    mid = module_id(module)
    title = escape(item.title)
    local = list(module.screens)
    current_index = local.index(item)
    previous = local[current_index - 1] if current_index else None
    following = local[current_index + 1] if current_index + 1 < len(local) else None
    fields = item.fields.split("|")
    variants = item.states.split("|")
    operations = [opid for opid in related_ops(module, planned) if screen_for(opid, module).slug == item.slug and opid != "receiveVerifiedPaymentWebhook"]
    own = set(owned_ops(module, planned))
    badges = "".join(f'<li><code>{escape(opid)}</code><span>{escape(source_ops[opid][0])}</span><span>{escape(permission(source_ops[opid][2]))}</span><small>{"API của mô-đun" if opid in own else "Dùng lại từ mô-đun khác"} · {planned[opid][3]}/{planned[opid][4]}</small></li>' for opid in operations)
    if not badges:
        badges = '<li>Thành phần dùng chung; thao tác API nằm trong các trang nghiệp vụ liên kết.</li>'
    tabs = "".join(f'<a href="{escape(s.slug)}.html" {"aria-current=page" if s.slug == item.slug else ""}>{escape(s.title)}</a>' for s in local)
    scenarios = "".join(f'<li id="state-{i:02}"><a href="#state-{i:02}">{escape(scenario_label(state, i))}</a><p>Đối chiếu trạng thái <code>{escape(state)}</code> với dữ liệu nguồn, quyền thực tế và hướng xử lý tiếp. Không xem thao tác nháp hoặc chưa rõ kết quả là ghi sổ thành công.</p></li>' for i, state in enumerate(variants, 1))
    fixture = "".join(f'<tr><th scope="row">{escape(key.upper())}</th><td>{escape(value)}</td><td><span class="pill">Dữ liệu mẫu</span></td></tr>' for key, value in fixture_for(module))
    form = "".join(field_markup(field, i, item.slug) for i, field in enumerate(fields, 1))
    cross = {
        "stock_issues": "upfront_payments/verify.html",
        "upfront_payments": "payment_receipts/detail.html",
        "payment_receipts": "receivables/allocations.html",
        "receivables": "agency_credit/index.html",
        "sales_returns": "agency_credit/lots.html",
        "agency_credit": "credit_applications/editor.html",
        "credit_applications": "refunds/editor.html",
        "online_payments": "refunds/index.html",
        "refunds": "document_history/revisions.html",
        "stock_counts": "stock_adjustments/detail.html",
        "document_history": "document_corrections/index.html",
        "document_corrections": "reports/index.html",
        "reports": "dashboard/index.html",
        "dashboard": "chatbot/index.html",
    }
    links = []
    if previous:
        links.append(f'<a href="{previous.slug}.html">← {escape(previous.title)}</a>')
    if following:
        links.append(f'<a href="{following.slug}.html">{escape(following.title)} →</a>')
    if module.name in cross:
        links.append(f'<a href="../{cross[module.name]}">Tiếp tục quy trình liên mô-đun →</a>')
    links.append('<a href="../index.html">Danh mục tất cả mô-đun</a>')
    actions = "".join(links)
    next_href = f"{following.slug}.html" if following else "../index.html"
    if module.name == "refunds" and item.slug in {"attempt", "detail", "retry"} and next_href in {"retry.html", "confirm-paid.html"}:
        next_href = "attempt.html"
    focused = FOCUSED_VIEWS.get((module.name, item.slug), "")
    is_entry = item.slug in {"editor", "create", "verify", "grant", "forgot-password", "reset-password", "change-password", "forms", "goods-editor", "financial-editor"} or (module.name == "authentication" and item.slug == "index")
    field_content = f'<form class="prototype-form" data-prototype><div class="fields">{form}</div><div class="actions"><button type="submit">Xem kết quả trên bản mẫu</button><a class="button secondary" href="{next_href}">Màn hình liên quan</a></div><p class="prototype-feedback" role="status" hidden>Đã ghi nhận lựa chọn trong bản phác thảo. Không có giao dịch nào được gửi tới máy chủ.</p></form>' if is_entry else f'<div class="table-scroll"><table><caption>Thông tin minh họa của {title}</caption><thead><tr><th scope="col">Thông tin</th><th scope="col">Giá trị đang hiển thị</th><th scope="col">Trạng thái</th></tr></thead><tbody>' + "".join(f'<tr><th scope="row">{escape(label)}</th><td>{escape("DL-101 · Đại lý Minh Phát" if "đại lý" in label.casefold() else "PX-301 · mốc ví dụ" if "phiếu" in label.casefold() or "mã" in label.casefold() else "Chỉ hiển thị theo dữ liệu API")}</td><td><span class="pill">Đã đọc</span></td></tr>' for label in fields) + '</tbody></table></div>'
    context_text = "Thiết kế này giữ đúng trạng thái và số dư từ máy chủ. " + "; ".join(variants[:3]) + "."
    if module.name == "refunds" and item.slug in {"attempt", "detail", "retry"}:
        # UNKNOWN is deliberately not connected to a new attempt or paid-confirmation action.
        links = [link for link in links if "confirm-paid.html" not in link and "retry.html" not in link]
        actions = "".join(links)
    esc = escape
    return f'''<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · Agentra wireframe</title><link rel="stylesheet" href="../assets/wireframes.css"><script src="../assets/wireframes.js" defer></script></head>
<body><a class="skip" href="#main">Bỏ qua điều hướng</a><div class="prototype">{esc(NOTICE)} <a href="../../plan/{esc(module.name)}/PLAN.md">{mid} · Kế hoạch</a></div>
<div class="layout"><aside class="sidebar"><a class="brand" href="../index.html">AGENTRA <small>DMS / BẢN PHÁC THẢO</small></a><nav aria-label="Nhóm nghiệp vụ"><a href="../flows.html">Luồng mẫu</a><a href="../application_shell/index.html">Tổng quan</a><a href="../agencies/index.html">Đại lý</a><a href="../products/index.html">Hàng hóa</a><a href="../stock_issues/index.html">Kho hàng</a><a href="../receivables/index.html">Thu tiền & công nợ</a><a href="../reports/index.html">Báo cáo</a><a href="../users/index.html">Quản trị</a></nav><div class="side-note">Phân quyền minh họa theo từng trang. API nghiệp vụ chưa triển khai.</div></aside>
<div class="workspace"><header class="topbar"><span>{mid} / {esc(module.name.replace('_', ' '))}</span><span>Nhân viên minh họa · <strong>Kế toán / Kho / Kinh doanh</strong></span></header>
<main id="main"><nav class="breadcrumbs" aria-label="Đường dẫn"><a href="../index.html">Wireframes</a> / <a href="index.html">{mid} {esc(module.name)}</a> / <span>{title}</span></nav>
<div class="heading"><div><p class="kicker">MÀN HÌNH {mid}-SCR{current_index + 1:02}</p><h1>{title}</h1><p>{esc(wireframe_purpose(item))}</p></div><span class="status">Thiết kế · chưa kết nối</span></div>
<nav class="local-nav" aria-label="Màn hình trong mô-đun">{tabs}</nav>
<div class="content-grid"><section class="panel"><div class="panel-head"><div><h2>Thông tin và thao tác</h2><p>Nội dung thật trong HTML; biểu mẫu chỉ minh họa trạng thái, không gửi giao dịch.</p></div><span class="pill">{mid}</span></div>
{field_content}</section>
<aside class="panel context"><h2>Ngữ cảnh nghiệp vụ</h2><p>{esc(context_text)}</p><dl><dt>Tiền & định danh</dt><dd>Giữ nguyên chuỗi VND/mã lớn; ngày nghiệp vụ khác thời điểm thao tác.</dd><dt>Quyền & trạng thái</dt><dd>API thực quyết định quyền, phiên bản và số dư. Không suy luận từ vai trò minh họa.</dd><dt>Tiến độ</dt><dd>Chỉ M01 xác thực và hai health routes hiện có; API nghiệp vụ cần cổng Full và thử nghiệm trình duyệt.</dd></dl></aside></div>
{focused}
<section class="panel" aria-labelledby="fixture"><div class="panel-head"><div><h2 id="fixture">Bộ dữ liệu xuyên suốt</h2><p>Các giá trị minh họa nhất quán giữa các màn hình; mỗi bước thuộc thời điểm khác nhau.</p></div><span class="pill">A01–A26</span></div><div class="table-scroll"><table><caption>Ví dụ để đọc quy trình, không phải dữ liệu thực</caption><thead><tr><th scope="col">Bước</th><th scope="col">Thông tin minh họa</th><th scope="col">Nguồn</th></tr></thead><tbody>{fixture}</tbody></table></div></section>
<section class="panel scenarios"><div class="panel-head"><div><h2>Trạng thái cần thiết kế và kiểm thử</h2><p>Liên kết từng tình huống dùng để đối chiếu với yêu cầu/test trong kế hoạch.</p></div></div><ol>{scenarios}</ol></section>
<section class="panel contract"><h2>Ánh xạ API và phân quyền</h2><ul>{badges}</ul><p>Đọc phương thức, schema, status, headers và quyền điều kiện tại <a href="../../../backend-design/API/openapi.json">OpenAPI gốc</a>. Đường dẫn ở đây là màn hình trình duyệt.</p></section>
<nav class="next-links" aria-label="Tiếp tục">{actions}</nav></main><footer>Bản phác thảo F01–F32 · Không lưu dữ liệu · Trạng thái và số tiền chỉ có tính minh họa</footer></div></div></body></html>'''


CSS = """:root{font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#18283a;background:#eef2f4}*{box-sizing:border-box}body{margin:0;min-width:320px}a{color:#145776;text-underline-offset:.2em}a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #a15419;outline-offset:2px}.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;z-index:10;background:white;padding:10px}.prototype{display:flex;justify-content:space-between;gap:1rem;padding:.5rem 2rem;background:#224d50;color:white;font-size:.8rem;font-weight:650}.prototype a{color:#e9ffef}.layout{display:grid;grid-template-columns:228px minmax(0,1fr);min-height:100vh}.sidebar{background:#172b38;color:#c6d5dc;padding:22px 14px}.sidebar a{color:#dbe9ed;text-decoration:none}.brand{display:block;padding:0 12px 22px;font-size:1.2rem;font-weight:850;letter-spacing:.12em}.brand small{display:block;font-size:.62rem;letter-spacing:.15em;color:#9fb6c0}.sidebar nav{display:grid;gap:3px}.sidebar nav a{padding:9px 12px;border-radius:5px}.sidebar nav a:hover,.sidebar nav a:focus-visible{background:#315563}.side-note{margin:28px 12px 0;font-size:.78rem;color:#adbdc4}.workspace{min-width:0}.topbar{display:flex;justify-content:space-between;gap:15px;padding:14px 32px;background:white;border-bottom:1px solid #d8e1e5;color:#536a78;font-size:.82rem}main{max-width:1440px;margin:auto;padding:28px 32px 80px}.breadcrumbs{font-size:.82rem;color:#647684;margin-bottom:25px}.heading{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin:0 0 20px}.heading h1{font-size:clamp(1.7rem,2.8vw,2.7rem);line-height:1.15;margin:4px 0 10px;letter-spacing:-.03em}.heading p{margin:0;max-width:70ch;color:#4e6070}.kicker{font-size:.74rem!important;font-weight:750;letter-spacing:.12em;color:#286c68!important}.status{white-space:nowrap;border:1px solid #a5c2bd;color:#245752;padding:6px 10px;border-radius:4px;font-size:.76rem;font-weight:700;background:#e8f3f0}.local-nav{display:flex;gap:5px;overflow:auto;padding-bottom:1px;border-bottom:1px solid #cfd9df;margin-bottom:21px}.local-nav a{white-space:nowrap;padding:10px 12px;text-decoration:none;color:#425664;font-size:.86rem}.local-nav a[aria-current=page]{color:#204f4d;border-bottom:3px solid #328171;font-weight:750}.content-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(220px,1fr);gap:18px}.panel{background:white;border:1px solid #d6dfe3;border-radius:7px;padding:21px;margin-bottom:18px;box-shadow:0 1px 2px #1b344209}.panel-head{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:18px}.panel h2{font-size:1.04rem;margin:0 0 5px}.panel p{color:#4c6270}.panel-head p{font-size:.84rem;margin:0}.pill{display:inline-block;font-size:.7rem;font-weight:700;padding:3px 7px;border:1px solid #cee2de;border-radius:3px;background:#edf6f3;color:#245d54;white-space:nowrap}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.field{min-width:0}.field label{display:block;font-size:.83rem;font-weight:700;margin-bottom:6px}.field input,.field select,.field textarea{width:100%;border:1px solid #a9bac4;border-radius:4px;background:white;color:#18283a;min-height:41px;padding:8px 10px;font:inherit}.field small{display:block;font-size:.7rem;color:#596a75;margin-top:4px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:23px}.button,button{border:1px solid #205d58;border-radius:4px;background:#225e58;color:white;cursor:pointer;font:inherit;font-size:.84rem;font-weight:700;padding:9px 13px;text-decoration:none}.button.secondary{color:#215350;background:white}.prototype-feedback{color:#25594a!important;background:#edf8f0;border-left:3px solid #408665;padding:9px}.context p{font-size:.87rem}.context dl{margin:0}.context dt{font-weight:750;margin-top:14px}.context dd{margin:4px 0;font-size:.79rem;color:#536573}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;text-align:left;font-size:.83rem}caption{text-align:left;font-size:.73rem;color:#576b76;margin-bottom:8px}th,td{padding:9px;border-bottom:1px solid #e1e7eb;vertical-align:top}th{font-weight:680}thead th{background:#f5f8f8}.scenarios ol{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;padding:0;list-style:none}.scenarios li{padding:12px;border:1px solid #d8e4e4;border-radius:4px;background:#f9fbfb}.scenarios li:target{outline:2px solid #318578}.scenarios li p{font-size:.78rem;margin:5px 0 0}.contract ul{list-style:none;padding:0;margin:12px 0}.contract li{display:flex;align-items:center;flex-wrap:wrap;gap:10px;border-top:1px solid #e2e8eb;padding:9px;font-size:.78rem}.contract code{font-weight:700;color:#265462}.contract small{color:#567070}.next-links{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:22px 0}.next-links a{font-size:.84rem;font-weight:700}.workspace footer{padding:16px 32px;border-top:1px solid #d5e0e4;font-size:.78rem;color:#5c7180}.landing main{max-width:1220px}.module-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));gap:12px}.module-grid article,.flow-list article{background:white;border:1px solid #d3e0e3;border-radius:6px;padding:17px}.module-grid article h2,.flow-list h2{font-size:1rem;margin:0 0 8px}.module-grid article p,.flow-list p{font-size:.82rem;color:#4e6370}.flow-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.focused{border-left:4px solid #318475}.metric-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin:14px 0}.metric-row>div{background:#f1f6f5;border:1px solid #d8e7e4;padding:13px;border-radius:4px}.metric-row small{display:block;color:#496579;font-size:.74rem;margin-bottom:6px}.metric-row strong{display:block;font-size:1.08rem;color:#244b4c}.notice{background:#fff5e9;border-left:3px solid #ae693b;padding:13px;color:#64472e;margin:12px 0}@media(max-width:900px){.layout{grid-template-columns:1fr}.sidebar{padding:12px}.brand{padding:5px 8px}.sidebar nav{display:flex;overflow:auto}.sidebar nav a{white-space:nowrap}.side-note{display:none}.content-grid{grid-template-columns:1fr}}@media(max-width:600px){.prototype,.topbar{padding:8px 14px}.topbar{display:block}main{padding:20px 14px 60px}.heading{display:block}.heading .status{display:inline-block;margin-top:12px}.panel{padding:14px}.fields{grid-template-columns:1fr}.sidebar nav{gap:0}.sidebar nav a{padding:6px 9px;font-size:.8rem}}"""


JS = """document.querySelectorAll('form[data-prototype]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); const note = form.querySelector('.prototype-feedback'); if (note) { note.hidden = false; note.focus?.(); } }));"""


def write_wireframes(source_ops: dict, planned: dict) -> None:
    base = DESIGN / "wr"
    write_generated(base / "assets/wireframes.css", CSS)
    write_generated(base / "assets/wireframes.js", JS)
    for module in MODULES:
        for item in module.screens:
            write_generated(wr_path(module) / f"{item.slug}.html", page_html(module, item, source_ops, planned))
    card = "\n".join(f'<article><h2><a href="{m.name}/index.html">{module_id(m)} · {escape(m.name.replace("_", " "))}</a></h2><p>{escape(m.mission)}</p><p>{len(m.screens)} màn hình · <a href="../plan/{m.name}/PLAN.md">Kế hoạch</a></p></article>' for m in MODULES)
    flow_cards = [
        ("Nhận tiền trước khi xuất", "stock_issues/pending.html", "Kế toán xác nhận tiền theo phiên bản READY; kho xác nhận và phiếu thu tự sinh cùng giao dịch."),
        ("Tiền đã nhận, xuất hàng thất bại", "upfront_payments/receive-separately.html", "Bằng chứng VERIFIED còn nguyên; ghi thu riêng, không xóa tiền và không tự hủy phiếu xuất."),
        ("Thu công nợ FIFO", "payment_receipts/detail.html", "Khoản thu thực tế được hệ thống phân bổ theo ngày nghiệp vụ, không chọn phiếu tùy ý."),
        ("Online thanh toán nhiều hơn nợ", "online_payments/detail.html", "Thành công đã kiểm chứng ghi đủ tiền, phần dư thành dư có; đường dẫn trình duyệt không phải xác nhận."),
        ("Trả hàng khác hoàn tiền", "sales_returns/review.html", "Hàng thực nhận tăng kho, giảm nợ/tạo dư có; hoàn tiền là nghiệp vụ riêng."),
        ("Hoàn tiền UNKNOWN", "refunds/attempt.html", "Kết quả chưa biết giữ tiền dành hoàn; đối soát trước khi tạo lần thử mới."),
        ("Kiểm kê cũ sau biến động", "stock_counts/recount.html", "Biến động xen giữa gây stale ngay cả khi tồn cuối trở lại bằng trước; phải đếm lại."),
        ("Hủy nhập làm tồn lịch sử âm", "document_corrections/stock-receipt.html", "Tồn hôm nay có thể hợp lệ nhưng tại thời điểm xuất cũ trở thành âm; máy chủ từ chối."),
        ("Sửa sai ảnh hưởng phân bổ", "document_corrections/stock-issue.html", "Giữ tiền đã thực thu; replay FIFO hoặc chặn nếu thiếu nợ hợp lệ."),
        ("Bản in và xuất dữ liệu", "reports/export.html", "Xuất toàn bộ bộ lọc có quyền; bản in dùng ảnh chụp phiên bản cũ."),
    ]
    flow_markup = "\n".join(f'<article><h2><a href="{href}">{escape(title)} →</a></h2><p>{escape(description)}</p></article>' for title, href, description in flow_cards)
    def landing(title: str, body: str) -> str:
        return f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} · Agentra wireframes</title><link rel="stylesheet" href="assets/wireframes.css"></head><body class="landing"><a class="skip" href="#main">Bỏ qua điều hướng</a><div class="prototype">{escape(NOTICE)} <a href="../plan/full_frontend/PLAN.md">Toàn bộ kế hoạch</a></div><main id="main"><p class="kicker">AGENTRA / DEALER MANAGEMENT SYSTEM</p><h1>{escape(title)}</h1><p>32 mô-đun F01–F32 · HTML tĩnh nhiều màn hình · dữ liệu và tương tác chỉ dùng để duyệt thiết kế.</p><nav class="next-links"><a href="index.html">Danh mục mô-đun</a><a href="flows.html">10 quy trình xuyên mô-đun</a><a href="README.md">Hướng dẫn</a></nav>{body}</main></body></html>'''
    write_generated(base / "index.html", landing("Bản phác thảo toàn ứng dụng", f'<div class="module-grid">{card}</div>'))
    write_generated(base / "flows.html", landing("Luồng nghiệp vụ liên kết", f'<div class="flow-list">{flow_markup}</div>'))
    write_generated(base / "README.md", """# Agentra frontend wireframes

Open [index.html](index.html) from disk or serve `openwiki/frontend-design/wr/` with any static server. Use [flows.html](flows.html) for ten key linked workflows. Every F01–F32 folder has a real `index.html` and additional HTML screen files. Local `assets/wireframes.css` and `assets/wireframes.js` require no build, database, network access or credentials. JavaScript only acknowledges prototype form clicks; no API request is sent and money/stock/debt never changes.

These are **clickable mid-fidelity design artifacts**, not implemented React or working business endpoints. All data are synthetic. The seven auth routes and two health endpoints are the only currently mounted HTTP operations; see [full frontend plan](../plan/full_frontend/PLAN.md) and [target OpenAPI](../../backend-design/API/openapi.json). Source business decisions prevail over older BA proposals. Form field lists and technical annotations are design prompts; backend-only callbacks are never employee controls.

Use browser keyboard focus, 320px/mobile and desktop viewport review plus the [read-only plan validator](../plan/full_frontend/validate_plan.py) before marking paired design review complete. A missing backend route does not become operational merely because a button appears on a wireframe.
""")


def main() -> None:
    source_ops, planned = operation_catalog()
    expected = list(range(1, 33))
    if [m.number for m in MODULES] != expected or len({m.name for m in MODULES}) != 32:
        raise ValueError("Frontend module IDs/names are missing or duplicated")
    write_program(source_ops, planned)
    for module in MODULES:
        module_docs(module, source_ops, planned)
    write_wireframes(source_ops, planned)
    screens = sum(len(m.screens) for m in MODULES)
    print(f"Generated {len(MODULES)} six-file module plans, 11 program documents, {screens + 2} HTML pages, CSS/JS and README; 154 unique source operations indexed.")


if __name__ == "__main__":
    main()
