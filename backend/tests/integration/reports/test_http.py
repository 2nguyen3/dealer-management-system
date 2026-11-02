from io import BytesIO
from pathlib import Path
from time import perf_counter
from zipfile import ZipFile

import pytest
from pypdf import PdfReader
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.request_context import set_audit_context
from app.modules.reports.service import ReportService
from tests.integration.catalogues.helpers import install_builders
from tests.integration.document_corrections.test_http import grants
from tests.reports.test_exports import workbook_rows

pytestmark = pytest.mark.integration
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_report_http_all_formats_live_grants_and_uncapped_exports(client, engine, actor, trading):
    with Session(engine) as session:
        install_builders(session, actor)
        set_audit_context(session, actor, "m30-export-fixtures")
        # One server-side fixture block avoids hundreds of remote round trips.
        # All facts pass the ordinary immutable-ledger/deferred guards.
        session.execute(
            text("""
        DO $$ DECLARE n integer; a bigint; p bigint; u integer; incoming bigint;
          outgoing bigint; cash bigint;
        BEGIN
          UPDATE dms.business_rule SET "maxAgenciesPerDistrict"=200 WHERE id;
          SELECT "unitId" INTO u FROM dms.product ORDER BY id LIMIT 1;
          FOR n IN 1..101 LOOP
            INSERT INTO dms.agency(name,"typeId","districtId","acceptedDate",email)
              VALUES (CASE WHEN n<=2 THEN 'Agency marker shared'
                ELSE 'Agency marker '||lpad(n::text,3,'0') END,1,1,'2026-01-01',
                'reports-'||n::text||'@example.test') RETURNING id INTO a;
            INSERT INTO dms.product(name,"unitId")
              VALUES (CASE WHEN n<=2 THEN 'Export marker shared'
                ELSE 'Export marker '||lpad(n::text,3,'0') END,u) RETURNING id INTO p;
            incoming := pg_temp.stock_draft('STOCK_RECEIPT',NULL,'2026-01-01',
              jsonb_build_array(jsonb_build_object('product',p,'quantity',3,'price',100)),
              gen_random_uuid());
            PERFORM pg_temp.post_stock(incoming);
            PERFORM pg_temp.flush_checks();
            outgoing := pg_temp.stock_draft('STOCK_ISSUE',a,'2026-01-02',
              jsonb_build_array(jsonb_build_object('product',p,'quantity',1)),gen_random_uuid());
            PERFORM pg_temp.post_stock(outgoing);
            PERFORM pg_temp.flush_checks();
            cash := pg_temp.financial('PAYMENT_RECEIPT',a,'2026-01-03',1,'CASH',
              'DEBT_COLLECTION',NULL,gen_random_uuid());
            PERFORM pg_temp.fifo(cash);
            PERFORM pg_temp.flush_checks();
          END LOOP;
        END $$
        """)
        )
        session.commit()
    for kind, permission in (
        ("sales", "sales.read"),
        ("debt", "debt.read"),
        ("inventory", "inventory.read"),
        ("product-sales", "sales.read"),
        ("cash-and-credit", "debt.read"),
    ):
        url = f"/api/v1/reports/{kind}?fromDate=2026-01-01&toDate=2026-02-01"
        for missing in ("reports.read", permission):
            grants(engine, [grant for grant in ("reports.read", permission) if grant != missing])
            for media in ("application/json", XLSX, "application/pdf"):
                denied = client.get(url, headers={"Accept": media})
                assert denied.status_code == 403, denied.text
        grants(engine, ["reports.read", permission])
        result = client.get(url + "&limit=1")
        assert result.status_code == 200, result.text
        assert result.json()["pagination"]["limit"] == 1
        assert result.json()["pagination"]["hasMore"] is True
        statements = []

        def observed(*args, statements=statements):
            statements.append(args[2])

        event.listen(engine, "before_cursor_execute", observed)
        started = perf_counter()
        try:
            with Session(engine) as session:
                expected = ReportService(session, CursorCodec(b"r" * 32)).read(
                    kind, "2026-01-01", "2026-02-01", export=True
                )
        finally:
            event.remove(engine, "before_cursor_execute", observed)
        assert len(statements) == 1
        print(
            f"M30 query {kind}: statements=1 rows={len(expected['rows'])} "
            f"seconds={perf_counter() - started:.3f}"
        )
        assert len(expected["rows"]) == (102 if kind == "inventory" else 101)
        if expected["totals"] is not None:
            assert expected["totals"] == result.json()["totals"]
        for media in (XLSX, "application/pdf"):
            started = perf_counter()
            exported = client.get(
                url + "&limit=bad&sort=bad&cursor=foreign", headers={"Accept": media}
            )
            assert exported.status_code == 200, exported.text[:1000]
            assert exported.headers["Content-Type"] == media
            assert exported.headers["Cache-Control"] == "no-store"
            assert "attachment" in exported.headers["Content-Disposition"]
            print(
                f"M30 resource {kind} {media}: rows={len(expected['rows'])} "
                f"bytes={len(exported.content)} seconds={perf_counter() - started:.3f}"
            )
            if media == XLSX:
                sheets = workbook_rows(exported.content)
                logical = [[value for _, value in cells[2:]] for cells in sheets[1][1:]]
                assert logical == [
                    [str(row[key]) for key, _ in expected["columns"]] for row in expected["rows"]
                ]
                if expected["totals"] is not None:
                    assert [value for _, value in sheets[2][1][2:]] == [
                        str(value) for value in expected["totals"].values()
                    ]
                with ZipFile(BytesIO(exported.content)) as workbook:
                    xml = b"".join(
                        workbook.read(name) for name in workbook.namelist() if name.endswith(".xml")
                    )
                assert b"<f>" not in xml and b"<hyperlink " not in xml
                if kind == "inventory":
                    assert b"Export marker 101" in xml
                    assert result.json()["pagination"]["hasMore"] is True
            else:
                pdf = PdfReader(BytesIO(exported.content))
                output = "\n".join(page.extract_text() for page in pdf.pages)
                for row in expected["rows"]:
                    for value in row.values():
                        assert str(value) in output
                if expected["totals"] is not None:
                    for key, value in expected["totals"].items():
                        assert f"{key}: {value}" in output
                (Path("../data/backend") / f"m30-full-{kind}.pdf").write_bytes(exported.content)
                if kind == "inventory":
                    assert "Export marker 101" in output
                    assert len(pdf.pages) > 1
        bad = client.get(url.replace("2026-02-01", "2025-01-01"))
        assert bad.status_code == 422, bad.text
        unsupported = client.get(url, headers={"Accept": "text/html"})
        assert unsupported.status_code == 406, unsupported.text
