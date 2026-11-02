import { BrowserRouter, Route, Routes } from 'react-router'
import { AgenciesPage } from '../features/agencies/AgenciesPage'
import { AgencyCreditPage } from '../features/agency_credit/AgencyCreditPage'
import { AgencyTypesPage } from '../features/agency_types/AgencyTypesPage'
import { AuditLogsPage } from '../features/audit_logs/AuditLogsPage'
import { AuthProvider } from '../features/authentication/AuthContext'
import { ForgotPasswordPage } from '../features/authentication/ForgotPasswordPage'
import { LoginPage } from '../features/authentication/LoginPage'
import { ResetPasswordPage } from '../features/authentication/ResetPasswordPage'
import { BusinessRulesPage } from '../features/business_rules/BusinessRulesPage'
import { ChatbotPage } from '../features/chatbot/ChatbotPage'
import { CreditApplicationsPage } from '../features/credit_applications/CreditApplicationsPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { DistrictsPage } from '../features/districts/DistrictsPage'
import { DocumentHistoryPage } from '../features/document_history/DocumentHistoryPage'
import { DocumentCorrectionsPage } from '../features/document_corrections/DocumentCorrectionsPage'
import { HomePage } from '../features/home/HomePage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { OnlinePaymentsPage } from '../features/online_payments/OnlinePaymentsPage'
import { PaymentReceiptsPage } from '../features/payment_receipts/PaymentReceiptsPage'
import { PermissionsPage } from '../features/permissions/PermissionsPage'
import { ProductsPage } from '../features/products/ProductsPage'
import { ReceivablesPage } from '../features/receivables/ReceivablesPage'
import { RefundsPage } from '../features/refunds/RefundsPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { SalesReturnsPage } from '../features/sales_returns/SalesReturnsPage'
import { StockAdjustmentsPage } from '../features/stock_adjustments/StockAdjustmentsPage'
import { StockCountsPage } from '../features/stock_counts/StockCountsPage'
import { StockIssuesPage } from '../features/stock_issues/StockIssuesPage'
import { StockReceiptsPage } from '../features/stock_receipts/StockReceiptsPage'
import { UnitsPage } from '../features/units/UnitsPage'
import { UpfrontPaymentsPage } from '../features/upfront_payments/UpfrontPaymentsPage'
import { UserGroupsPage } from '../features/user_groups/UserGroupsPage'
import { UsersPage } from '../features/users/UsersPage'
import { NotFoundPage } from './NotFoundPage'
import { ProtectedRoute } from './ProtectedRoute'
import { ShellLayout } from './ShellLayout'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <ShellLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chatbot"
              element={
                <ProtectedRoute>
                  <ChatbotPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agencies"
              element={
                <ProtectedRoute requiredPermission="agency.read">
                  <AgenciesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute requiredPermission="product.manage">
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/districts"
              element={
                <ProtectedRoute requiredPermission="district.manage">
                  <DistrictsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agency-types"
              element={
                <ProtectedRoute requiredPermission="agency_type.manage">
                  <AgencyTypesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/units"
              element={
                <ProtectedRoute requiredPermission="unit.manage">
                  <UnitsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/business-rules"
              element={
                <ProtectedRoute requiredPermission="rules.manage">
                  <BusinessRulesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission="users.manage">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-groups"
              element={
                <ProtectedRoute requiredPermission="groups.manage">
                  <UserGroupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/permissions"
              element={
                <ProtectedRoute requiredPermission="permissions.manage">
                  <PermissionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute requiredPermission="audit.read">
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/document-history"
              element={
                <ProtectedRoute>
                  <DocumentHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/document-corrections"
              element={
                <ProtectedRoute
                  requiredPermission={['documents.correct', 'documents.cancel']}
                >
                  <DocumentCorrectionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute
                  requiredPermission={[
                    'reports.read',
                    'sales.read',
                    'debt.read',
                    'inventory.read',
                  ]}
                >
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute requiredPermission="inventory.read">
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-receipts"
              element={
                <ProtectedRoute
                  requiredPermission={[
                    'stock.receipt.prepare',
                    'stock.receipt.post',
                  ]}
                >
                  <StockReceiptsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-issues"
              element={
                <ProtectedRoute
                  requiredPermission={[
                    'stock.issue.prepare',
                    'stock.issue.post',
                  ]}
                >
                  <StockIssuesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment-receipts"
              element={
                <ProtectedRoute
                  requiredPermission={[
                    'cash.receipt.prepare',
                    'cash.receipt.post',
                  ]}
                >
                  <PaymentReceiptsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upfront-payments"
              element={
                <ProtectedRoute requiredPermission="cash.upfront.verify">
                  <UpfrontPaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/online-payments"
              element={
                <ProtectedRoute
                  requiredPermission={['payments.online', 'debt.read']}
                >
                  <OnlinePaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receivables"
              element={
                <ProtectedRoute requiredPermission="debt.read">
                  <ReceivablesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-returns"
              element={
                <ProtectedRoute
                  requiredPermission={['returns.prepare', 'returns.post']}
                >
                  <SalesReturnsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/credit-applications"
              element={
                <ProtectedRoute
                  requiredPermission={['credit.apply', 'debt.read']}
                >
                  <CreditApplicationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/refunds"
              element={
                <ProtectedRoute
                  requiredPermission={[
                    'cash.refund.prepare',
                    'cash.refund.post',
                    'debt.read',
                  ]}
                >
                  <RefundsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-adjustments"
              element={
                <ProtectedRoute
                  requiredPermission={[
                    'stock.adjustment.prepare',
                    'stock.adjustment.post',
                  ]}
                >
                  <StockAdjustmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-counts"
              element={
                <ProtectedRoute requiredPermission="stock.count">
                  <StockCountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agency-credit"
              element={
                <ProtectedRoute requiredPermission="agency.read">
                  <AgencyCreditPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
