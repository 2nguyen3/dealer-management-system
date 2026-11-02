import hashlib
import hmac
import math
import threading
import time
from collections import deque
from collections.abc import Callable

from app.core.exceptions import AuthError


def build_rate_limit_key(
    operation: str, address: str, email: str | None = None, *, secret: bytes = b""
) -> str:
    suffix = (
        ""
        if email is None
        else hmac.new(secret, email.lower().encode(), hashlib.sha256).hexdigest()
    )
    return f"{operation}:{address}:{suffix}"


class AuthRateLimiter:
    def __init__(self, max_buckets: int, clock: Callable[[], float] = time.monotonic) -> None:
        self.max_buckets = max_buckets
        self.clock = clock
        self.lock = threading.Lock()
        self.buckets: dict[str, tuple[deque, float]] = {}

    def check(self, key: str, limit: int, window: float) -> None:
        with self.lock:
            now = self.clock()
            for old_key in list(self.buckets):
                entries, lifetime = self.buckets[old_key]
                while entries and entries[0] <= now - lifetime:
                    entries.popleft()
                if not entries:
                    del self.buckets[old_key]
            if key not in self.buckets:
                if len(self.buckets) >= self.max_buckets:
                    raise AuthError(429, "RATE_LIMIT_EXCEEDED", "Too many requests", 1)
                self.buckets[key] = (deque(), window)
            entries, _ = self.buckets[key]
            if len(entries) >= limit:
                raise AuthError(
                    429,
                    "RATE_LIMIT_EXCEEDED",
                    "Too many requests",
                    max(1, math.ceil(entries[0] + window - now)),
                )
            entries.append(now)
