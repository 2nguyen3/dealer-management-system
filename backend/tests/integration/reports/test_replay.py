from datetime import date
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

import pytest
from pypdf import PdfReader
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.reports.exporting import render_pdf, render_xlsx
from app.modules.reports.service import REPORTS, ReportService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.helpers import install_builders, product
from tests.integration.document_corrections import helpers as goods
from tests.integration.document_corrections import test_financial_periods as workflows
from tests.integration.document_corrections.manual_helpers import (
    manual_body,
    manual_condition,
    manual_service,
    timeline,
)
from tests.integration.document_corrections.test_return_credit import match
from tests.integration.reports.test_queries import assert_report_oracles
from tests.reports.test_exports import workbook_rows

pytestmark = pytest.mark.integration


def test_goods_adjustment_and_manual_receipt_moves_cancels_reconcile_every_report(
    engine, actor, trading
):
    for kind in ("STOCK_RECEIPT", "STOCK_ADJUSTMENT"):
        with Session(engine) as session:
            install_builders(session, actor)
            product_id = (
                product(session, session.scalar(text('SELECT "unitId" FROM dms.product LIMIT 1')))
                if kind == "STOCK_RECEIPT"
                else trading[1]
            )
            identifier = session.scalar(
                text("""
                SELECT pg_temp.stock_draft(:kind,NULL,DATE '2026-01-02',
                  jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
                    'quantity',CAST(:quantity AS numeric),'price',CAST(:price AS numeric))),
                    gen_random_uuid())
            """),
                {
                    "kind": kind,
                    "product": product_id,
                    "quantity": 3 if kind == "STOCK_RECEIPT" else -3,
                    "price": 100 if kind == "STOCK_RECEIPT" else 0,
                },
            )
            session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": identifier})
            session.commit()
        assert_report_oracles(engine)
        with Session(engine) as session:
            correction = goods.service(session, actor, kind)
            correction.correct(
                identifier,
                goods.replacement(
                    str(product_id),
                    kind=kind,
                    quantity="2" if kind == "STOCK_RECEIPT" else "-1",
                    day="2026-02-02",
                ),
                match(correction.owner, identifier),
                uuid4(),
            )
        assert_report_oracles(engine)
        with Session(engine) as session:
            correction = goods.service(session, actor, kind)
            correction.cancel_document(
                identifier,
                Reason(reason="Report reversal witness"),
                match(correction.owner, identifier),
                uuid4(),
            )
        assert_report_oracles(engine)
    _, receipts = timeline(engine, actor, trading)
    identifier = receipts[0]
    assert_report_oracles(engine)
    with Session(engine) as session:
        manual_service(session, actor).correct(
            identifier,
            manual_body("100", day="2026-02-02"),
            manual_condition(engine, actor, identifier),
            uuid4(),
        )
    assert_report_oracles(engine)
    with Session(engine) as session:
        manual_service(session, actor).cancel(
            identifier,
            Reason(reason="False cash record"),
            manual_condition(engine, actor, identifier),
            uuid4(),
        )
    assert_report_oracles(engine)


@pytest.mark.parametrize(
    "workflow",
    [
        workflows.test_issue_and_auto_receipt_move_then_cancel_restate_original_periods,
        workflows.test_paid_return_move_then_cancel_restate_stock_and_credit_periods,
        workflows.test_credit_move_then_cancel_restate_offset_period_without_new_cash,
    ],
)
def test_reports_follow_every_committed_m29_move_cancel_and_replay(
    engine, actor, trading, workflow
):
    original = workflows.period_oracle
    checkpoints = []

    def reconcile(*args, **kwargs):
        original(*args, **kwargs)
        assert_report_oracles(engine)
        checkpoints.append(True)

    # Reuse real owning M29 workflows, adding independent report checks after
    # EACH commit, not replacing any of their persisted/provenance assertions.
    with patch.object(workflows, "period_oracle", side_effect=reconcile):
        workflow(engine, actor, trading)
    assert len(checkpoints) == 3
    with Session(engine) as session:
        service = ReportService(session, CursorCodec(b"r" * 32))
        for kind in REPORTS:
            dataset = service.read(kind, date(2026, 1, 1), date(2026, 3, 1), export=True)
            workbook = workbook_rows(render_xlsx(dataset))
            actual = [[value for _, value in row[2:]] for row in workbook[1][1:]]
            assert actual == [
                [str(row[key]) for key, _ in dataset["columns"]] for row in dataset["rows"]
            ]
            pdf = PdfReader(BytesIO(render_pdf(dataset)))
            output = "\n".join(page.extract_text() for page in pdf.pages)
            for row in dataset["rows"]:
                assert all(str(value) in output for value in row.values())
            if dataset["totals"] is not None:
                for key, value in dataset["totals"].items():
                    assert f"{key}: {value}" in output
