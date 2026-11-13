import {
  ArrowLeft,
  ArrowRight,
  Ban,
  BookCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  CreditCard,
  Download,
  Eye,
  Filter,
  FilterX,
  House,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'

/**
 * One icon per kind of action, shared by buttons and dialog titles so the
 * same verb always carries the same pictogram across the app.
 */
export const ACTION_ICONS = {
  create: Plus,
  edit: Pencil,
  save: Save,
  delete: Trash2,
  export: Download,
  print: Printer,
  refresh: RefreshCw,
  filter: Filter,
  reset: FilterX,
  cancel: X,
  close: X,
  void: Ban,
  terminate: CircleSlash,
  confirm: CircleCheck,
  post: BookCheck,
  view: Eye,
  back: ArrowLeft,
  next: ArrowRight,
  previous: ChevronLeft,
  following: ChevronRight,
  send: Send,
  pay: CreditCard,
  password: KeyRound,
  home: House,
  login: LogIn,
  logout: LogOut,
} as const satisfies Record<string, LucideIcon>

export type ActionKind = keyof typeof ACTION_ICONS

/**
 * Ordered label rules (Vietnamese, matched on the start of the trimmed,
 * lower-cased label). Specific phrases come before the generic verb they
 * start with, e.g. "hủy phiếu" (void a document) before plain "hủy" (dismiss).
 * Business nouns such as "xuất hàng" (stock issue) deliberately do not match
 * "export", which needs an explicit file/report target.
 */
const RULES: readonly [string, ActionKind][] = [
  ['(xóa|bỏ) (bộ )?lọc', 'reset'],
  ['.*mật khẩu', 'password'],
  ['(tiếp tục )?khởi tạo thanh toán', 'pay'],
  ['về trang chủ', 'home'],
  ['(quay lại|trở lại|về)', 'back'],
  ['(trang )?trước$', 'previous'],
  ['(trang )?(sau|tiếp|kế tiếp)$', 'following'],
  ['(tiếp tục|tiếp theo)', 'next'],
  ['(tạo|thêm|tiếp nhận|lập)', 'create'],
  ['(sửa|chỉnh sửa)', 'edit'],
  ['(lưu|cập nhật)', 'save'],
  ['xóa', 'delete'],
  ['(xuất (pdf|excel|csv|file|tệp|báo cáo|dữ liệu)|tải (xuống|về))', 'export'],
  ['in', 'print'],
  ['(tải lại|làm mới|thử lại|thử tải lại|đối soát)', 'refresh'],
  ['lọc', 'filter'],
  ['hủy (phiếu|chứng từ|giao dịch)', 'void'],
  ['(hủy|bỏ qua)$', 'cancel'],
  ['đóng$', 'close'],
  ['ngừng', 'terminate'],
  ['(ghi sổ|giữ chỗ)', 'post'],
  ['(xác nhận|xác minh|đồng ý|duyệt|áp dụng|xong)', 'confirm'],
  ['(xem|chi tiết)', 'view'],
  ['(gửi|yêu cầu)', 'send'],
  ['đăng nhập', 'login'],
  ['đăng xuất', 'logout'],
]

/**
 * Each rule matches whole words from the start of the label: the phrase must
 * be followed by the end of the label or a non-letter (Unicode-aware, so
 * "in" never matches "in-ventory" and "về" stops before a space).
 */
const PATTERNS: readonly [RegExp, ActionKind][] = RULES.map(
  ([phrase, kind]) => [new RegExp(`^${phrase}(?!\\p{L})`, 'u'), kind],
)

/** Action kind implied by a button label, or `null` when none applies. */
export function inferAction(label: string): ActionKind | null {
  const text = label.trim().toLocaleLowerCase('vi').normalize('NFC')
  if (!text) return null
  return PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

/** Plain text of simple children (strings/numbers), or `null` for markup. */
export function textOf(children: unknown): string | null {
  if (typeof children === 'string' || typeof children === 'number')
    return String(children)
  if (Array.isArray(children)) {
    const parts = children.map(textOf)
    return parts.every((part) => part !== null) ? parts.join('') : null
  }
  return null
}
