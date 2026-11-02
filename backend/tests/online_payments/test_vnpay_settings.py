"""Native VNPAY configuration preparation, with no provider or database calls."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

SECRET = "synthetic-vnpay-secret-sentinel"
COMPLETE = {
    "vnpay_tmn_code": "TEST1234",
    "vnpay_hash_secret": SECRET,
    "vnpay_ipn_url": "https://merchant.test/api/v1/integrations/vnpay/ipn",
    "vnpay_return_url": "https://merchant.test/api/v1/integrations/vnpay/return",
}


def settings(**values):
    return Settings(
        _env_file=None, db_host="localhost", db_user="test", db_password="test", **values
    )


def test_blank_preparation_and_sandbox_defaults():
    config = settings()
    assert config.vnpay_tmn_code == ""
    assert config.vnpay_hash_secret.get_secret_value() == ""
    assert config.vnpay_ipn_url == config.vnpay_return_url == ""
    assert config.vnpay_payment_url == "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    assert config.vnpay_api_url == "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"
    assert config.payment_provider == ""


def test_complete_native_settings_preserve_secret_and_do_not_enable_canonical_provider():
    config = settings(**COMPLETE)
    assert config.vnpay_hash_secret.get_secret_value() == SECRET
    assert config.vnpay_tmn_code == "TEST1234"
    assert config.vnpay_ipn_url == COMPLETE["vnpay_ipn_url"]
    assert config.vnpay_return_url == COMPLETE["vnpay_return_url"]
    assert SECRET not in repr(config)
    assert SECRET not in config.model_dump_json()
    assert config.payment_provider == ""


def test_callbacks_can_be_prepared_without_credentials():
    config = settings(
        vnpay_ipn_url=COMPLETE["vnpay_ipn_url"],
        vnpay_return_url="https://merchant.test:8443/return",
    )
    assert config.vnpay_tmn_code == ""
    assert config.vnpay_return_url == "https://merchant.test:8443/return"


@pytest.mark.parametrize("field", tuple(COMPLETE))
def test_incomplete_native_settings_rejected_without_disclosing_secret(field):
    values = {**COMPLETE, field: ""}
    with pytest.raises(ValidationError, match="VNPAY requires") as error:
        settings(**values)
    assert SECRET not in str(error.value)
    assert SECRET not in repr(error.value)


@pytest.mark.parametrize("secret", [" ", "\t\n"])
def test_whitespace_secret_is_not_a_credential(secret):
    with pytest.raises(ValidationError, match="VNPAY requires"):
        settings(**{**COMPLETE, "vnpay_hash_secret": secret})


@pytest.mark.parametrize("code", ["1234567", "123456789", "ABCD_123", " ABCD123", "ABCD1234\n"])
def test_merchant_code_length_and_alphabet(code):
    with pytest.raises(ValidationError):
        settings(**{**COMPLETE, "vnpay_tmn_code": code})


@pytest.mark.parametrize("field", ["vnpay_ipn_url", "vnpay_return_url"])
@pytest.mark.parametrize(
    "url",
    [
        "http://merchant.test/callback",
        "/callback",
        "https:///callback",
        "https://user:password-sentinel@merchant.test/callback",
        "https://@merchant.test/callback",
        "https://merchant.test/callback?token=password-sentinel",
        "https://merchant.test/callback?",
        "https://merchant.test/callback#fragment",
        "https://merchant.test/callback#",
        "https://merchant.test:0/callback",
        "https://merchant.test:65536/callback",
        "https://merchant.test:notaport/callback",
        "https://[broken/callback",
        "https://merchant.test\\callback",
        "https://merchant.test/call back",
        "https://merchant.test/call\nback",
    ],
)
def test_callback_url_boundaries_and_redacted_errors(field, url):
    with pytest.raises(ValidationError, match="VNPAY callbacks") as error:
        settings(**{**COMPLETE, field: url})
    assert SECRET not in str(error.value)
    assert "password-sentinel" not in str(error.value)


def test_ipn_and_return_cannot_share_the_same_handler_url():
    with pytest.raises(ValidationError, match="must differ"):
        settings(**{**COMPLETE, "vnpay_return_url": COMPLETE["vnpay_ipn_url"]})


@pytest.mark.parametrize("field", ["vnpay_payment_url", "vnpay_api_url"])
def test_sandbox_settings_cannot_silently_use_production_or_arbitrary_hosts(field):
    with pytest.raises(ValidationError):
        settings(**{field: "https://pay.vnpay.vn/production"})


def test_main_dotenv_and_environment_priority(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    for key in COMPLETE:
        monkeypatch.delenv(key.upper(), raising=False)
    (tmp_path / ".env").write_text(
        "VNPAY_TMN_CODE=BASE1234\n"
        f"VNPAY_HASH_SECRET='{SECRET}'\n"
        f"VNPAY_IPN_URL={COMPLETE['vnpay_ipn_url']}\n"
        f"VNPAY_RETURN_URL={COMPLETE['vnpay_return_url']}\n",
        encoding="utf-8",
    )
    base = dict(db_host="localhost", db_user="test", db_password="test")
    assert Settings(**base).vnpay_tmn_code == "BASE1234"
    monkeypatch.setenv("VNPAY_TMN_CODE", "PROC1234")
    assert Settings(**base).vnpay_tmn_code == "PROC1234"
    monkeypatch.delenv("VNPAY_TMN_CODE")
    assert Settings(_env_file=None, **base).vnpay_hash_secret.get_secret_value() == ""
