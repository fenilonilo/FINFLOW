# Servidor MCP do FinFlow

Adapter fino (como as views) sobre services/repositories, para agentes externos (ex.: Byte). Dono único: `FINFLOW_MCP_USER_EMAIL`. Sem delete e sem importação de arquivo.

## Subir

1. `.env` na raiz (veja `.env.example`): `FINFLOW_MCP_TOKEN` (>= 32 chars) e `FINFLOW_MCP_USER_EMAIL`.
2. `docker compose up -d mcp` -> `http://<host>:8001/mcp` (streamable-http).
3. Header obrigatório: `Authorization: Bearer <FINFLOW_MCP_TOKEN>` (senão 401). Token < 32 chars impede o start.

## Tools

Dinheiro = string decimal (`"1234.56"`), datas ISO, mês = `year` + `month`. Leituras de mês geram os fixos antes (`ensure_month`).

- `month_summary(year, month)`: entradas, saídas, saldo, fixos, variáveis, por categoria e forma.
- `list_transactions(year, month, type=None)`: lançamentos do mês.
- `add_transaction(type, description, amount, date, category=None, payment_method=None, is_paid=False, key=None)`: categoria/forma por nome; `key` = idempotência (`created: false` se já existe).
- `update_transaction(id, amount=None, is_paid=None, description=None)`: valor de fixo propaga.
- `list_fixed()`, `add_fixed(type, description, amount, due_day, category=None, payment_method=None, card=None)`.
- `list_categories()`, `list_payment_methods()`, `card_invoices(year, month)`.

## Claude Desktop / Code

stdio (não exige token; roda dentro do container):

```json
{"mcpServers": {"finflow": {"command": "docker",
  "args": ["compose", "-f", "D:/Projetos/FinFlow/docker-compose.yml", "exec", "-T", "mcp",
           "uv", "run", "python", "manage.py", "run_mcp", "--stdio"]}}}
```

HTTP (Claude Code): `claude mcp add --transport http finflow http://localhost:8001/mcp --header "Authorization: Bearer $FINFLOW_MCP_TOKEN"`

## Cliente Python (Byte)

```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async with streamablehttp_client(
    "http://IP-DO-HOST:8001/mcp", headers={"Authorization": f"Bearer {TOKEN}"}
) as (read, write, _):
    async with ClientSession(read, write) as s:
        await s.initialize()
        r = await s.call_tool("month_summary", {"year": 2026, "month": 11})
        print(r.content[0].text)
```
