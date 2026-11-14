from pydantic import TypeAdapter, ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError, AuthError
from app.modules.auth.service import AuthService, utc_now
from app.modules.auth.tokens import decode_access_token
from app.modules.dashboard.repository import DashboardRepository
from app.modules.dashboard.schemas import DashboardResponse, Month

DRAFT_READERS = {
    "stockReceipts": {"stock.receipt.prepare", "stock.receipt.post"},
    "stockIssues": {"stock.issue.prepare", "stock.issue.post"},
    "paymentReceipts": {"cash.receipt.prepare", "cash.receipt.post"},
}
SECTION_READERS = {
    "agencies": {"agency.read"},
    "sales": {"sales.read"},
    "collections": {"debt.read", "cash.receipt.post"},
    "debt": {"debt.read"},
    "drafts": set().union(*DRAFT_READERS.values()),
}
# Any section reader is admitted; every section is then projected by its own readers.
ADMISSION = tuple(sorted(set().union(*SECTION_READERS.values())))


def month_bounds(month):
    try:
        month = TypeAdapter(Month).validate_python(month)
    except ValidationError:
        raise ApiError(422, "VALIDATION_FAILED", "A valid YYYY-MM month is required") from None
    year, number = map(int, month.split("-"))
    ordinal = (year - 1) * 12 + number - 1
    months = [
        f"{index // 12 + 1:04d}-{index % 12 + 1:02d}"
        for index in range(max(0, ordinal - 11), ordinal + 1)
    ]
    # PostgreSQL accepts the exclusive year-10000 bound; Python date does not.
    end = f"{year + (number == 12):04d}-{number % 12 + 1:02d}-01"
    start = f"{month}-01"
    return {
        "start": start,
        "end": end,
        "trendStart": f"{months[0]}-01",
    }, months


class DashboardService:
    def __init__(self, engine, settings, delivery, *, limiter=None):
        self.engine, self.settings, self.delivery = engine, settings, delivery
        self.limiter = limiter

    def get(self, token, month):
        bounds, months = month_bounds(month)
        decode_access_token(self.settings, token, utc_now())
        with self.engine.connect() as connection:
            connection = connection.execution_options(
                isolation_level="REPEATABLE READ", postgresql_readonly=True
            )
            with connection.begin(), Session(bind=connection) as session:
                as_of = session.scalar(text("SELECT clock_timestamp()"))
                auth = AuthService(session, self.settings, self.delivery, memoize=True)
                principal = auth.authenticate(token)
                allowed = frozenset(auth.get_current_user(principal).allowedFunctions)
                if not allowed.intersection(ADMISSION):
                    raise AuthError(403, "FORBIDDEN", "Permission denied")
                if self.limiter is not None:
                    self.limiter(principal.user_id)
                repo = DashboardRepository(session)
                result = {"month": month, "asOf": as_of}
                for section, readers in SECTION_READERS.items():
                    if not allowed.intersection(readers):
                        continue
                    if section == "agencies":
                        result[section] = repo.agencies()
                    elif section == "sales":
                        result[section] = repo.sales(bounds, months)
                    elif section == "collections":
                        result[section] = repo.collections(bounds)
                    elif section == "debt":
                        result[section] = repo.debt()
                    else:
                        result[section] = repo.drafts(
                            [key for key, codes in DRAFT_READERS.items() if allowed & codes]
                        )
                return DashboardResponse.model_validate(result)
