import os

import uvicorn
from django.core.management.base import BaseCommand, CommandError

from apps.mcp_server.server import MIN_TOKEN_LEN, BearerAuth, build_server


class Command(BaseCommand):
    help = "Sobe o servidor MCP (streamable-http em 0.0.0.0:8001/mcp, ou --stdio)."

    def add_arguments(self, parser):
        parser.add_argument("--stdio", action="store_true")
        parser.add_argument("--host", default="0.0.0.0")
        parser.add_argument("--port", type=int, default=8001)

    def handle(self, *args, **opts):
        # manage.py já executou django.setup() antes de chamar o comando
        if not os.environ.get("FINFLOW_MCP_USER_EMAIL"):
            raise CommandError("FINFLOW_MCP_USER_EMAIL não definido.")
        server = build_server(opts["host"], opts["port"])
        if opts["stdio"]:
            server.run(transport="stdio")
            return
        token = os.environ.get("FINFLOW_MCP_TOKEN", "")
        if len(token) < MIN_TOKEN_LEN:
            raise CommandError(
                f"FINFLOW_MCP_TOKEN ausente ou com menos de {MIN_TOKEN_LEN} caracteres."
            )
        app = BearerAuth(server.streamable_http_app(), token)
        uvicorn.run(app, host=opts["host"], port=opts["port"], log_level="info")
