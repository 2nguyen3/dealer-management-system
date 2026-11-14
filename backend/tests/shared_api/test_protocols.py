import base64
import hmac
import json
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from jsonschema import ValidationError as SchemaValidationError
from sqlalchemy import column
from sqlalchemy.exc import DBAPIError
from starlette.requests import Request

from app.common.pagination import CursorCodec, SortSpec, build_page, literal_search
from app.common.preconditions import canonical_etag, parse_preconditions, read_preconditions
from app.core.exceptions import ApiError
from app.core.transactions import translate_database_error
from tests.support.contract import SOURCE, assert_schema, transport_matrix
from tests.support.database import guarded_test_url


def test_cursor_scope_tamper_and_typed_keys():
    codec = CursorCodec(b"x" * 32)
    scope = ["listDocuments", "parent:1", {"sort": "-id", "kinds": ["STOCK_ISSUE"]}]
    values = ["x", 3, Decimal("1.250"), date(2026, 1, 1), datetime(2026, 1, 1, tzinfo=UTC)]
    types = [str, int, Decimal, date, datetime]
    token = codec.encode(scope, values)
    assert codec.decode(token, scope, types) == tuple(values)
    for invalid, other_scope, other_types in (
        ("", scope, types),
        ("x" * 8193, scope, types),
        ("!", scope, types),
        (token[:-10], scope, types),
        (token + "x", scope, types),
        (token, ["listOther"], types),
        (token, scope, [str]),
        (token, scope, [int, str, Decimal, date, datetime]),
    ):
        with pytest.raises(ApiError) as caught:
            codec.decode(invalid, other_scope, other_types)
        assert caught.value.code == "INVALID_CURSOR"
    for keys, key_types in (
        ([True], [int]),
        (["NaN"], [Decimal]),
        (["no"], [Decimal]),
        (["bad"], [date]),
        (["bad"], [datetime]),
        (["x"], [float]),
    ):
        with pytest.raises(ApiError):
            codec.decode(codec.encode(scope, keys), scope, key_types)
    raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    original = json.loads(raw[:-32])
    for overrides in ({"v": 2}, {"v": True}, {"keys": {}}, {"extra": True}):
        payload = json.dumps(original | overrides).encode()
        altered = base64.urlsafe_b64encode(
            payload + hmac.digest(codec.key, payload, "sha256")
        ).decode()
        with pytest.raises(ApiError):
            codec.decode(altered, scope, types)
    for payload in (b"[]", b"{", b"\xff"):
        altered = base64.urlsafe_b64encode(
            payload + hmac.digest(codec.key, payload, "sha256")
        ).decode()
        with pytest.raises(ApiError):
            codec.decode(altered, scope, types)
    with pytest.raises(ValueError):
        codec.encode(scope, ["x" * 10000])
    with pytest.raises(ValueError):
        CursorCodec(b"short")


def test_etags_and_preconditions():
    projection = {"id": "1", "lines": [{"id": "2", "amount": "10"}], "balance": "0"}
    etag = canonical_etag("document:1", projection)
    assert canonical_etag("document:1", dict(reversed(list(projection.items())))) == etag
    for resource, change in (
        ("document:2", projection),
        ("document:1", projection | {"balance": "1"}),
        ("document:1", projection | {"lines": [{"id": "3", "amount": "10"}]}),
    ):
        assert canonical_etag(resource, change) != etag
    parse_preconditions(etag).compare(etag)
    # CDN compression (Vercel br/gzip) weakens issued ETags; the opaque tag still matches.
    assert parse_preconditions("W/" + etag).match == etag
    parse_preconditions("W/" + etag).compare(etag)
    parse_preconditions(None, "*", allow_create=True).compare(None)
    for headers, status in (
        ((None, None), 428),
        (("*", None), 422),
        (("W/", None), 422),
        (("w/" + etag, None), 422),
        (("W/W/" + etag, None), 422),
        (("W/" + etag + "," + etag, None), 422),
        ((etag + "," + etag, None), 422),
        ((etag, "*"), 422),
        ((None, etag), 422),
        ((None, "*"), 422),
    ):
        with pytest.raises(ApiError) as caught:
            parse_preconditions(*headers)
        assert caught.value.status == status
    for precondition, current in (
        (parse_preconditions('"old"'), etag),
        (parse_preconditions('W/"old"'), etag),
        (parse_preconditions(None, "*", allow_create=True), etag),
        (parse_preconditions('"old"'), None),
    ):
        with pytest.raises(ApiError) as caught:
            precondition.compare(current)
        assert caught.value.status == 412
        assert caught.value.headers == ({} if current is None else {"ETag": current})


def test_page_sort_and_search():
    codec = CursorCodec(b"x" * 32)
    for limit in (1, 25, 100):
        items, page = build_page(list(range(limit + 1)), limit, codec, "scope", lambda x: [x])
        assert len(items) == limit and page.hasMore
        assert codec.decode(page.nextCursor, "scope", [int]) == (limit - 1,)
        assert_schema(page.model_dump(), "Pagination")
    for rows in ([], [1]):
        items, page = build_page(rows, 25, codec, "scope", lambda x: [x])
        assert items == rows and not page.hasMore and page.nextCursor is None
    for limit in (0, 101, True):
        with pytest.raises(ApiError):
            build_page([], limit, codec, "scope", lambda x: [x])
    assert literal_search(r"  a%_\  ") == r"%a\%\_\\%"
    with pytest.raises(ApiError):
        literal_search(" \t")
    with pytest.raises(ApiError):
        SortSpec.parse("name; DROP TABLE x", {"name": ("name", "id")})
    for values in ([], ["a"], ["a", None]):
        with pytest.raises(ApiError):
            SortSpec(("name", "id"), False).after({}, values)
    # Nullable leading fields follow PostgreSQL order: NULL last ascending, first descending.
    columns = {"name": column("name"), "id": column("id")}
    for descending, value, expected in (
        (False, None, "false"),
        (True, None, "name IS NOT NULL"),
        (False, "a", "name IS NULL"),
        (True, "a", "name < :name_1"),
    ):
        sql = str(SortSpec(("name", "id"), descending).after(columns, [value, 1]))
        assert expected in sql and "IS NOT DISTINCT FROM" in sql


def db_error(state=None, constraint=None, *, invalidated=False):
    return DBAPIError(
        "secret SQL",
        {"password": "sentinel"},
        SimpleNamespace(sqlstate=state, diag=SimpleNamespace(constraint_name=constraint)),
        connection_invalidated=invalidated,
    )


def test_transaction_error_translation():
    for state, expected in (("55P03", 409), ("23505", 500), (None, 500)):
        mapped = translate_database_error(db_error(state), {})
        assert mapped.status == expected and "sentinel" not in mapped.message
    mapped = translate_database_error(
        db_error("23505", "unique_name"),
        {("23505", "unique_name"): ("CODE_TAKEN", "Code already used")},
    )
    assert mapped.code == "CODE_TAKEN"


def test_shared_harness_and_contract(monkeypatch):
    matrix = transport_matrix()
    # 0011 simplification: 90 runtime operations (three document kinds, VNPAY, reads),
    # plus printOnlinePayment (payment request with QR).
    assert len(matrix) == 91 and len({item["operationId"] for item in matrix}) == 91
    for item in matrix:
        assert item["responses"] and item["method"] in ("GET", "POST", "PATCH", "PUT", "DELETE")
    assert any(item["bodyRequired"] for item in matrix)
    assert any(item["method"] == "POST" and not item["bodyRequired"] for item in matrix)
    assert SOURCE["components"]["parameters"]["IfMatch"]["required"]
    for raw in (None, "sqlite:///agentra_business_test", "postgresql+psycopg://localhost/postgres"):
        with pytest.raises(RuntimeError):
            guarded_test_url(raw, suite="business")
    with pytest.raises(ValueError):
        guarded_test_url(None, suite="typo")
    monkeypatch.setenv("DB_NAME", "agentra_business_test")
    raw = "postgresql+psycopg://localhost/agentra_business_test"
    with pytest.raises(RuntimeError):
        guarded_test_url(raw, suite="business")
    monkeypatch.setenv("DB_NAME", "postgres")
    assert guarded_test_url(raw, suite="business").database == "agentra_business_test"
    for invalid in ("not-a-date", "2026-01-01T00:00:00", "2026-02-29T00:00:00Z"):
        with pytest.raises(SchemaValidationError):
            assert_schema(invalid, "NullableInstant")


def test_duplicate_header_and_create_transport():
    def request(headers):
        return Request({"type": "http", "path": "/probe", "headers": headers})

    for headers in (
        [(b"if-match", b'"a"'), (b"if-match", b'"b"')],
        [(b"if-none-match", b"*"), (b"if-none-match", b"*")],
    ):
        with pytest.raises(ApiError):
            read_preconditions(request(headers), allow_create=True)
    read_preconditions(request([(b"if-none-match", b"*")]), allow_create=True).compare(None)
    read_preconditions(request([(b"if-match", b'"a"')])).compare('"a"')
    with pytest.raises(ApiError) as caught:
        read_preconditions(request([]))
    assert caught.value.status == 428


def test_contract_instants_require_rfc3339_format_checker():
    with patch("tests.support.contract.FormatChecker", return_value=Mock(checkers={})):
        with pytest.raises(RuntimeError, match="RFC3339"):
            assert_schema("2026-01-01T00:00:00Z", "NullableInstant")
