import functools
import hmac

from asgiref.sync import sync_to_async
from mcp.server.fastmcp import FastMCP

from apps.mcp_server.tools import ALL_TOOLS, format_error

MIN_TOKEN_LEN = 32


def _wrap(fn):
    sync_fn = sync_to_async(fn, thread_sensitive=True)

    @functools.wraps(fn)
    async def wrapper(*args, **kwargs):
        try:
            return await sync_fn(*args, **kwargs)
        except Exception as exc:
            msg = format_error(exc)
            if msg is None:
                raise
            raise ValueError(msg) from exc

    return wrapper


def build_server(host: str = "0.0.0.0", port: int = 8001) -> FastMCP:
    mcp = FastMCP("FinFlow", host=host, port=port, streamable_http_path="/mcp")
    for fn in ALL_TOOLS:
        mcp.tool()(_wrap(fn))
    return mcp


class BearerAuth:
    """Middleware ASGI: exige Authorization: Bearer <token> (401 caso contrário)."""

    def __init__(self, app, token: str) -> None:
        self.app = app
        self.token = token.encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            auth = dict(scope["headers"]).get(b"authorization", b"")
            scheme, _, given = auth.partition(b" ")
            if scheme.lower() != b"bearer" or not hmac.compare_digest(
                given.strip(), self.token
            ):
                start = {
                    "type": "http.response.start",
                    "status": 401,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"www-authenticate", b"Bearer"),
                    ],
                }
                await send(start)
                body = b'{"detail":"unauthorized"}'
                await send({"type": "http.response.body", "body": body})
                return
        await self.app(scope, receive, send)
