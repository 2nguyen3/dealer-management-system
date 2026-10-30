import json
import tracemalloc
from time import perf_counter

import pytest

from app.modules.reports.exporting import PDF_MEDIA, XLSX_MEDIA, render_report
from tests.reports.test_paging import END, START, service_with_rows
from tests.reports.test_schemas import example_row


@pytest.fixture(scope="session")
def report_resource_artifacts(tmp_path_factory):
    output = tmp_path_factory.mktemp("report-resources")
    rows = [example_row("cash-and-credit", str(index)) for index in range(1, 106)]
    rows[0]["agencyName"] = "\u0110\u1ea1i l\u00fd Nguy\u1ec5n \u00c1nh <b>& =SUM(A1) " + "X" * 1800
    rows[1]["cashReceived"] = "1234567890123456789012345678901234567890"
    rows[2]["agencyName"] = "\u0110\u01a1n v\u1ecb l\u1ebb"
    service = service_with_rows("cash-and-credit", rows)
    started = perf_counter()
    dataset = service.read("cash-and-credit", START, END, export=True)
    projection_seconds = perf_counter() - started
    measurements = []
    for media, extension in ((XLSX_MEDIA, "xlsx"), (PDF_MEDIA, "pdf")):
        tracemalloc.start()
        started = perf_counter()
        try:
            content, chosen, _ = render_report(dataset, media)
            elapsed = perf_counter() - started
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
        assert chosen == media and content
        (output / f"m30-visual-cash.{extension}").write_bytes(content)
        measurements.append(
            {
                "format": extension,
                "rows": len(rows),
                "bytes": len(content),
                "projectionSeconds": projection_seconds,
                "renderSeconds": elapsed,
                "peakPythonBytes": peak,
                "queryCount": service.queries.read.call_count,
                "scope": "mocked query; canonical projection and actual renderer; "
                "in-memory, no spool",
            }
        )
    (output / "m30-resource-measurements.json").write_text(
        json.dumps(measurements, indent=2), encoding="utf-8"
    )
    return output
