"""Explicit operator-created VNPAY sandbox payment on the user's running dev backend.

No fixture, tunnel change, schema creation or fixture cleanup. A successful IPN
creates a normal immutable cash receipt in the configured development database.
"""

import argparse
import json
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.config import Settings
from app.core.exceptions import AuthError
from app.db.seed import DEMO_USERS
from app.db.session import build_engine
from app.modules.auth.service import AuthService
from app.modules.online_payments.schemas import OnlinePaymentCreate
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter

ARTIFACT = Path(__file__).parents[3] / "data/backend/vnpay-dev-payment.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("create", "status"))
    args = parser.parse_args()
    settings = Settings()
    engine = build_engine(settings.database_url())
    try:
        if args.action == "status":
            saved = json.loads(ARTIFACT.read_text(encoding="utf-8"))
            with engine.connect() as connection:
                row = (
                    connection.execute(
                        text(
                            'SELECT id,status,"providerTransactionId","receiptDocumentId",'
                            '"paymentTime",amount FROM dms.online_payment WHERE id=:id'
                        ),
                        {"id": int(saved["paymentId"])},
                    )
                    .mappings()
                    .one()
                )
                print(
                    json.dumps(
                        {
                            **dict(row),
                            "eventCount": connection.scalar(
                                text(
                                    'SELECT count(*) FROM dms.payment_event WHERE "paymentId"=:id'
                                ),
                                {"id": int(saved["paymentId"])},
                            ),
                        },
                        default=str,
                    )
                )
            return
        if ARTIFACT.exists():
            saved = json.loads(ARTIFACT.read_text(encoding="utf-8"))
            if saved.get("paymentId"):
                print(
                    "Existing acceptance payment retained; use status instead of creating another"
                )
                return
        with httpx.Client(base_url="http://127.0.0.1:8000", timeout=30) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={
                    "email": DEMO_USERS[0][0],
                    "password": DEMO_USERS[0][3],
                },
            )
            login.raise_for_status()
            token = login.json()["accessToken"]
        with Session(engine) as session:
            auth = AuthService(session, settings, None)
            principal = auth.authenticate(token)

            def authorize(required):
                if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                    raise AuthError(403, "FORBIDDEN", "Permission denied")

            agency = (
                session.execute(
                    text(
                        'SELECT a.id,b."currentDebt" FROM dms.agency a JOIN dms.agency_balance b '
                        'ON b."agencyId"=a.id WHERE a.status=\'ACTIVE\' AND b."currentDebt">=10200 '
                        'ORDER BY b."currentDebt",a.id LIMIT 1'
                    )
                )
                .mappings()
                .one()
            )
            existing = (
                {} if not ARTIFACT.exists() else json.loads(ARTIFACT.read_text(encoding="utf-8"))
            )
            key = UUID(existing["commandKey"]) if existing else uuid4()
            ARTIFACT.write_text(json.dumps({"commandKey": str(key)}), encoding="utf-8")
            service = OnlinePaymentService(
                session,
                CursorCodec(settings.auth_signing_key.get_secret_value().encode()),
                principal.user_id,
                "vnpay-dev-acceptance",
                authorize,
                settings,
                VnpayAdapter(settings),
            )
            result = service.create(
                OnlinePaymentCreate(
                    agencyId=str(agency["id"]),
                    provider="VNPAY",
                    amount="10200",
                ),
                key,
            )
            saved = {
                "commandKey": str(key),
                "paymentId": result.body["id"],
                "agencyId": str(agency["id"]),
                "debtBefore": str(agency["currentDebt"]),
                "merchantReference": result.body["merchantReference"],
                "checkoutUrl": result.body["checkoutUrl"],
                "amount": "10200",
            }
            ARTIFACT.write_text(json.dumps(saved), encoding="utf-8")
            print(json.dumps({key: value for key, value in saved.items() if key != "checkoutUrl"}))
            print("Checkout URL saved locally; credentials/access token were not saved")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
