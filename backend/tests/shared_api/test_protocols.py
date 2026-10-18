import base64
import hmac
import json
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from jsonschema import ValidationError as SchemaValidationError
from sqlalchemy.exc import DBAPIError
from starlette.requests import Request

from app.common.commands import (
    CommandRepository,
    CommandResult,
    CommandScope,
    internal_substep_key,
    request_fingerprint,
    validate_safe_result,
)
from app.common.pagination import CursorCodec, SortSpec, build_page, literal_search
from app.common.preconditions import canonical_etag, parse_preconditions, read_preconditions
from app.core.exceptions import ApiError
from app.core.transactions import TransactionRunner, translate_database_error
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
    parse_preconditions(None, "*", allow_create=True).compare(None)
    for headers, status in (
        ((None, None), 428),
        (("*", None), 422),
        (("W/" + etag, None), 422),
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
    for values in ([], [None, 1]):
        with pytest.raises(ApiError):
            SortSpec(("name", "id"), False).after({}, values)


def test_command_identity_and_safe_results():
    one = uuid4()
    assert internal_substep_key(one, "receipt") == internal_substep_key(one, "receipt")
    assert internal_substep_key(one, "receipt") != internal_substep_key(one, "batch")
    assert internal_substep_key(one, "receipt") != internal_substep_key(uuid4(), "receipt")
    assert request_fingerprint({"a": Decimal("1.00"), "b": None}) == request_fingerprint(
        {"b": None, "a": Decimal("1")}
    )
    assert request_fingerprint({}) != request_fingerprint({"a": None})
    assert request_fingerprint([1, 2]) != request_fingerprint([2, 1])
    with pytest.raises(ValueError):
        internal_substep_key(one, "")
    assert CommandScope(1, "postStockIssue", "document:1", one)
    for values in (
        (0, "op", "r", one),
        (True, "op", "r", one),
        (2**63, "op", "r", one),
        (1, "bad-op", "r", one),
        (1, "op", "", one),
        (1, "op", "r", "x"),
    ):
        with pytest.raises(ValueError):
            CommandScope(*values)
    for body in (
        {"password": "sentinel"},
        {"nested": [{"tokenDigest": "sentinel"}]},
        {1: "x"},
        {"amount": 1.0},
    ):
        with pytest.raises(ValueError):
            validate_safe_result(body)
    for result in (
        CommandResult(status=500),
        CommandResult(status=204, body={}),
        CommandResult(status=200, headers={"Authorization": "x"}),
        CommandResult(status=200, headers={"Location": "x\r\ny"}),
    ):
        with pytest.raises(ValueError):
            result.checked()
    assert CommandResult(status=204).checked().body is None
    validate_safe_result([{"id": "1"}, None])
    validate_safe_result([])
    assert CommandResult(status=201, body={"id": "1"}, headers={"Location": "/x"}).checked()


def test_missing_command_and_retry_budget():
    repository = CommandRepository(Mock())
    repository.find = Mock(return_value=None)
    scope = CommandScope(1, "probeUpdate", "probe:1", uuid4())
    with pytest.raises(RuntimeError, match="vanished"):
        repository.claim(scope, request_fingerprint({}))
    session = Mock()
    for state in ("40P01", "40001"):
        authorize = Mock(side_effect=db_error(state))
        with pytest.raises(ApiError, match="RESOURCE_BUSY"):
            TransactionRunner(session, max_attempts=2).run(
                scope, {}, authorize=authorize, work=Mock()
            )
        assert authorize.call_count == 2


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
    for budget in (0, 6):
        with pytest.raises(ValueError):
            TransactionRunner(Mock(), max_attempts=budget)


def test_shared_harness_and_contract(monkeypatch):
    matrix = transport_matrix()
    assert len(matrix) == 154 and len({item["operationId"] for item in matrix}) == 154
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


def test_command_result_is_json_safe_before_commit():
    result = CommandResult(
        status=200,
        body={
            "amount": Decimal("1.250"),
            "when": date(2026, 1, 1),
            "key": uuid4(),
        },
    ).checked()
    assert result.body["amount"] == "1.25" and result.body["when"] == "2026-01-01"
    assert json.loads(json.dumps(result.body)) == result.body
    with patch("tests.support.contract.FormatChecker", return_value=Mock(checkers={})):
        with pytest.raises(RuntimeError, match="RFC3339"):
            assert_schema("2026-01-01T00:00:00Z", "NullableInstant")
