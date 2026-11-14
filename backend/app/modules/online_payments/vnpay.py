"""VNPAY 2.1.0 sandbox protocol; detached context, no SQL/session or browser authority.

Only payment checkout, signed IPN/Return verification and the ``querydr`` payment
query remain; refunds were removed with the business simplification (handoff 3.3).
"""

import asyncio
import copy
import hashlib
import hmac
import json
import re
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode
from uuid import uuid4
from zoneinfo import ZoneInfo

import httpx

from app.core.exceptions import ApiError
from app.modules.online_payments.schemas import Checkout, VerifiedPayment

PROVIDER = "VNPAY"

VN = ZoneInfo("Asia/Ho_Chi_Minh")
QUERY_REQUEST = (
    "RequestId Version Command TmnCode TxnRef TransactionDate CreateDate IpAddr OrderInfo"
).split()
RESPONSE = (
    "ResponseId Command ResponseCode Message TmnCode TxnRef Amount BankCode PayDate "
    "TransactionNo TransactionType TransactionStatus OrderInfo"
).split()


def amount_to_vnpay(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount <= 0 or amount != amount.to_integral_value():
            raise ValueError
        scaled = int(amount) * 100
        if scaled > 999999999999:
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ApiError(
            422, "VNPAY_AMOUNT_INVALID", "Amount is outside VNPAY integer VND limits"
        ) from None
    return str(scaled)


def amount_from_vnpay(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,12}", value):
        raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Invalid VNPAY amount")
    scaled = int(value)
    if scaled <= 0 or scaled % 100:
        raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Invalid VNPAY VND precision")
    return str(scaled // 100)


def native_time(value):
    try:
        if not re.fullmatch(r"[0-9]{14}", value):
            raise ValueError
        return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=VN).astimezone(UTC)
    except (TypeError, ValueError):
        raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Invalid VNPAY transaction time") from None


def checksum(fields, secret, order=None):
    if order is None:
        data = urlencode(sorted((key, value) for key, value in fields.items() if value != ""))
    else:
        data = "|".join(fields.get("vnp_" + key, "") for key in order)
    return hmac.new(secret.encode(), data.encode(), hashlib.sha512).hexdigest()


def checked_signature(fields, secret, order=None):
    signature = fields.get("vnp_SecureHash", "")
    values = {
        key: value
        for key, value in fields.items()
        if key not in ("vnp_SecureHash", "vnp_SecureHashType")
    }
    if not re.fullmatch(r"[a-fA-F0-9]{128}", signature) or not hmac.compare_digest(
        checksum(values, secret, order), signature.lower()
    ):
        raise ApiError(401, "INVALID_SIGNATURE", "Invalid VNPAY signature")
    return values


class VnpayAdapter:
    def __init__(self, settings, *, ip_address="127.0.0.1", client=None, clock=None):
        self.base_url = settings.vnpay_api_url.rstrip("/")
        self.timeout = settings.payment_timeout_seconds
        self.client = client
        self.settings = settings
        self.ip_address = ip_address
        self.clock = clock or (lambda: datetime.now(UTC))
        self.payment = None

    def bind(self, payment):
        """Detached copy bound to one payment row; the original stays unbound."""
        bound = copy.copy(self)
        bound.payment = dict(payment)
        return bound

    async def transport(self, method, path, payload, headers):
        # HTTPX's socket read timeout alone resets for each chunk. The outer
        # deadline also bounds slow headers/body trickles and client cleanup.
        async with asyncio.timeout(self.timeout):
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout), follow_redirects=False
            ) as client:
                return await client.request(
                    method, self.base_url + path, json=payload, headers=headers
                )

    def sign(self, fields, order=None):
        return checksum(fields, self.settings.vnpay_hash_secret.get_secret_value(), order)

    def verify_callback(self, pairs):
        fields = dict(pairs)
        if (
            len(fields) != len(pairs)
            or len(fields) > 64
            or any(not key.startswith("vnp_") or len(value) > 1024 for key, value in pairs)
        ):
            raise ApiError(401, "INVALID_SIGNATURE", "Invalid VNPAY parameters")
        values = checked_signature(fields, self.settings.vnpay_hash_secret.get_secret_value())
        if values.get("vnp_TmnCode") != self.settings.vnpay_tmn_code:
            raise ApiError(401, "INVALID_SIGNATURE", "VNPAY merchant differs")
        return values

    def create_checkout(self, reference, amount):
        fields = {
            "vnp_Version": "2.1.0",
            "vnp_Command": "pay",
            "vnp_TmnCode": self.settings.vnpay_tmn_code,
            "vnp_Amount": amount_to_vnpay(amount),
            "vnp_CurrCode": "VND",
            "vnp_TxnRef": reference,
            "vnp_OrderInfo": "Agentra payment " + reference,
            "vnp_OrderType": "other",
            "vnp_Locale": "vn",
            "vnp_ReturnUrl": self.settings.vnpay_return_url,
            "vnp_IpAddr": self.ip_address,
            "vnp_CreateDate": self.payment["createdAt"].astimezone(VN).strftime("%Y%m%d%H%M%S"),
            "vnp_ExpireDate": self.payment["expiresAt"].astimezone(VN).strftime("%Y%m%d%H%M%S"),
        }
        return Checkout(
            checkoutUrl=self.settings.vnpay_payment_url
            + "?"
            + urlencode(sorted(fields.items()))
            + "&vnp_SecureHash="
            + self.sign(fields),
            expiresAt=self.payment["expiresAt"],
        )

    def payment_evidence(self, fields):
        try:
            reference = fields["vnp_TxnRef"]
            amount = amount_from_vnpay(fields["vnp_Amount"])
            state = fields["vnp_TransactionStatus"]
            code = fields["vnp_ResponseCode"]
            transaction = fields.get("vnp_TransactionNo", "0")
            if (
                fields.get("vnp_TransactionType", "01") != "01"
                or fields.get("vnp_CurrCode", "VND") != "VND"
                or not re.fullmatch(r"[0-9]{1,15}", transaction)
                or not reference.strip()
            ):
                raise ValueError
            if state == "00":
                if code != "00" or int(transaction) == 0:
                    raise ValueError
                status, paid_at = "SUCCESS", native_time(fields["vnp_PayDate"])
            elif state in ("01", "05", "06"):
                status, paid_at = "PENDING", None
            elif state in ("02", "04", "07", "09"):
                status, paid_at = ("EXPIRED" if code == "11" else "FAILED"), None
            else:
                raise ValueError
        except (KeyError, ValueError):
            raise ApiError(
                502, "INVALID_PROVIDER_RESPONSE", "Invalid VNPAY payment evidence"
            ) from None
        payload = {
            "merchantReference": reference,
            "amount": amount,
            "providerTransactionId": transaction,
            "status": status,
            "paymentTime": None if paid_at is None else paid_at.isoformat(),
        }
        if paid_at is None:
            payload.pop("paymentTime")
        event = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        return VerifiedPayment(eventKey="vnpay:" + event, **payload)

    def api_fields(self, command, reference):
        return {
            "vnp_RequestId": uuid4().hex,
            "vnp_Version": "2.1.0",
            "vnp_Command": command,
            "vnp_TmnCode": self.settings.vnpay_tmn_code,
            "vnp_TxnRef": reference,
            "vnp_TransactionDate": self.payment["createdAt"]
            .astimezone(VN)
            .strftime("%Y%m%d%H%M%S"),
            "vnp_CreateDate": self.clock().astimezone(VN).strftime("%Y%m%d%H%M%S"),
            "vnp_IpAddr": self.ip_address,
            "vnp_OrderInfo": "Agentra query " + reference,
        }

    def call_api(self, fields):
        command = fields["vnp_Command"]
        fields = {**fields, "vnp_SecureHash": self.sign(fields, QUERY_REQUEST)}
        try:
            if self.client is None:
                response = asyncio.run(self.transport("POST", "", fields, {}))
            else:
                response = self.client.post(self.base_url, json=fields, timeout=self.timeout)
            if response.status_code != 200:
                raise ApiError(503, "PROVIDER_UNAVAILABLE", "VNPAY API unavailable")
            data = response.json()
            if not isinstance(data, dict) or any(
                not isinstance(v, (str, int)) or isinstance(v, bool) for v in data.values()
            ):
                raise ValueError
            data = {key: str(value) for key, value in data.items()}
            response_order = RESPONSE + ["PromotionCode", "PromotionAmount"]
            try:
                data = checked_signature(
                    data, self.settings.vnpay_hash_secret.get_secret_value(), response_order
                )
            except ApiError:
                raise ApiError(
                    502, "INVALID_PROVIDER_RESPONSE", "Invalid VNPAY response signature"
                ) from None
        except (httpx.TransportError, TimeoutError):
            raise ApiError(503, "PROVIDER_UNAVAILABLE", "VNPAY API unavailable") from None
        except (TypeError, ValueError):
            raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Invalid VNPAY response") from None
        if (
            data.get("vnp_TmnCode") != self.settings.vnpay_tmn_code
            or data.get("vnp_Command") != command
            or data.get("vnp_TxnRef") != fields["vnp_TxnRef"]
        ):
            raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "VNPAY response identity differs")
        if data.get("vnp_ResponseCode") != "00":
            code = data.get("vnp_ResponseCode", "")
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "VNPAY did not provide a definitive outcome",
                details={"providerCode": code if re.fullmatch(r"[0-9]{2}", code) else "UNKNOWN"},
            )
        return data

    def query_payment(self, reference):
        data = self.call_api(self.api_fields("querydr", reference))
        if data.get("vnp_TransactionType") != "01":
            raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Query is not a payment result")
        return self.payment_evidence(data)


def adapter_for(settings, *, ip_address="127.0.0.1"):
    """The configured VNPAY adapter, or None while VNPAY credentials are blank."""
    if not settings.vnpay_tmn_code or not settings.vnpay_hash_secret.get_secret_value():
        return None
    return VnpayAdapter(settings, ip_address=ip_address)
