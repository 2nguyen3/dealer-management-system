"""Bearer authentication: the token is an Agentra access token, verified by the backend.

The MCP server keeps no user store. A token is accepted when `GET /api/v1/auth/me`
accepts it; the user's live permission codes become the token scopes (used to hide tools
the user cannot call). The same token is then forwarded to every backend call.
"""

import hashlib
import time

import httpx2
from fastmcp.server.auth import AccessToken, TokenVerifier

MAX_CACHED = 1000


class AgentraTokenVerifier(TokenVerifier):
    def __init__(
        self,
        api_url: str,
        *,
        cache_seconds: float = 30,
        timeout: float = 10,
        base_url: str | None = None,
        transport: httpx2.AsyncBaseTransport | None = None,
    ):
        super().__init__(base_url=base_url or None)
        self.api_url = api_url.rstrip("/")
        self.cache_seconds = cache_seconds
        self.timeout = timeout
        self.transport = transport
        self._cache: dict[str, tuple[float, AccessToken]] = {}

    async def verify_token(self, token: str) -> AccessToken | None:
        key = hashlib.sha256(token.encode()).hexdigest()
        now = time.monotonic()
        cached = self._cache.get(key)
        if cached is not None and cached[0] > now:
            return cached[1]
        async with httpx2.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
            try:
                response = await client.get(
                    f"{self.api_url}/api/v1/auth/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
            except httpx2.HTTPError:
                return None
        if response.status_code != 200:
            self._cache.pop(key, None)
            return None
        body = response.json()
        user = body.get("user") or {}
        access = AccessToken(
            token=token,
            client_id=str(user.get("id", "agentra")),
            scopes=sorted(body.get("allowedFunctions") or []),
            claims={"email": user.get("email"), "name": user.get("fullName")},
        )
        if self.cache_seconds:
            if len(self._cache) >= MAX_CACHED:
                self._cache.clear()
            self._cache[key] = (now + self.cache_seconds, access)
        return access
