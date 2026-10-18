from tests.support.database import race_timeout


def test_remote_race_budget_is_explicit_and_keeps_local_defaults(monkeypatch):
    monkeypatch.delenv("SUPABASE_TEST_SCHEMAS", raising=False)
    assert race_timeout(5) == 5
    monkeypatch.setenv("SUPABASE_TEST_SCHEMAS", "1")
    assert race_timeout(5) == 50
    monkeypatch.setenv("SUPABASE_TEST_SCHEMAS", "0")
    assert race_timeout(5) == 5
