import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '../features/authentication/AuthContext'
import { LoginPage } from '../features/authentication/LoginPage'
import { NotFoundPage } from './NotFoundPage'
import { ProtectedRoute } from './ProtectedRoute'
import { ShellLayout } from './ShellLayout'

const HomePage = lazy(() =>
  import('../features/home/HomePage').then((m) => ({ default: m.HomePage })),
)
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
)
const ReportsPage = lazy(() =>
  import('../features/reports/ReportsPage').then((m) => ({
    default: m.ReportsPage,
  })),
)
const ChatbotPage = lazy(() =>
  import('../features/chatbot/ChatbotPage').then((m) => ({
    default: m.ChatbotPage,
  })),
)
const AgenciesPage = lazy(() =>
  import('../features/agencies/AgenciesPage').then((m) => ({
    default: m.AgenciesPage,
  })),
)
const AgencyCreditPage = lazy(() =>
  import('../features/agency_credit/AgencyCreditPage').then((m) => ({
    default: m.AgencyCreditPage,
  })),
)
const AgencyTypesPage = lazy(() =>
  import('../features/agency_types/AgencyTypesPage').then((m) => ({
    default: m.AgencyTypesPage,
  })),
)
const AuditLogsPage = lazy(() =>
  import('../features/audit_logs/AuditLogsPage').then((m) => ({
    default: m.AuditLogsPage,
  })),
)
const BusinessRulesPage = lazy(() =>
  import('../features/business_rules/BusinessRulesPage').then((m) => ({
    default: m.BusinessRulesPage,
  })),
)
const CreditApplicationsPage = lazy(() =>
  import('../features/credit_applications/CreditApplicationsPage').then(
    (m) => ({ default: m.CreditApplicationsPage }),
  ),
)
const DistrictsPage = lazy(() =>
  import('../features/districts/DistrictsPage').then((m) => ({
    default: m.DistrictsPage,
  })),
)
const DocumentHistoryPage = lazy(() =>
  import('../features/document_history/DocumentHistoryPage').then((m) => ({
    default: m.DocumentHistoryPage,
  })),
)
const DocumentCorrectionsPage = lazy(() =>
  import('../features/document_corrections/DocumentCorrectionsPage').then(
    (m) => ({ default: m.DocumentCorrectionsPage }),
  ),
)
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then((m) => ({
    default: m.InventoryPage,
  })),
)
const OnlinePaymentsPage = lazy(() =>
  import('../features/online_payments/OnlinePaymentsPage').then((m) => ({
    default: m.OnlinePaymentsPage,
  })),
)
const PaymentReceiptsPage = lazy(() =>
  import('../features/payment_receipts/PaymentReceiptsPage').then((m) => ({
    default: m.PaymentReceiptsPage,
  })),
)
const PermissionsPage = lazy(() =>
  import('../features/permissions/PermissionsPage').then((m) => ({
    default: m.PermissionsPage,
  })),
)
const ProductsPage = lazy(() =>
  import('../features/products/ProductsPage').then((m) => ({
    default: m.ProductsPage,
  })),
)
const ReceivablesPage = lazy(() =>
  import('../features/receivables/ReceivablesPage').then((m) => ({
    default: m.ReceivablesPage,
  })),
)
const RefundsPage = lazy(() =>
  import('../features/refunds/RefundsPage').then((m) => ({
    default: m.RefundsPage,
  })),
)
const SalesReturnsPage = lazy(() =>
  import('../features/sales_returns/SalesReturnsPage').then((m) => ({
    default: m.SalesReturnsPage,
  })),
)
const StockAdjustmentsPage = lazy(() =>
  import('../features/stock_adjustments/StockAdjustmentsPage').then((m) => ({
    default: m.StockAdjustmentsPage,
  })),
)
const StockCountsPage = lazy(() =>
  import('../features/stock_counts/StockCountsPage').then((m) => ({
    default: m.StockCountsPage,
  })),
)
const StockIssuesPage = lazy(() =>
  import('../features/stock_issues/StockIssuesPage').then((m) => ({
    default: m.StockIssuesPage,
  })),
)
const StockReceiptsPage = lazy(() =>
  import('../features/stock_receipts/StockReceiptsPage').then((m) => ({
    default: m.StockReceiptsPage,
  })),
)
const UnitsPage = lazy(() =>
  import('../features/units/UnitsPage').then((m) => ({ default: m.UnitsPage })),
)
const UpfrontPaymentsPage = lazy(() =>
  import('../features/upfront_payments/UpfrontPaymentsPage').then((m) => ({
    default: m.UpfrontPaymentsPage,
  })),
)
const UserGroupsPage = lazy(() =>
  import('../features/user_groups/UserGroupsPage').then((m) => ({
    default: m.UserGroupsPage,
  })),
)
const UsersPage = lazy(() =>
  import('../features/users/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const ForgotPasswordPage = lazy(() =>
  import('../features/authentication/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
)
const ResetPasswordPage = lazy(() =>
  import('../features/authentication/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
)

export function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Đang mở màn hình">
      <div />
      <div />
      <div />
      <span className="sr-only">Đang mở màn hình…</span>
    </div>
  )
}

export class PageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <div className="state-page">
          <section className="state-card" role="alert">
            <h1>Không thể mở màn hình</h1>
            <p>
              Giao diện gặp lỗi tải. Dữ liệu chưa gửi sẽ không tự động được ghi
              nhận.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--md"
              onClick={() => window.location.reload()}
            >
              Tải lại giao diện
            </button>
          </section>
        </div>
      )
    return this.props.children
  }
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PageErrorBoundary>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <ShellLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<HomePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/chatbot" element={<ChatbotPage />} />
                <Route path="/agencies" element={<AgenciesPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/districts" element={<DistrictsPage />} />
                <Route path="/agency-types" element={<AgencyTypesPage />} />
                <Route path="/units" element={<UnitsPage />} />
                <Route path="/business-rules" element={<BusinessRulesPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/user-groups" element={<UserGroupsPage />} />
                <Route path="/permissions" element={<PermissionsPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route
                  path="/document-history"
                  element={<DocumentHistoryPage />}
                />
                <Route
                  path="/document-corrections"
                  element={<DocumentCorrectionsPage />}
                />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/stock-receipts" element={<StockReceiptsPage />} />
                <Route path="/stock-issues" element={<StockIssuesPage />} />
                <Route
                  path="/payment-receipts"
                  element={<PaymentReceiptsPage />}
                />
                <Route
                  path="/upfront-payments"
                  element={<UpfrontPaymentsPage />}
                />
                <Route
                  path="/online-payments"
                  element={<OnlinePaymentsPage />}
                />
                <Route path="/receivables" element={<ReceivablesPage />} />
                <Route path="/sales-returns" element={<SalesReturnsPage />} />
                <Route
                  path="/credit-applications"
                  element={<CreditApplicationsPage />}
                />
                <Route path="/refunds" element={<RefundsPage />} />
                <Route
                  path="/stock-adjustments"
                  element={<StockAdjustmentsPage />}
                />
                <Route path="/stock-counts" element={<StockCountsPage />} />
                <Route path="/agency-credit" element={<AgencyCreditPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </PageErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
