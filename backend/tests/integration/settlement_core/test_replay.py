from datetime import date
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.seed import main as seed_demo
from app.modules.settlement_core.repository import SettlementRepository
from tests.integration.settlement_core.helpers import commit, financial, issue, service

pytestmark = pytest.mark.integration


def test_backdated_issue_then_receipt_replays_untouched_later_source_append_only(
    engine, actor, trading
):
    with Session(engine) as session:
        later = issue(session, actor, trading, day=5)
        receipt = financial(session, actor, trading[0], 102, day=6)
        service(session, actor).post_receipt(receipt, uuid4())
        commit(session)
        frozen = session.execute(
            text(
                'SELECT id,state,"totalAmount","businessDate" '
                "FROM dms.document_revision ORDER BY id"
            )
        ).all()
        original = session.execute(
            text("SELECT id,amount FROM dms.receivable_entry ORDER BY id")
        ).all()
        earlier = issue(session, actor, trading, day=2)
        plan = service(session, actor).replay(trading[0], uuid4(), permission="stock.issue.post")
        commit(session)
        assert plan.debt == 102
        repo = SettlementRepository(session)
        allocations = repo.effective(repo.source(receipt)["revisionId"], "receivable")
        assert len(allocations) == 1 and allocations[0]["issueDocumentId"] == earlier
        assert (
            session.execute(
                text(
                    'SELECT id,state,"totalAmount","businessDate" '
                    "FROM dms.document_revision WHERE id<=:last ORDER BY id"
                ),
                {"last": frozen[-1].id},
            ).all()
            == frozen
        )
        assert (
            session.execute(
                text("SELECT id,amount FROM dms.receivable_entry WHERE id<=:last ORDER BY id"),
                {"last": original[-1].id},
            ).all()
            == original
        )
        early_cash = financial(session, actor, trading[0], 102, day=4)
        service(session, actor).post_receipt(early_cash, uuid4())
        commit(session)
        allocations = repo.effective(repo.source(receipt)["revisionId"], "receivable")
        assert allocations[0]["issueDocumentId"] == later
        assert repo.balance(trading[0])["debt"] == 0
        assert (
            session.scalar(
                text(
                    'SELECT count(*) FROM dms.receivable_entry WHERE "reversesEntryId" IS NOT NULL'
                )
            )
            == 2
        )
        assert repo.balance(trading[0], (date(2026, 1, 4), 99999))["debt"] == 0


def test_full_seed_financial_replay_preserves_money_evidence_and_frozen_content(database_factory):
    with database_factory() as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch(
                "app.db.seed.get_settings",
                return_value=SimpleNamespace(database_url=lambda: engine.url),
            ),
        ):
            seed_demo()
        with Session(engine) as session:
            frozen = session.execute(
                text("SELECT to_jsonb(r) FROM dms.document_revision r ORDER BY id")
            ).all()
            evidence = {
                table: session.execute(
                    text(f"SELECT to_jsonb(t) FROM dms.{table} t ORDER BY id")
                ).all()
                for table in (
                    "online_payment",
                    "upfront_confirmation",
                    "refund_attempt",
                    "refund_reservation",
                )
            }
            actor = session.scalar(text("SELECT id FROM dms.app_user ORDER BY id LIMIT 1"))
            agencies = session.scalars(text("SELECT id FROM dms.agency ORDER BY id")).all()
            for agency_id in agencies:
                service(session, actor).replay(agency_id, uuid4(), permission="cash.receipt.post")
            commit(session)
            assert (
                session.execute(
                    text("SELECT to_jsonb(r) FROM dms.document_revision r ORDER BY id")
                ).all()
                == frozen
            )
            for table, before in evidence.items():
                assert (
                    session.execute(
                        text(f"SELECT to_jsonb(t) FROM dms.{table} t ORDER BY id")
                    ).all()
                    == before
                )
            for agency_id in agencies:
                row = SettlementRepository(session).balance(agency_id)
                cached = session.execute(
                    text(
                        'SELECT "currentDebt","currentCredit" '
                        'FROM dms.agency_balance WHERE "agencyId"=:id'
                    ),
                    {"id": agency_id},
                ).one()
                assert (row["debt"], row["credit"]) == tuple(cached)
