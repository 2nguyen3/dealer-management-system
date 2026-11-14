from fastapi import APIRouter

from app.modules.agencies.router import router as agencies_router
from app.modules.agency_types.router import router as agency_types_router
from app.modules.audit_logs.router import router as audit_logs_router
from app.modules.auth.router import router as auth_router
from app.modules.business_rules.router import router as business_rules_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.document_history.router import router as document_history_router
from app.modules.health.router import router as health_router
from app.modules.online_payments.router import router as online_payments_router
from app.modules.online_payments.vnpay_router import router as vnpay_router
from app.modules.payment_receipts.router import router as payment_receipts_router
from app.modules.permissions.router import router as permissions_router
from app.modules.products.router import router as products_router
from app.modules.reports.router import router as reports_router
from app.modules.stock_issues.router import router as stock_issues_router
from app.modules.stock_receipts.router import router as stock_receipts_router
from app.modules.units.router import router as units_router
from app.modules.user_groups.router import router as user_groups_router
from app.modules.users.router import router as users_router
from app.modules.wards.router import router as wards_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
router.include_router(user_groups_router)
router.include_router(users_router)
router.include_router(wards_router)
router.include_router(agency_types_router)
router.include_router(units_router)
router.include_router(permissions_router)
router.include_router(audit_logs_router)
router.include_router(business_rules_router)
router.include_router(products_router)
router.include_router(agencies_router)
router.include_router(stock_receipts_router)
router.include_router(stock_issues_router)
router.include_router(payment_receipts_router)
router.include_router(vnpay_router)
router.include_router(online_payments_router)
router.include_router(document_history_router)
router.include_router(reports_router)
router.include_router(dashboard_router)
