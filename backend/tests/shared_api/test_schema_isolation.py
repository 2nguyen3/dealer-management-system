import pytest

from tests.support.supabase import rewrite_sql, validate_schema


def test_schema_rewrite_preserves_names_and_isolates_functions_and_migration_tracking():
    schema = "agentra_test_" + "a" * 32
    sql = "SELECT * FROM dms.document; SELECT current_setting('dms.actor_id');"
    assert rewrite_sql(sql, schema) == (
        f"SELECT * FROM {schema}.document; SELECT current_setting('{schema}.actor_id');"
    )
    assert rewrite_sql("SELECT * FROM public.alembic_version", schema) == (
        f"SELECT * FROM {schema}_meta.alembic_version"
    )
    assert rewrite_sql("SELECT 'not_dms', 'dms_verify_123'", schema) == (
        "SELECT 'not_dms', 'dms_verify_123'"
    )
    assert validate_schema(schema) == schema
    assert rewrite_sql("TRUNCATE DMS.app_user", schema) == f"TRUNCATE {schema}.app_user"
    with pytest.raises(TypeError):
        rewrite_sql(b"TRUNCATE dms.app_user", schema)


@pytest.mark.parametrize("schema", ["dms", "public", "agentra_test_", "a;DROP SCHEMA dms"])
def test_schema_isolation_rejects_non_generated_names(schema):
    with pytest.raises(ValueError):
        validate_schema(schema)
