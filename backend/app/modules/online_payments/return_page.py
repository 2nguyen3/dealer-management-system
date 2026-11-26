"""Payer-facing VNPAY return page: the agency's payment receipt ("Biên lai thanh toán").

The agency lands here in its own browser (usually a phone after scanning the QR)
when VNPAY redirects back. The page is a read-only view: success is shown only when
the server has recorded the payment (IPN or server-to-server reconciliation, see
``OnlinePaymentService.payer_outcome``). Signed return parameters only supply
display details (bank, provider reason) and the "still confirming" hint; they never
change payment state. Every interpolated value is escaped.
"""

import base64
import hashlib
from datetime import datetime
from decimal import Decimal
from html import escape
from pathlib import Path

from app.core.exceptions import ApiError
from app.modules.document_history.printing import amount_in_words, number
from app.modules.online_payments.vnpay import VN, amount_from_vnpay, native_time

ICON = base64.b64encode((Path(__file__).parent / "assets" / "agentra-icon.png").read_bytes())
SCRIPT = (
    "document.querySelectorAll('[data-print]').forEach(function(b){"
    "b.addEventListener('click',function(){window.print()})})"
)
SCRIPT_HASH = base64.b64encode(hashlib.sha256(SCRIPT.encode()).digest()).decode()
CSP = (
    "default-src 'none'; img-src data:; style-src 'unsafe-inline' https://fonts.googleapis.com; "
    f"font-src https://fonts.gstatic.com; script-src 'sha256-{SCRIPT_HASH}'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)
PAGE_HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": CSP,
}
REFRESH_SECONDS = 5

# VNPAY 2.1.0 vnp_ResponseCode meanings shown to the payer when a payment did not go through.
REASONS = {
    "07": "Giao dịch bị nghi ngờ gian lận, đang được ngân hàng kiểm tra.",
    "09": "Thẻ/tài khoản chưa đăng ký dịch vụ InternetBanking.",
    "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.",
    "11": "Đã hết thời gian chờ thanh toán.",
    "12": "Thẻ/tài khoản đang bị khóa.",
    "13": "Mã xác thực (OTP) không đúng.",
    "24": "Bạn đã hủy giao dịch.",
    "51": "Tài khoản không đủ số dư.",
    "65": "Tài khoản đã vượt hạn mức giao dịch trong ngày.",
    "75": "Ngân hàng thanh toán đang bảo trì.",
    "79": "Nhập sai mật khẩu thanh toán quá số lần quy định.",
}
DEFAULT_REASON = "Cổng thanh toán báo giao dịch không thành công."

STYLE = """
:root{color-scheme:light dark;--bg:#f5f8fc;--card:#fff;--fg:#0e1a2f;--muted:#586a86;
--line:#dfe6f0;--soft:#eff3f9;--primary:#1857d1;--ok:#0b8f7a;--ok-soft:#e3f5f1;
--warn:#b26a00;--warn-soft:#fdf2df;--bad:#c62f3c;--bad-soft:#fbe7e9}
@media (prefers-color-scheme:dark){:root{--bg:#050a14;--card:#0a1222;--fg:#e2e9f5;
--muted:#93a3bd;--line:#1c2a42;--soft:#101b30;--primary:#6c9cff;--ok:#3ccfb2;
--ok-soft:#0c2a27;--warn:#f0b04f;--warn-soft:#2c2111;--bad:#ff7a85;--bad-soft:#2d1218}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:15px/1.55 "Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
-webkit-font-smoothing:antialiased}
main{max-width:520px;margin:0 auto;padding:24px 16px 40px}
.brand{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:18px;
font-weight:700;letter-spacing:.2px}
.brand img{width:28px;height:28px}
.brand small{display:block;font-weight:500;color:var(--muted);font-size:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;
box-shadow:0 10px 30px -18px rgba(14,26,47,.35)}
.hero{padding:28px 22px 22px;text-align:center}
.badge{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px}
.badge svg{width:34px;height:34px}
.ok .badge{background:var(--ok-soft);color:var(--ok)}
.wait .badge{background:var(--warn-soft);color:var(--warn)}
.bad .badge{background:var(--bad-soft);color:var(--bad)}
h1{font-size:20px;margin:0 0 6px}
.lead{margin:0;color:var(--muted)}
.amount{font-size:32px;font-weight:700;margin:16px 0 2px;font-variant-numeric:tabular-nums}
.ok .amount{color:var(--ok)}
.words{color:var(--muted);font-size:13px;margin:0}
.title{display:flex;justify-content:space-between;align-items:center;gap:12px;
padding:14px 22px;border-top:1px dashed var(--line);background:var(--soft);
font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.6px}
.title span:last-child{font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)}
dl{margin:0;padding:8px 22px 14px}
.row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;
border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
dt{color:var(--muted);flex:0 0 auto}
dd{margin:0;text-align:right;font-weight:600;overflow-wrap:anywhere}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:500;
font-size:13.5px}
.note{margin:0;padding:14px 22px 20px;color:var(--muted);font-size:13px;
border-top:1px solid var(--line)}
.actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px}
.btn{appearance:none;border:1px solid var(--line);background:var(--card);color:var(--fg);
border-radius:12px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer;
text-decoration:none;display:inline-flex;align-items:center;gap:8px}
.btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
.btn:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.btn svg{width:18px;height:18px}
.foot{text-align:center;color:var(--muted);font-size:12px;margin-top:22px}
@media print{body{background:#fff;color:#000}main{padding:0;max-width:none}
.card{box-shadow:none;border-color:#bbb}.actions,.noprint{display:none}
.title{background:#f2f2f2}}
"""

ICONS = {
    "ok": '<path d="M20 6 9 17l-5-5"/>',
    "wait": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "bad": '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    "print": '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 '
    '2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
    "reload": '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
}


def icon(name: str) -> str:
    return (
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
        f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>'
    )


def moment(value) -> str:
    """Instant -> "HH:mm:ss dd/MM/yyyy" in Vietnam time; blank when missing."""
    if not value:
        return ""
    if not isinstance(value, datetime):
        value = datetime.fromisoformat(str(value))
    return value.astimezone(VN).strftime("%H:%M:%S %d/%m/%Y")


def money(value) -> str:
    return f"{number(value)} ₫"


def signed_amount(fields) -> str | None:
    try:
        return amount_from_vnpay(fields.get("vnp_Amount"))
    except ApiError:
        return None


def signed_time(fields):
    try:
        return native_time(fields.get("vnp_PayDate"))
    except ApiError:
        return None


def provider_paid(fields) -> bool:
    """Whether the signed return parameters report a completed payment (display only)."""
    return (
        fields.get("vnp_ResponseCode") == "00" and fields.get("vnp_TransactionStatus", "00") == "00"
    )


def rows_html(rows) -> str:
    items = []
    for label, value, mono in rows:
        if value in (None, ""):
            continue
        css = ' class="mono"' if mono else ""
        items.append(
            f'<div class="row"><dt>{escape(label)}</dt><dd{css}>{escape(value)}</dd></div>'
        )
    return "<dl>" + "".join(items) + "</dl>"


def agency_label(view) -> str | None:
    if not view or not view.get("agencyName"):
        return None
    return view["agencyName"]


def shell(title: str, body: str, *, refresh: bool = False) -> str:
    meta = f'<meta http-equiv="refresh" content="{REFRESH_SECONDS}">' if refresh else ""
    return (
        "<!doctype html><html lang='vi'><head><meta charset='utf-8'>"
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow">'
        f"{meta}<title>{escape(title)} · Agentra</title>"
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:'
        'wght@400;500;600;700&amp;display=swap">'
        f"<style>{STYLE}</style></head><body><main>"
        f'<div class="brand"><img src="data:image/png;base64,{ICON.decode()}" alt="">'
        "<div>Agentra<small>Hệ thống quản lý đại lý</small></div></div>"
        f"{body}"
        '<p class="foot">Thanh toán qua cổng VNPAY · Agentra DMS</p>'
        f"</main><script>{SCRIPT}</script></body></html>"
    )


def hero(tone: str, heading: str, lead: str, amount: str | None, words: str | None) -> str:
    parts = [
        f'<div class="hero"><div class="badge">{icon(tone)}</div>',
        f"<h1>{escape(heading)}</h1><p class='lead'>{escape(lead)}</p>",
    ]
    if amount:
        parts.append(f'<p class="amount">{escape(money(amount))}</p>')
    if words:
        parts.append(f'<p class="words">{escape(words)}</p>')
    parts.append("</div>")
    return "".join(parts)


def words_of(amount) -> str | None:
    try:
        return amount_in_words(amount) if amount is not None else None
    except ValueError:
        return None


def receipt(fields, view) -> str:
    """Success: the server recorded the payment and posted its payment receipt."""
    amount = str(view["amount"])
    rows = [
        ("Đại lý", agency_label(view), False),
        ("Mã đại lý", view.get("agencyCode"), True),
        ("Nội dung", "Thanh toán công nợ", False),
        ("Phiếu thu", view.get("receiptCode"), True),
        ("Thời gian thanh toán", moment(view.get("paymentTime")), False),
        ("Mã giao dịch VNPAY", view.get("providerTransactionId"), True),
        ("Mã tham chiếu", view.get("merchantReference"), True),
        ("Ngân hàng", fields.get("vnp_BankCode"), False),
        ("Hình thức", fields.get("vnp_CardType"), False),
    ]
    debt = view.get("agencyDebt")
    if debt is not None:
        debt = Decimal(str(debt))
        if debt < 0:  # Pre-policy historical balances may still be negative.
            rows.append(("Số tiền trả dư", money(-debt), False))
        else:
            rows.append(("Công nợ còn lại", money(debt), False))
    body = (
        '<section class="card ok" aria-labelledby="h">'
        + hero(
            "ok",
            "Thanh toán thành công",
            "Agentra đã ghi nhận khoản thanh toán và trừ vào công nợ của đại lý.",
            amount,
            words_of(amount),
        ).replace("<h1>", '<h1 id="h">')
        + '<div class="title"><span>Biên lai thanh toán</span>'
        f"<span>{escape(view.get('receiptCode') or '')}</span></div>"
        + rows_html(rows)
        + '<p class="note">Biên lai điện tử do Agentra lập tự động sau khi VNPAY xác nhận. '
        "Vui lòng lưu lại để đối chiếu khi cần.</p></section>"
        '<div class="actions"><button class="btn primary" type="button" data-print>'
        f"{icon('print')}In / Lưu PDF</button></div>"
    )
    return shell("Biên lai thanh toán", body)


def confirming(fields, view, reload_url: str) -> str:
    """The provider reported success but the server has not recorded it yet."""
    amount = str(view["amount"]) if view else signed_amount(fields)
    rows = [
        ("Đại lý", agency_label(view), False),
        ("Mã tham chiếu", fields.get("vnp_TxnRef"), True),
        ("Mã giao dịch VNPAY", fields.get("vnp_TransactionNo"), True),
        ("Ngân hàng", fields.get("vnp_BankCode"), False),
    ]
    auto = view is not None
    lead = "VNPAY đã báo thanh toán. Agentra đang xác nhận với cổng thanh toán; " + (
        "trang sẽ tự cập nhật sau vài giây." if auto else "vui lòng tải lại sau ít phút."
    )
    body = (
        '<section class="card wait" aria-live="polite">'
        + hero("wait", "Đang xác nhận thanh toán", lead, amount, None)
        + '<div class="title"><span>Thông tin giao dịch</span><span>Chờ xác nhận</span></div>'
        + rows_html(rows)
        + '<p class="note">Biên lai chỉ được lập khi Agentra nhận xác nhận chính thức từ VNPAY. '
        "Không cần thanh toán lại.</p></section>"
        f'<div class="actions"><a class="btn" href="{escape(reload_url, quote=True)}">'
        f"{icon('reload')}Tải lại</a></div>"
    )
    return shell("Đang xác nhận thanh toán", body, refresh=auto)


def unsuccessful(fields, view) -> str:
    code = fields.get("vnp_ResponseCode", "")
    if view and view.get("status") == "EXPIRED":
        reason = REASONS["11"]
    else:
        reason = REASONS.get(code, DEFAULT_REASON)
    amount = str(view["amount"]) if view else signed_amount(fields)
    rows = [
        ("Đại lý", agency_label(view), False),
        ("Lý do", reason, False),
        ("Mã tham chiếu", fields.get("vnp_TxnRef"), True),
        ("Thời gian", moment(signed_time(fields)), False),
        ("Ngân hàng", fields.get("vnp_BankCode"), False),
    ]
    body = (
        '<section class="card bad">'
        + hero(
            "bad",
            "Thanh toán chưa thành công",
            "Không có khoản tiền nào được ghi nhận vào công nợ.",
            amount,
            None,
        )
        + '<div class="title"><span>Thông tin giao dịch</span>'
        f"<span>Mã phản hồi {escape(code or '—')}</span></div>"
        + rows_html(rows)
        + '<p class="note">Nếu tài khoản đã bị trừ tiền, ngân hàng sẽ hoàn lại theo quy định '
        "của VNPAY. Liên hệ nhân viên phụ trách để nhận mã thanh toán mới.</p></section>"
    )
    return shell("Thanh toán chưa thành công", body)


def render_return(fields, view, reload_url: str) -> str:
    """Pick the page for verified return ``fields`` and the server ``view`` (or None)."""
    status = view.get("status") if view else None
    if status == "SUCCESS":
        return receipt(fields, view)
    if status in ("FAILED", "EXPIRED"):
        return unsuccessful(fields, view)
    if provider_paid(fields):
        return confirming(fields, view, reload_url)
    return unsuccessful(fields, view)


def render_invalid() -> str:
    body = (
        '<section class="card bad">'
        + hero(
            "bad",
            "Không xác minh được kết quả",
            "Thông tin trả về từ VNPAY không hợp lệ hoặc cổng thanh toán chưa được cấu hình. "
            "Vui lòng liên hệ nhân viên phụ trách để kiểm tra trạng thái thanh toán.",
            None,
            None,
        )
        + "</section>"
    )
    return shell("Không xác minh được kết quả VNPAY", body)
