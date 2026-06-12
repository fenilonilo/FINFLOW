# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# FinFlow — Regras Globais do Projeto

## Fonte de verdade
- `FINFLOW_PLANO_IMPLEMENTACAO_v2.md` na raiz é especificação completa. NUNCA contradiga seções 5 (tabelas) e 6 (contratos JSON) — interfaces congeladas entre agentes.
- Decisões fora do documento: registrar em `DECISIONS.md` (1 linha de justificativa) e prosseguir.

## Orquestração
- Sessão principal atua como ORQUESTRADOR: delegue aos subagentes especializados (agent-infra, agent-db, agent-domain, agent-api, agent-seed, agent-front-core, agent-front-pages) e integre resultados.
- Grafo de dependências: INFRA → DB → {DOMAIN, SEED} → API → FRONT-PAGES. FRONT-CORE roda em paralelo (mocka API com MSW).
- Nunca implemente diretamente o que pertence ao escopo de subagente.

## Regras técnicas inegociáveis
- Backend: Python 3.12 + UV (`uv add`, `uv run`). PROIBIDO requirements.txt e pip.
- Dinheiro trafega como string decimal `"1234.56"` — nunca float. Backend usa `Decimal`.
- API sob `/api/v1/`. JSON snake_case. Erros: `{"detail": str, "errors": {campo: [msg]}}`.
- Views finas (sem regra de negócio) → services (sem DRF) → repositories (único lugar com ORM).
- TDD: teste ANTES do código de produção (red-green-refactor). Commits: `test:/feat:/refactor:/chore:`.
- Fase só é declarada pronta após: `uv run pytest --cov=apps --cov-fail-under=85 && uv run ruff check .`

## Comandos comuns

### Backend (dentro de `backend/`)
```bash
uv sync                                        # instala dependências
uv run python manage.py migrate                # aplica migrações
uv run pytest                                  # todos os testes
uv run pytest apps/transactions/tests/unit/    # testes de um módulo
uv run pytest -k "test_summary"                # filtrar por nome
uv run pytest --cov=apps --cov-fail-under=85   # com cobertura (gate de qualidade)
uv run ruff check .                            # lint
uv run ruff format .                           # format
uv run mypy apps/                              # type check (strict em domain/)
uv run python manage.py seed_data              # popula dados reais
```

### Infra
```bash
docker compose up -d      # sobe db + backend + frontend
docker compose logs -f    # acompanhar logs
```

> ⚠️ **Venv host ↔ container:** `./backend:/app` é bind-mounted. O `.venv` é blindado por um volume anônimo (`/app/.venv` no compose) + `.dockerignore`, pois o `.venv` do host (Windows) é incompatível com o do container (Linux). NUNCA remova o volume `/app/.venv` nem rode `uv sync`/`uv run` no host contra esse mount enquanto o container roda — isso corrompe o venv de ambos e mata o backend (`ModuleNotFoundError: django.core`). Mesma regra para `node_modules` no frontend. Para mexer no venv, use `docker compose exec backend uv ...`.

### Frontend (dentro de `frontend/`)
```bash
npm install
npm run dev               # dev server
npm run build             # build produção
npm run generate-types    # regenera types do OpenAPI (nunca editar manualmente)
```

## Slash commands disponíveis
| Comando | Ação |
|---|---|
| `/finflow-bootstrap` | Cria infra (F1) via agent-infra, valida ambiente |
| `/finflow-phase <N>` | Executa fase N (1–8) delegando ao agente correto |
| `/finflow-parallel` | Dispara workstreams em paralelo (após F2 concluída) |
| `/finflow-verify` | Roda checklist de aceitação (seção 12) sem corrigir |

## Estrutura

### Backend (por app)
```
apps/<nome>/
├── models.py         # persistência, zero negócio
├── repositories.py   # único lugar com ORM queries
├── services.py       # regras de negócio; recebem/retornam DTOs
├── dtos.py           # dataclasses de entrada/saída
├── strategies.py     # quando aplicável (ex.: amortização Price/SAC)
└── api/
    ├── serializers.py
    ├── views.py      # finas: validar → service → responder
    └── urls.py
```

Apps: `accounts`, `core` (categorias/formas de pagamento), `transactions`, `investments`, `cards`, `acquisitions`, `analytics`.

Exceções de domínio em `apps/common/exceptions.py` → handler global DRF converte para envelope padrão. Views não fazem try/except de negócio.

### Frontend
`frontend/` — React 18 + Vite + TypeScript + TailwindCSS. Types gerados do OpenAPI (`npm run generate-types`) — **nunca editados à mão**.
