import json


def test_canonical_wide_report_resource_measurement_and_visual_artifacts(
    tmp_path, monkeypatch, request
):
    monkeypatch.chdir(tmp_path)
    artifacts = request.getfixturevalue("report_resource_artifacts")
    measurements = json.loads(
        (artifacts / "m30-resource-measurements.json").read_text(encoding="utf-8")
    )
    assert not (tmp_path / "data").exists()
    assert {row["format"] for row in measurements} == {"xlsx", "pdf"}
    for row in measurements:
        artifact = artifacts / f"m30-visual-cash.{row['format']}"
        assert artifact.stat().st_size == row["bytes"] > 0
        assert row["rows"] == 105 and row["queryCount"] == 1
    print(json.dumps(measurements))
